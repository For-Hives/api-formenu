'use strict';

/**
 * company router
 */

const {createCoreRouter} = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::company.company', {
  config: {
    update: {
      middlewares: ["api::company.company-tenancy"],
    }, delete: {
      middlewares: ["api::company.company-tenancy"],
    }, findOne: {
      middlewares: ["api::company.company-tenancy"],
    }
  }
});
