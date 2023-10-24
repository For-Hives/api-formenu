'use strict';

/**
 * dish router
 */

const {createCoreRouter} = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::dish.dish', {
  config: {
    update: {
      middlewares: ["api::dish.company-tenancy"],
    }, delete: {
      middlewares: ["api::dish.company-tenancy"],
    }, findOne: {
      middlewares: ["api::dish.company-tenancy"],
    }
  }
  });
