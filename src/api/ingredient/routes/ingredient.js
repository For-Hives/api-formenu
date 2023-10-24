'use strict';

/**
 * ingredient router
 */

const {createCoreRouter} = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::ingredient.ingredient', {
  config: {
    update: {
      middlewares: ["api::ingredient.company-tenancy"],
    }, delete: {
      middlewares: ["api::ingredient.company-tenancy"],
    }, findOne: {
      middlewares: ["api::ingredient.company-tenancy"],
    }
  }
});
