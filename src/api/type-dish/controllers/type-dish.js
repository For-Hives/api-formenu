'use strict';

/**
 * type-dish controller
 *
 * Dish types are shared by every company (no `company` field): users read
 * them, but only an operator (Strapi admin panel, or an API token) writes
 * them, otherwise a restaurant could rename or delete the types the menus of
 * the others use.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { errors } = require('@strapi/utils');

const refuseUsers = (ctx) => {
  if (ctx.state?.auth?.strategy?.name !== 'api-token') {
    throw new errors.ForbiddenError('Dish types are shared and read-only.');
  }
};

module.exports = createCoreController('api::type-dish.type-dish', () => ({
  async create(ctx) {
    refuseUsers(ctx);
    return super.create(ctx);
  },
  async update(ctx) {
    refuseUsers(ctx);
    return super.update(ctx);
  },
  async delete(ctx) {
    refuseUsers(ctx);
    return super.delete(ctx);
  },
}));
