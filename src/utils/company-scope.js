"use strict";

/**
 * Keeps the content API of a company inside that company.
 *
 * The core controllers of menus, categories, dishes, ingredients and companies
 * are built with `companyScopedController`:
 * - `find` only lists the rows of the caller's company,
 * - `create` always writes the caller's company, whatever the body says,
 * - `update` never changes the company of a row,
 * - a relation (dish -> category, category -> menu, dish -> ingredients...)
 *   can only point at rows of the caller's company.
 *
 * `findOne`, `update` and `delete` keep their `company-tenancy` middleware,
 * which checks that the requested row belongs to the caller's company.
 *
 * The scope is applied after Strapi's own query and input sanitization: the
 * sanitizer drops relation filters and relation inputs the caller's role may
 * not read, so a filter added before it could vanish without a word.
 *
 * API tokens are not users and have no company: their requests go to the core
 * controller unchanged, under the permissions of the token (the public menu
 * reads `/api/all-company` with one).
 */

const { errors, parseMultipartData } = require("@strapi/utils");

const { ForbiddenError, UnauthorizedError, ValidationError } = errors;

const USER_UID = "plugin::users-permissions.user";
const COMPANY_UID = "api::company.company";

// the content types that carry a `company` relation
const COMPANY_CONTENT_UIDS = [
  "api::menu.menu",
  "api::category.category",
  "api::dish.dish",
  "api::ingredient.ingredient",
];

const isApiToken = (ctx) => ctx.state?.auth?.strategy?.name === "api-token";

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The id of the company of the connected user.
 * Throws when there is no user, or when the user has no company.
 */
const callerCompanyId = async (ctx) => {
  const user = ctx.state?.user;

  if (!user) {
    throw new UnauthorizedError("User not authenticated");
  }

  const connectedUser = await strapi.entityService.findOne(USER_UID, user.id, {
    populate: { company: true },
  });

  if (!connectedUser || !connectedUser.company) {
    throw new ForbiddenError("User is not associated with any company");
  }

  return connectedUser.company.id;
};

/**
 * `filters` restricted to the rows of `companyId`. The caller's own filters
 * are kept, side by side with the company condition, so that an `$or` of the
 * caller cannot widen the result.
 */
const scopeFilters = (uid, filters, companyId) => {
  const scope =
    uid === COMPANY_UID
      ? { id: { $eq: companyId } }
      : { company: { id: { $eq: companyId } } };

  const hasFilters = isPlainObject(filters) && Object.keys(filters).length > 0;

  return hasFilters ? { $and: [filters, scope] } : scope;
};

/**
 * Every id a relation input points at, whatever the shape Strapi accepts:
 * `3`, `"3"`, `[3, 4]`, `{ id: 3 }`, `[{ id: 3 }]`,
 * `{ connect: [...], set: [...] }`. A `disconnect` only removes links,
 * so it is not checked.
 */
const relationIds = (value) => {
  if (value === null || value === undefined) {
    return [];
  }
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

/**
 * Refuses a write whose relations point at rows of another company
 * (a dish placed in the category of another restaurant, for instance).
 */
const assertRelationsInCompany = async (uid, data, companyId) => {
  const { attributes } = strapi.getModel(uid);

  for (const [key, attribute] of Object.entries(attributes)) {
    if (
      !(key in data) ||
      attribute.type !== "relation" ||
      !COMPANY_CONTENT_UIDS.includes(attribute.target)
    ) {
      continue;
    }

    const ids = [...new Set(relationIds(data[key]).map(Number))];

    if (ids.some((id) => !Number.isInteger(id))) {
      throw new ValidationError(`Invalid relation id in "${key}"`);
    }
    if (ids.length === 0) {
      continue;
    }

    const owned = await strapi.db.query(attribute.target).findMany({
      select: ["id"],
      where: { id: { $in: ids }, company: { id: { $eq: companyId } } },
    });

    if (owned.length !== ids.length) {
      throw new ForbiddenError(
        `"${key}" points at an entry of another company`
      );
    }
  }
};

const parseBody = (ctx) => {
  if (ctx.is("multipart")) {
    return parseMultipartData(ctx);
  }
  const { data } = ctx.request.body || {};
  return { data };
};

const without = (data, fields) => {
  const copy = { ...data };
  for (const field of fields) {
    delete copy[field];
  }
  return copy;
};

/**
 * @param {string} uid content type of the controller
 * @param {object} options
 * @param {string[]} options.readOnlyFields fields a client can never write:
 *   they are silently dropped from the body, as the admin sends the company
 *   of the user with every write
 * @param {boolean} options.allowCreate whether a user may create rows
 */
const companyScopedController = (
  uid,
  { readOnlyFields = ["company"], allowCreate = true } = {}
) => {
  const { createCoreController } = require("@strapi/strapi").factories;

  return createCoreController(uid, ({ strapi }) => ({
    async find(ctx) {
      if (isApiToken(ctx)) {
        return super.find(ctx);
      }

      const companyId = await callerCompanyId(ctx);

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      sanitizedQuery.filters = scopeFilters(
        uid,
        sanitizedQuery.filters,
        companyId
      );

      const { results, pagination } = await strapi
        .service(uid)
        .find(sanitizedQuery);
      const sanitizedResults = await this.sanitizeOutput(results, ctx);

      return this.transformResponse(sanitizedResults, { pagination });
    },

    async create(ctx) {
      if (isApiToken(ctx)) {
        return super.create(ctx);
      }

      const companyId = await callerCompanyId(ctx);

      if (!allowCreate) {
        throw new ForbiddenError("This action is unauthorized.");
      }

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      const body = parseBody(ctx);

      if (!isPlainObject(body.data)) {
        throw new ValidationError('Missing "data" payload in the request body');
      }

      const data = await this.sanitizeInput(
        without(body.data, readOnlyFields),
        ctx
      );
      await assertRelationsInCompany(uid, data, companyId);
      // the company of a new row is the caller's, never the body's
      data.company = companyId;

      const entity = await strapi.service(uid).create({
        ...sanitizedQuery,
        data,
        files: "files" in body ? body.files : undefined,
      });
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);

      return this.transformResponse(sanitizedEntity);
    },

    async update(ctx) {
      if (isApiToken(ctx)) {
        return super.update(ctx);
      }

      // the `company-tenancy` middleware of the route has already checked
      // that the row belongs to the caller's company
      const companyId = await callerCompanyId(ctx);
      const { id } = ctx.params;

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      const body = parseBody(ctx);

      if (!isPlainObject(body.data)) {
        throw new ValidationError('Missing "data" payload in the request body');
      }

      const data = await this.sanitizeInput(
        without(body.data, readOnlyFields),
        ctx
      );
      await assertRelationsInCompany(uid, data, companyId);

      const entity = await strapi.service(uid).update(id, {
        ...sanitizedQuery,
        data,
        files: "files" in body ? body.files : undefined,
      });
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);

      return this.transformResponse(sanitizedEntity);
    },
  }));
};

module.exports = {
  COMPANY_CONTENT_UIDS,
  callerCompanyId,
  scopeFilters,
  relationIds,
  assertRelationsInCompany,
  companyScopedController,
};
