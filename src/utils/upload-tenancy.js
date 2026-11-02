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
 * This middleware lets a user:
 * - upload without `ref` / `refId` (what the admin does), unchanged;
 * - attach a new file only to an entry of their company (menu, category,
 *   dish, ingredient, or their company itself);
 * - replace, edit, read or delete one file only when every entry it is linked
 *   to belongs to their company. A file linked to nothing has no known owner:
 *   it is refused. A file shared with an entry of another company is refused
 *   too, otherwise linking someone else's file to one's own dish would open it.
 *
 * API tokens are not users and have no company: their requests pass unchanged,
 * under the permissions of the token.
 */

const { errors } = require("@strapi/utils");
const { COMPANY_CONTENT_UIDS, callerCompanyId } = require("./company-scope");

const { ForbiddenError, ValidationError } = errors;

const FILE_UID = "plugin::upload.file";
const COMPANY_UID = "api::company.company";

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

/**
 * Whether the file `fileId` is linked to entries of `companyId` only.
 * A file that does not exist is left to the upload controller (404).
 */
const fileInCompany = async (fileId, companyId) => {
  const file = await strapi.db.query(FILE_UID).findOne({
    select: ["id"],
    where: { id: fileId },
    populate: { related: true },
  });

  if (!file) {
    return true;
  }

  const related = file.related || [];
  if (related.length === 0) {
    return false;
  }

  for (const entry of related) {
    if (!(await entryInCompany(entry.__type, entry.id, companyId))) {
      return false;
    }
  }
  return true;
};

const refuse = () => {
  throw new ForbiddenError("This file belongs to another company");
};

/** Middleware of `POST /api/upload`. */
const uploadTenancy = async (ctx, next) => {
  if (isApiToken(ctx)) {
    return next();
  }

  const body = ctx.request.body || {};
  const { id } = ctx.query || {};
  const { ref, refId } = body;

  if (!isPresent(id) && !isPresent(ref) && !isPresent(refId)) {
    // a plain upload, as admin-formenu sends it
    return next();
  }

  const companyId = await callerCompanyId(ctx);

  if (isPresent(id)) {
    if (!(await fileInCompany(toId(id, "id"), companyId))) {
      refuse();
    }
  }

  if (isPresent(ref) || isPresent(refId)) {
    if (typeof ref !== "string" || !isPresent(refId)) {
      throw new ValidationError('"ref" and "refId" go together');
    }
    if (!(await entryInCompany(ref, toId(refId, "refId"), companyId))) {
      throw new ForbiddenError('"refId" points at an entry of another company');
    }
  }

  return next();
};

/** Middleware of `GET` and `DELETE /api/upload/files/:id`. */
const uploadFileTenancy = async (ctx, next) => {
  if (isApiToken(ctx)) {
    return next();
  }

  const companyId = await callerCompanyId(ctx);

  if (!(await fileInCompany(toId(ctx.params.id, "id"), companyId))) {
    refuse();
  }

  return next();
};

module.exports = {
  entryInCompany,
  fileInCompany,
  uploadTenancy,
  uploadFileTenancy,
};
