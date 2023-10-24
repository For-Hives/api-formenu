"use strict";

module.exports = {
  async menuDeep(ctx, next) {
    try {
      const id = ctx.params.id;

      const data = await strapi
        .service("api::menu.custom-menu")
        .menuDeep(id);

      ctx.body = data;
    } catch (err) {
      console.log(err);
      ctx.badRequest("get menu-deep error", {
        moreDetails: err.message,
      });
    }
  },
};
