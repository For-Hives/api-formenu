"use strict";

/**
 * What belongs to a company, shared by `company-scope`, `file-ownership` and
 * `upload-tenancy`.
 */

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
 * Every id a relation or media input points at, whatever the shape Strapi
 * accepts: `3`, `"3"`, `[3, 4]`, `{ id: 3 }`, `[{ id: 3 }]`, a whole file
 * object, `{ connect: [...], set: [...] }`. A `disconnect` only removes
 * links, so it is not returned.
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

module.exports = {
  USER_UID,
  COMPANY_UID,
  CONTENT_COMPONENT_UID,
  COMPANY_CONTENT_UIDS,
  isPlainObject,
  relationIds,
};
