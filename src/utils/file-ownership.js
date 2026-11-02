"use strict";

/**
 * Which company owns an uploaded file.
 *
 * The owner is written on the file (`ownerCompany`, a private column added to
 * `plugin::upload.file` by `src/extensions/upload/strapi-server.js`) when a
 * user uploads it through `POST /api/upload`: it is the company of that user.
 * It never changes afterwards, whatever the file gets linked to.
 *
 * It used to be deduced from the entries the file is linked to. Any company
 * could then make a file its own by linking it to one of its dishes
 * (`PUT /api/dishes/:id {image: <id>}`), and replace, delete or read it.
 * So a media field of the content API (dish image, category icon, menu image
 * and background, the `content` component of a company, the profile picture of
 * a user) only accepts:
 * - a file owned by the caller's company,
 * - or a file that is already the value of a media field of the entry being
 *   saved: the admin sends the whole entry back on save, and the files of the
 *   restaurants already in production have no owner yet.
 *
 * Files uploaded before this change have no owner. `backfillFileOwners`, run
 * at every start-up (src/index.js), records one when every entry the file is
 * linked to belongs to the same company. Until then, and for a file it cannot
 * settle, the same deduction is made on the fly: it is safe because an
 * ownerless file can no longer be linked to anything new through the content
 * API (see above), so its links were made by an operator or before this
 * change. A file linked to nothing, or to entries of several companies, has
 * no owner: no user can touch it.
 */

const { errors } = require("@strapi/utils");
const {
  COMPANY_UID,
  USER_UID,
  CONTENT_COMPONENT_UID,
  COMPANY_CONTENT_UIDS,
  relationIds,
  isPlainObject,
} = require("./company-content");

const { ForbiddenError, ValidationError } = errors;

const FILE_UID = "plugin::upload.file";
const OWNER_FIELD = "ownerCompany";

/** The company an entry a file is linked to belongs to, or null. */
const entryCompanyId = async (uid, id) => {
  if (uid === COMPANY_UID) {
    const company = await strapi.db
      .query(COMPANY_UID)
      .findOne({ select: ["id"], where: { id } });
    return company ? company.id : null;
  }
  if (COMPANY_CONTENT_UIDS.includes(uid) || uid === USER_UID) {
    const row = await strapi.db.query(uid).findOne({
      select: ["id"],
      where: { id },
      populate: { company: { select: ["id"] } },
    });
    return row && row.company ? row.company.id : null;
  }
  if (uid === CONTENT_COMPONENT_UID) {
    // the `content` of a company; the same component in the
    // `content-website` single type belongs to no company
    const company = await strapi.db.query(COMPANY_UID).findOne({
      select: ["id"],
      where: { content: { id } },
    });
    return company ? company.id : null;
  }
  return null;
};

/** The one company all `related` entries belong to, or null. */
const deducedOwner = async (related) => {
  if (!Array.isArray(related) || related.length === 0) {
    return null;
  }
  const owners = new Set();
  for (const entry of related) {
    const owner = await entryCompanyId(entry.__type, entry.id);
    if (owner === null) {
      return null;
    }
    owners.add(owner);
  }
  return owners.size === 1 ? [...owners][0] : null;
};

/**
 * `{ exists, owner }` for the file `fileId`: the recorded owner, or the one
 * deduced from its links for a file uploaded before owners were recorded.
 */
const fileOwner = async (fileId) => {
  const file = await strapi.db
    .query(FILE_UID)
    .findOne({ select: ["id", OWNER_FIELD], where: { id: fileId } });

  if (!file) {
    return { exists: false, owner: null };
  }
  if (file[OWNER_FIELD] !== null && file[OWNER_FIELD] !== undefined) {
    return { exists: true, owner: Number(file[OWNER_FIELD]) };
  }

  const withLinks = await strapi.db.query(FILE_UID).findOne({
    select: ["id"],
    where: { id: fileId },
    populate: { related: true },
  });
  return { exists: true, owner: await deducedOwner(withLinks.related) };
};

/**
 * Whether `companyId` owns the file. A file that does not exist is left to
 * the upload controller (404), unless `mustExist`.
 */
const fileOwnedBy = async (fileId, companyId, { mustExist = false } = {}) => {
  const { exists, owner } = await fileOwner(fileId);
  if (!exists) {
    return !mustExist;
  }
  return companyId !== null && companyId !== undefined && owner === companyId;
};

/** Records `companyId` as the owner of new files. */
const setFileOwner = async (fileIds, companyId) => {
  const ids = fileIds.map(Number).filter(Number.isInteger);
  if (ids.length === 0) {
    return;
  }
  await strapi.db.query(FILE_UID).updateMany({
    where: { id: { $in: ids }, [OWNER_FIELD]: { $null: true } },
    data: { [OWNER_FIELD]: companyId },
  });
};

/**
 * Records an owner on the files that have none, when every entry the file is
 * linked to belongs to the same company. Idempotent: a file that has an owner
 * is never read again, a file it cannot settle stays without one.
 */
const backfillFileOwners = async ({ pageSize = 100 } = {}) => {
  let lastId = 0;
  let assigned = 0;
  let unsettled = 0;

  for (;;) {
    const files = await strapi.db.query(FILE_UID).findMany({
      select: ["id"],
      where: { [OWNER_FIELD]: { $null: true }, id: { $gt: lastId } },
      orderBy: { id: "asc" },
      limit: pageSize,
      populate: { related: true },
    });
    if (files.length === 0) {
      break;
    }
    for (const file of files) {
      lastId = file.id;
      const owner = await deducedOwner(file.related);
      if (owner === null) {
        unsettled += 1;
        continue;
      }
      await strapi.db.query(FILE_UID).update({
        where: { id: file.id },
        data: { [OWNER_FIELD]: owner },
      });
      assigned += 1;
    }
  }

  return { assigned, unsettled };
};

/**
 * Every file id written in the media fields of `data`, components and
 * dynamic zones included. Works on a body as well as on a populated entry.
 */
const mediaIds = (model, data, out = new Set(), depth = 0) => {
  if (!model || !isPlainObject(data) || depth > 5) {
    return out;
  }
  for (const [key, attribute] of Object.entries(model.attributes)) {
    if (!(key in data)) {
      continue;
    }
    const value = data[key];
    if (attribute.type === "media") {
      for (const id of relationIds(value)) {
        out.add(id);
      }
    } else if (attribute.type === "component") {
      const component = strapi.components[attribute.component];
      const items = attribute.repeatable
        ? Array.isArray(value)
          ? value
          : []
        : [value];
      for (const item of items) {
        mediaIds(component, item, out, depth + 1);
      }
    } else if (attribute.type === "dynamiczone" && Array.isArray(value)) {
      for (const item of value) {
        if (isPlainObject(item)) {
          mediaIds(strapi.components[item.__component], item, out, depth + 1);
        }
      }
    }
  }
  return out;
};

/** A `populate` reaching every media field of `model`. */
const mediaPopulate = (model, depth = 0) => {
  const populate = {};
  if (!model || depth > 5) {
    return populate;
  }
  for (const [key, attribute] of Object.entries(model.attributes)) {
    if (attribute.type === "media") {
      populate[key] = true;
    } else if (attribute.type === "component") {
      const nested = mediaPopulate(
        strapi.components[attribute.component],
        depth + 1
      );
      if (Object.keys(nested).length > 0) {
        populate[key] = { populate: nested };
      }
    } else if (attribute.type === "dynamiczone") {
      populate[key] = { populate: "*" };
    }
  }
  return populate;
};

/**
 * Refuses a write whose media fields name a file the caller's company does
 * not own, unless that file is already on the entry `entryId` (see the top of
 * this file).
 */
const assertMediaInCompany = async (uid, data, companyId, { entryId } = {}) => {
  const model = strapi.getModel(uid);
  const ids = [...mediaIds(model, data)].map(Number);

  if (ids.some((id) => !Number.isInteger(id))) {
    throw new ValidationError("Invalid file id in a media field");
  }

  let refused = [];
  for (const id of new Set(ids)) {
    if (!(await fileOwnedBy(id, companyId, { mustExist: true }))) {
      refused.push(id);
    }
  }
  if (refused.length === 0) {
    return;
  }

  if (entryId !== undefined && entryId !== null) {
    const populate = mediaPopulate(model);
    const entry = await strapi.entityService.findOne(uid, entryId, {
      populate,
    });
    const current = new Set([...mediaIds(model, entry || {})].map(Number));
    refused = refused.filter((id) => !current.has(id));
  }

  if (refused.length > 0) {
    throw new ForbiddenError("A media field points at a file of another company");
  }
};

module.exports = {
  FILE_UID,
  OWNER_FIELD,
  entryCompanyId,
  deducedOwner,
  fileOwner,
  fileOwnedBy,
  setFileOwner,
  backfillFileOwners,
  mediaIds,
  assertMediaInCompany,
};
