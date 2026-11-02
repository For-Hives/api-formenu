"use strict";

const {
  uploadTenancy,
  uploadFileTenancy,
} = require("../../utils/upload-tenancy");

/**
 * Adds the company checks of `src/utils/upload-tenancy.js` to the upload
 * routes of the content API (`/api/upload`). The admin panel routes of the
 * plugin are not touched.
 */
module.exports = (plugin) => {
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
  guard("GET", "/files/:id", uploadFileTenancy);
  guard("DELETE", "/files/:id", uploadFileTenancy);

  return plugin;
};
