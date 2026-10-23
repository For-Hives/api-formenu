'use strict';

/**
 * A set of functions called "actions" for `me`
 */

const { sanitizeCurrentUser } = require('../../../utils/sanitize-output');

module.exports = {
  async updateMe(ctx, next) {
    try {
      const json = ctx.request.body;

      const data = await strapi
        .service("api::me.me")
        .updateMe(ctx.state.user, json);
      // entityService returns the raw row: never send the password hash or the tokens back
      ctx.body = await sanitizeCurrentUser(data, ctx.state.auth);
    } catch (err) {
      console.log(err);
      ctx.badRequest("updating Profile error", {
        moreDetails: err.message,
      });
    }
  }
};
