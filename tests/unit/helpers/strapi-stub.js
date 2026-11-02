"use strict";

/**
 * A minimal `strapi` global for the unit tests: no database, no boot.
 *
 * The models are built from the real schema.json files of this repository,
 * completed with the attributes Strapi adds when it loads a content type
 * (timestamps, private creator fields, i18n fields), and with trimmed down
 * copies of the plugin models the sanitizer meets (upload file, role, admin
 * user).
 */

const path = require("path");

const SRC = path.join(__dirname, "..", "..", "..", "src");

const creatorField = () => ({
  type: "relation",
  relation: "oneToOne",
  target: "admin::user",
  configurable: false,
  writable: false,
  visible: false,
  useJoinTable: false,
  private: true,
});

const contentType = (uid, schema) => {
  const model = JSON.parse(JSON.stringify(schema));

  Object.assign(model, { uid, modelType: "contentType" });
  Object.assign(model.attributes, {
    createdAt: { type: "datetime" },
    updatedAt: { type: "datetime" },
    createdBy: creatorField(),
    updatedBy: creatorField(),
  });

  // what the i18n plugin adds to a localized content type
  if (model.pluginOptions?.i18n?.localized) {
    Object.assign(model.attributes, {
      localizations: { type: "relation", relation: "oneToMany", target: uid },
      locale: { type: "string" },
    });
  }

  return model;
};

const apiContentType = (name) =>
  contentType(
    `api::${name}.${name}`,
    require(path.join(SRC, "api", name, "content-types", name, "schema.json"))
  );

const buildModels = () => {
  const models = {};

  for (const name of [
    "company",
    "menu",
    "category",
    "dish",
    "ingredient",
    "type-dish",
  ]) {
    const model = apiContentType(name);
    models[model.uid] = model;
  }

  models["plugin::users-permissions.user"] = contentType(
    "plugin::users-permissions.user",
    require(path.join(
      SRC,
      "extensions/users-permissions/content-types/user/schema.json"
    ))
  );

  models["plugin::users-permissions.role"] = contentType(
    "plugin::users-permissions.role",
    {
      attributes: {
        name: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        users: {
          type: "relation",
          relation: "oneToMany",
          target: "plugin::users-permissions.user",
          mappedBy: "role",
        },
      },
    }
  );

  models["admin::user"] = contentType("admin::user", {
    attributes: {
      firstname: { type: "string" },
      lastname: { type: "string" },
      username: { type: "string" },
      email: { type: "email", private: true },
      password: { type: "password", private: true },
      resetPasswordToken: { type: "string", private: true },
      registrationToken: { type: "string", private: true },
    },
  });

  models["plugin::upload.file"] = contentType("plugin::upload.file", {
    attributes: {
      name: { type: "string" },
      alternativeText: { type: "string" },
      caption: { type: "string" },
      width: { type: "integer" },
      height: { type: "integer" },
      formats: { type: "json" },
      hash: { type: "string" },
      ext: { type: "string" },
      mime: { type: "string" },
      size: { type: "decimal" },
      url: { type: "string" },
      previewUrl: { type: "string" },
      provider: { type: "string" },
      provider_metadata: { type: "json" },
      related: { type: "relation", relation: "morphToMany" },
      folder: {
        type: "relation",
        relation: "manyToOne",
        target: "plugin::upload.folder",
        private: true,
      },
      folderPath: { type: "string", private: true },
    },
  });

  models["content-website.content-website"] = {
    uid: "content-website.content-website",
    modelType: "component",
    ...JSON.parse(
      JSON.stringify(
        require(path.join(
          SRC,
          "components/content-website/content-website.json"
        ))
      )
    ),
  };

  return models;
};

/**
 * @param {object} [overrides] extra properties of the stub (entityService,
 * service...), and `models` to add content types to the default ones
 */
const createStrapiStub = ({ models: extraModels = {}, ...overrides } = {}) => {
  const models = { ...buildModels(), ...extraModels };

  return {
    getModel: jest.fn((uid) => models[uid]),
    // Strapi's content API sanitizer reads both
    sanitizers: { get: () => [] },
    config: { get: (key, defaultValue) => defaultValue },
    ...overrides,
  };
};

module.exports = { createStrapiStub };
