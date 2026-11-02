"use strict";

/**
 * What belongs to a company, shared by `company-scope`, `file-ownership` and
 * `upload-tenancy`.
 */

const { errors } = require("@strapi/utils");

const { ValidationError } = errors;

const USER_UID = "plugin::users-permissions.user";
const COMPANY_UID = "api::company.company";

// the `content` component of a company (also used by the content-website
// single type, which belongs to no company)
const CONTENT_COMPONENT_UID = "content-website.content-website";

// the content types that carry a `company` relation
const COMPANY_CONTENT_UIDS = [
  "api::menu.menu",
  "api::category.category",
  "api::dish.dish",
  "api::ingredient.ingredient",
];

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Strapi's database layer copies the `__pivot` object of a relation or media
 * value into the join row it writes (`{ ...data.__pivot }` in createRelations
 * and updateRelations of @strapi/database), after the columns it computed
 * itself, and the input sanitizer keeps it. `{ id: <own file>, __pivot:
 * { related_id: <entry of another company> } }` would pass every check, which
 * read the `id`, while the row written links something else (another file,
 * another entry, another company's dish). No client needs it (admin-formenu
 * never sends it): it is refused wherever it appears in a body.
 */
const PIVOT_KEY = "__pivot";

const MAX_DEPTH = 20;

/** Whether `value` holds a `__pivot` key at any depth. */
const hasPivot = (value, depth = 0) => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (depth > MAX_DEPTH) {
    // a body this deep is no Formenu entry; refusing is the safe answer
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasPivot(item, depth + 1));
  }
  return Object.keys(value).some(
    (key) => key === PIVOT_KEY || hasPivot(value[key], depth + 1)
  );
};

/** Refuses (400) a body that holds a `__pivot` key anywhere. */
const assertNoPivot = (value) => {
  if (hasPivot(value)) {
    throw new ValidationError(`"${PIVOT_KEY}" is not accepted in a request`);
  }
};

/**
 * Every id a relation or media input points at, whatever the shape Strapi
 * accepts: `3`, `"3"`, `[3, 4]`, `{ id: 3 }`, `[{ id: 3 }]`, a whole file
 * object, `{ connect: [...], set: [...] }`. A `disconnect` only removes
 * links, so it is not returned. A value carrying `__pivot` is refused: the
 * ids returned would not be the ones written (see `assertNoPivot`).
 */
const relationIds = (value) => {
  if (value === null || value === undefined) {
    return [];
  }
  assertNoPivot(value);
  if (Array.isArray(value)) {
    return value.flatMap(relationIds);
  }
  if (typeof value === "object") {
    if ("id" in value) {
      return [value.id];
    }
    return [...relationIds(value.connect), ...relationIds(value.set)];
  }
  return [value];
};

module.exports = {
  USER_UID,
  COMPANY_UID,
  CONTENT_COMPONENT_UID,
  COMPANY_CONTENT_UIDS,
  isPlainObject,
  hasPivot,
  assertNoPivot,
  relationIds,
};
