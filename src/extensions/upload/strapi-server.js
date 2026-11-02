"use strict";

const {
  uploadTenancy,
  uploadFileTenancy,
  uploadListTenancy,
} = require("../../utils/upload-tenancy");
const { OWNER_FIELD } = require("../../utils/file-ownership");

/**
 * - Adds `ownerCompany` to the files: the id of the company whose user
 *   uploaded the file (see `src/utils/file-ownership.js`). A plain integer,
 *   private: it never leaves the API, cannot be written through `fileInfo`,
 *   and does not open a path from an image to its company in deep populates.
 * - Adds the company checks of `src/utils/upload-tenancy.js` to the upload
 *   routes of the content API (`/api/upload`). The admin panel routes of the
 *   plugin are not touched.
 */
module.exports = (plugin) => {
  plugin.contentTypes.file.schema.attributes[OWNER_FIELD] = {
    type: "integer",
    private: true,
    configurable: false,
    visible: false,
  };

  const { routes } = plugin.routes["content-api"];

  const guard = (method, path, middleware) => {
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) {
      throw new Error(`upload route ${method} ${path} not found`);
    }
    route.config = route.config || {};
    route.config.middlewares = [...(route.config.middlewares || []), middleware];
  };

  guard("POST", "/", uploadTenancy);
  guard("GET", "/files", uploadListTenancy);
  guard("GET", "/files/:id", uploadFileTenancy);
  guard("DELETE", "/files/:id", uploadFileTenancy);

  return plugin;
};
