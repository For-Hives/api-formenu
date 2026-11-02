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
 *   can only point at rows of the caller's company,
 * - a media field (dish image, menu background, the `content` of the
 *   company...) can only name a file of the caller's company
 *   (see utils/file-ownership), and files cannot be sent with the entry.
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
const {
  USER_UID,
  COMPANY_UID,
  COMPANY_CONTENT_UIDS,
  isPlainObject,
  relationIds,
} = require("./company-content");
const { assertMediaInCompany } = require("./file-ownership");

const { ForbiddenError, UnauthorizedError, ValidationError } = errors;

const isApiToken = (ctx) => ctx.state?.auth?.strategy?.name === "api-token";

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
    const body = parseMultipartData(ctx);
    // files sent with the entry would be created without an owner, out of
    // reach of the checks of POST /api/upload (see utils/file-ownership)
    if (isPlainObject(body.files) && Object.keys(body.files).length > 0) {
      throw new ForbiddenError(
        "Upload files with POST /api/upload, then link them to the entry"
      );
    }
    return { data: body.data };
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
      await assertMediaInCompany(uid, data, companyId);
      // the company of a new row is the caller's, never the body's
      data.company = companyId;

      const entity = await strapi.service(uid).create({
        ...sanitizedQuery,
        data,
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
      await assertMediaInCompany(uid, data, companyId, { entryId: id });

      const entity = await strapi.service(uid).update(id, {
        ...sanitizedQuery,
        data,
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
