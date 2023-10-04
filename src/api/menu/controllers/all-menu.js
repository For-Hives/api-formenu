"use strict";

module.exports = {
  async allMenu(ctx, next) {
    try {
      const data = await strapi
        .service("api::menu.all-menu")
        .allMenu();

      ctx.body = data;
    } catch (err) {
      console.log(err);
      ctx.badRequest("get all menu error", {
        moreDetails: err.message,
      });
    }
  },
};
