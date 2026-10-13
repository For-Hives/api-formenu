"use strict";

/**
 * Output sanitizer for the custom (non core) controllers of this API.
 *
 * `strapi.entityService` returns raw database rows: private attributes
 * (password hashes, reset / confirmation tokens...) and every populated
 * relation come back untouched. The core controllers run their response
 * through Strapi's content API sanitizer, the custom ones have to do it
 * themselves: every custom controller must pass its response through
 * `sanitizeOutput` (or `sanitizeCurrentUser`) before assigning `ctx.body`.
 */

const { sanitize, traverseEntity } = require("@strapi/utils");

const USER_UID = "plugin::users-permissions.user";
const USER_UIDS = [USER_UID, "admin::user"];

// An object carrying one of these keys is a user record.
const CREDENTIAL_KEYS = [
  "password",
  "resetPasswordToken",
  "confirmationToken",
  "registrationToken",
];

// Removed wherever they are found, whatever they hold.
const FORBIDDEN_KEYS = [...CREDENTIAL_KEYS, "createdBy", "updatedBy", "users"];

// Removed when they hold a populated relation (an object or an array):
// `user` relations and `related`, the polymorphic relation of a media that
// lists the raw rows of every entry using the file (users included).
const FORBIDDEN_RELATION_KEYS = ["user", "related"];

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

// Plain records only: arrays are handled apart, and values that serialize
// themselves (Date, Buffer...) are left untouched.
const isRecord = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof value.toJSON !== "function";

const isUserRecord = (value) =>
  isRecord(value) &&
  (USER_UIDS.includes(value.__type) ||
    CREDENTIAL_KEYS.some((key) => hasOwn(value, key)));

const isForbidden = (key, value) =>
  FORBIDDEN_KEYS.includes(key) ||
  (FORBIDDEN_RELATION_KEYS.includes(key) &&
    value !== null &&
    typeof value === "object") ||
  isUserRecord(value);

/**
 * Schema independent pass, it never needs a running Strapi.
 *
 * Returns a deep copy of `data` without, at any depth:
 * - the credential keys and the creator fields (createdBy / updatedBy),
 * - the user relations (`users`, and `user` / `related` when populated),
 * - any nested object that is a user record, whatever the key it sits under.
 *
 * The root object itself is never dropped, only cleaned.
 */
const stripSensitiveData = (data) => {
  if (Array.isArray(data)) {
    return data.filter((item) => !isUserRecord(item)).map(stripSensitiveData);
  }

  if (!isRecord(data)) {
    return data;
  }

  return Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => !isForbidden(key, value))
      .map(([key, value]) => [key, stripSensitiveData(value)])
  );
};

// Schema aware visitor: drops the relations targeting a user model, whatever
// the name of the attribute, and the polymorphic ones (their target is only
// known at runtime, so it can be a user).
const removeUserRelations = ({ key, attribute }, { remove }) => {
  if (!attribute || attribute.type !== "relation") {
    return;
  }

  const isMorphTo =
    typeof attribute.relation === "string" &&
    attribute.relation.startsWith("morphTo");

  if (isMorphTo || USER_UIDS.includes(attribute.target)) {
    remove(key);
  }
};

const traverse = async (visitor, schema, data) => {
  if (Array.isArray(data)) {
    const result = [];
    for (const entry of data) {
      result.push(await traverseEntity(visitor, { schema }, entry));
    }
    return result;
  }

  return traverseEntity(visitor, { schema }, data);
};

const getSchema = (uid) => {
  // No Strapi instance (unit tests, scripts): schema independent pass only.
  if (typeof strapi === "undefined" || typeof strapi.getModel !== "function") {
    return undefined;
  }

  const schema = strapi.getModel(uid);

  if (!schema) {
    // Fail closed: a wrong uid must not silently skip the schema aware pass.
    throw new Error(`sanitizeOutput: unknown content type "${uid}"`);
  }

  return schema;
};

/**
 * Sanitizes what a custom controller is about to send.
 *
 * 1. `stripSensitiveData`, which does not depend on any schema.
 * 2. Strapi's own content API output sanitizer (private and password
 *    attributes of every model reached through the schema of `uid`).
 * 3. Removal of the relations targeting a user model.
 *
 * `auth` is left out on purpose for the public / tenant endpoints: with it
 * Strapi also removes every relation the caller's role or token cannot `find`
 * (menus, categories, dishes...), which the clients rely on.
 *
 * @param {object|object[]|null} data raw result of an entityService call
 * @param {string} uid uid of the content type at the root of `data`
 * @param {{auth?: object}} [options]
 */
const sanitizeOutput = async (data, uid, { auth } = {}) => {
  const stripped = stripSensitiveData(data);
  const schema = getSchema(uid);

  if (!schema || stripped === null || stripped === undefined) {
    return stripped;
  }

  const sanitized = await sanitize.contentAPI.output(stripped, schema, {
    auth,
  });

  return traverse(removeUserRelations, schema, sanitized);
};

/**
 * The only user record a custom endpoint may return is the caller's own one:
 * no password, no token, and none of the other users reachable through its
 * relations (company.users, role.users).
 *
 * @param {object} user the caller's own user
 * @param {object} [auth] `ctx.state.auth`, as the users-permissions plugin does
 */
const sanitizeCurrentUser = (user, auth) =>
  sanitizeOutput(user, USER_UID, { auth });

module.exports = {
  sanitizeOutput,
  sanitizeCurrentUser,
  stripSensitiveData,
};
