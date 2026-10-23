"use strict";

const { sanitizeOutput } = require("../../../utils/sanitize-output");

module.exports = {
  async allMenu(ctx, next) {
    try {
      const data = await strapi
        .service("api::menu.all-menu")
        .allMenu();

      ctx.body = await sanitizeOutput(data, "api::menu.menu");
    } catch (err) {
      console.log(err);
      ctx.badRequest("get all menu error", {
        moreDetails: err.message,
      });
    }
  },
};
