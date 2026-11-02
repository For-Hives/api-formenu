"use strict";

/**
 * Keeps the upload routes of the content API inside the caller's company.
 *
 * admin-formenu sends `POST /api/upload` with the JWT of the user and a file,
 * nothing else, then links the returned file to a dish with a normal
 * `PUT /api/dishes/:id`. So `plugin::upload.content-api.upload` is enabled for
 * the users, and with it three ways to write into another restaurant:
 * - `ref` / `refId` / `field` in the body attach the new file to any entry,
 *   the dish of another company included;
 * - `?id=<file>` with a file replaces the content of that file;
 * - `?id=<file>` without a file rewrites its name and alternative text.
 *
 * These middlewares let a user:
 * - upload only when their account has a company; every new file is recorded
 *   as owned by that company (utils/file-ownership), the plain upload of the
 *   admin included;
 * - attach a new file only to an entry of their company (menu, category,
 *   dish, ingredient, or their company itself);
 * - replace, edit, read or delete one file only when their company owns it.
 *   Linking a file to one's own dish does not make it one's own: the owner is
 *   the company that uploaded it;
 * - never list the files (`GET /api/upload/files`): the admin does not need
 *   it, and the list mixes every company.
 *
 * API tokens are not users and have no company: their requests pass unchanged,
 * under the permissions of the token.
 */

const { errors } = require("@strapi/utils");
const { COMPANY_UID, COMPANY_CONTENT_UIDS } = require("./company-content");
const { callerCompanyId } = require("./company-scope");
const { fileOwnedBy, setFileOwner } = require("./file-ownership");

const { ForbiddenError, ValidationError } = errors;

const isApiToken = (ctx) => ctx.state?.auth?.strategy?.name === "api-token";

const isPresent = (value) =>
  value !== undefined && value !== null && value !== "";

/** A single integer id, or a 400 (`?id=1&id=2` gives an array). */
const toId = (value, name) => {
  const id = Number(value);
  if (Array.isArray(value) || !Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`Invalid "${name}"`);
  }
  return id;
};

/** Whether the entry `uid` / `id` belongs to `companyId`. */
const entryInCompany = async (uid, id, companyId) => {
  if (uid === COMPANY_UID) {
    return Number(id) === companyId;
  }
  if (!COMPANY_CONTENT_UIDS.includes(uid)) {
    return false;
  }
  const owned = await strapi.db.query(uid).findOne({
    select: ["id"],
    where: { id: { $eq: id }, company: { id: { $eq: companyId } } },
  });
  return !!owned;
};

const refuse = () => {
  throw new ForbiddenError("This file belongs to another company");
};

/** The ids of the files in the body of an upload response. */
const responseFileIds = (body) =>
  (Array.isArray(body) ? body : [body])
    .filter((file) => file && file.id !== undefined)
    .map((file) => file.id);

/** Middleware of `POST /api/upload`. */
const uploadTenancy = async (ctx, next) => {
  if (isApiToken(ctx)) {
    return next();
  }

  // an account without a company has nowhere to put a file
  const companyId = await callerCompanyId(ctx);

  const body = ctx.request.body || {};
  const { id } = ctx.query || {};
  const { ref, refId } = body;

  if (isPresent(id)) {
    if (!(await fileOwnedBy(toId(id, "id"), companyId))) {
      refuse();
    }
    // replacing or editing a file keeps its owner
    return next();
  }

  if (isPresent(ref) || isPresent(refId)) {
    if (typeof ref !== "string" || !isPresent(refId)) {
      throw new ValidationError('"ref" and "refId" go together');
    }
    if (!(await entryInCompany(ref, toId(refId, "refId"), companyId))) {
      throw new ForbiddenError('"refId" points at an entry of another company');
    }
  }

  await next();

  if (ctx.status >= 200 && ctx.status < 300) {
    await setFileOwner(responseFileIds(ctx.body), companyId);
  }
};

/** Middleware of `GET` and `DELETE /api/upload/files/:id`. */
const uploadFileTenancy = async (ctx, next) => {
  if (isApiToken(ctx)) {
    return next();
  }

  const companyId = await callerCompanyId(ctx);

  if (!(await fileOwnedBy(toId(ctx.params.id, "id"), companyId))) {
    refuse();
  }

  return next();
};

/** Middleware of `GET /api/upload/files`: the list is for API tokens only. */
const uploadListTenancy = async (ctx, next) => {
  if (isApiToken(ctx)) {
    return next();
  }
  throw new ForbiddenError("The list of files is not available to users");
};

module.exports = {
  entryInCompany,
  uploadTenancy,
  uploadFileTenancy,
  uploadListTenancy,
};
