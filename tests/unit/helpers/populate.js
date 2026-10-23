"use strict";

/**
 * Helpers to reason about the `populate` object given to entityService.
 */

const POPULATE_OPTIONS = ["fields", "populate", "sort", "filters"];
const NON_SCALAR_TYPES = ["relation", "media", "component", "dynamiczone"];

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Paths of every key named `name` in `value`, at any depth. */
const findKeyPaths = (value, name, path = "$") => {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => [
    ...(key === name ? [`${path}.${key}`] : []),
    ...findKeyPaths(child, name, `${path}.${key}`),
  ]);
};

/** Paths of every wildcard ('*') in `value`, at any depth. */
const findWildcards = (value, path = "$") => {
  if (value === "*") {
    return [path];
  }

  if (!isPlainObject(value) && !Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    findWildcards(child, `${path}.${key}`)
  );
};

const targetOf = (attribute) => {
  if (attribute.type === "relation") return attribute.target;
  if (attribute.type === "media") return "plugin::upload.file";
  if (attribute.type === "component") return attribute.component;
  return undefined;
};

/**
 * Checks a populate object against the schemas, the way a reviewer would.
 * Strapi silently ignores what it does not know, so a misplaced or misspelled
 * key never fails at runtime: it has to be caught here.
 *
 * @returns {string[]} one message per problem, empty when the populate is valid
 */
const validatePopulate = (populate, uid, getModel, path = "populate") => {
  const schema = getModel(uid);
  const errors = [];

  for (const [key, node] of Object.entries(populate)) {
    const here = `${path}.${key}`;
    const attribute = schema.attributes[key];
    const target = attribute && targetOf(attribute);

    if (!target) {
      errors.push(`${here}: not a relation, media or component of ${uid}`);
      continue;
    }

    if (node === true) {
      continue;
    }

    if (!isPlainObject(node)) {
      errors.push(`${here}: expected true or an object`);
      continue;
    }

    for (const option of Object.keys(node)) {
      if (!POPULATE_OPTIONS.includes(option)) {
        errors.push(`${here}.${option}: not a populate option, it is ignored`);
      }
    }

    const targetSchema = getModel(target);

    for (const field of node.fields || []) {
      const fieldAttribute = targetSchema.attributes[field];
      const isScalar =
        field === "id" ||
        (fieldAttribute && !NON_SCALAR_TYPES.includes(fieldAttribute.type));

      if (!isScalar) {
        errors.push(`${here}.fields: "${field}" is not a field of ${target}`);
      }
    }

    if (node.populate !== undefined) {
      if (!isPlainObject(node.populate)) {
        errors.push(`${here}.populate: expected an explicit object`);
      } else {
        errors.push(...validatePopulate(node.populate, target, getModel, here));
      }
    }
  }

  return errors;
};

module.exports = { findKeyPaths, findWildcards, validatePopulate };
