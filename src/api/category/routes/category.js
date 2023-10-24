'use strict';

/**
 * category router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::category.category',
  {
    config: {
      update: {
        middlewares: ["api::category.company-tenancy"],
      },
      delete: {
        middlewares: ["api::category.company-tenancy"],
      },
      findOne: {
        middlewares: ["api::category.company-tenancy"],
      }
    }
  });
