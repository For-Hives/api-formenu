'use strict';

/**
 * content-website service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::content-website.content-website');
