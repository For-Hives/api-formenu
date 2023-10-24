'use strict';

/**
 * A set of functions called "actions" for `me`
 */

module.exports = {
  async updateMe(ctx, next) {
    try {
      const json = ctx.request.body;

      const data = await strapi
        .service("api::me.me")
        .updateMe(ctx.state.user, json);
      ctx.body = data;
    } catch (err) {
      console.log(err);
      ctx.badRequest("updating Makeup Artist error", {
        moreDetails: err.message,
      });
    }
  }
};
