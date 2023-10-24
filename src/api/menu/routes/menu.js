'use strict';

/**
 * menu router
 */

const {createCoreRouter} = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::menu.menu',
  {
    config: {
      update: {
        middlewares: ["api::menu.company-tenancy"],
      },
      delete: {
        middlewares: ["api::menu.company-tenancy"],
      },
      findOne: {
        middlewares: ["api::menu.company-tenancy"],
      }
    }
  }
);

