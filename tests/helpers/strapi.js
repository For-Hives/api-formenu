const Strapi = require("@strapi/strapi");
const fs = require("fs");
const _ = require("lodash");

let instance;

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/**
 * Setups strapi for further testing
 */
async function setupStrapi() {
  try {
    if (!instance) {
      const loadedStrapi = await Strapi().load();
      if (loadedStrapi) {
        instance = loadedStrapi;
        const mountResult = await instance.server.mount();
        if (!mountResult) {
          throw new Error("Failed to mount server");
        }
      } else {
        throw new Error("Failed to load Strapi");
      }
    }
    return instance;
  } catch (error) {
    console.error("Error setting up Strapi:", error);
    throw error;
  }
}

/**
 * Closes strapi after testing
 */
async function stopStrapi() {
  if (instance) {
    instance.destroy();

    const tmpDbFile = strapi.config.get(
      "database.connection.connection.filename"
    );

    if (fs.existsSync(tmpDbFile)) {
      fs.unlinkSync(tmpDbFile);
    }
  }
  return instance;
}

/**
 * Returns valid JWT token for authenticated
 * @param {String | number} idOrEmail, either user id, or email
 */
const jwt = (idOrEmail) =>
  strapi.plugins["users-permissions"].services.jwt.issue({
    [Number.isInteger(idOrEmail) ? "id" : "email"]: idOrEmail,
  });

/**
 * Grants database `permissions` table that role can access an endpoint/controllers
 *
 * @param {int} roleID, 1 Autentihected, 2 Public, etc
 * @param {string} value, in form or dot string eg `"permissions.users-permissions.controllers.auth.changepassword"`
 * @param {boolean} enabled, default true
 * @param {string} policy, default ''
 */
const grantPrivilege = async (
  roleID = 1,
  path,
  enabled = true,
  policy = ""
) => {
  const service = strapi.plugin("users-permissions").service("role");

  const role = await service.findOne(roleID);

  _.set(role.permissions, path, {enabled, policy});

  return service.updateRole(roleID, role);
};

/** Updates database `permissions` that role can access an endpoint
 * @see grantPrivilege
 */

const grantPrivileges = async (roleID = 1, values = []) => {
  await Promise.all(values.map((val) => grantPrivilege(roleID, val)));
};

/**
 * Updates the core of strapi
 * @param {*} pluginName
 * @param {*} key
 * @param {*} newValues
 * @param {*} environment
 */
const updatePluginStore = async (
  pluginName,
  key,
  newValues,
  environment = ""
) => {
  const pluginStore = strapi.store({
    environment: environment,
    type: "plugin",
    name: pluginName,
  });

  const oldValues = await pluginStore.get({key});
  const newValue = Object.assign({}, oldValues, newValues);

  return pluginStore.set({key: key, value: newValue});
};

/**
 * Get plugin settings from store
 * @param {*} pluginName
 * @param {*} key
 * @param {*} environment
 */
const getPluginStore = (pluginName, key, environment = "") => {
  const pluginStore = strapi.store({
    environment: environment,
    type: "plugin",
    name: pluginName,
  });

  return pluginStore.get({key});
};

/**
 * Check if response error contains error with given ID
 * @param {string} errorId ID of given error
 * @param {object} response Response object from strapi controller
 * @example
 *
 * const response =  {
      data: null,
      error: {
        status: 400,
        name: 'ApplicationError',
        message: 'Your account email is not confirmed',
        details: {}
      }
    }
 * responseHasError("ApplicationError", response) // true
 */
const responseHasError = (errorId, response) => {
  return response && response.error && response.error.name === errorId;
};

module.exports = {
  setupStrapi,
  stopStrapi,
  jwt,
  grantPrivilege,
  grantPrivileges,
  updatePluginStore,
  getPluginStore,
  responseHasError,
  sleep,
};
