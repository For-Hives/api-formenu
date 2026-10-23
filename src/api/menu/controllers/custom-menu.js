"use strict";

const { sanitizeOutput } = require("../../../utils/sanitize-output");

module.exports = {
  async menuDeep(ctx, next) {
    try {
      const id = ctx.params.id;

      const data = await strapi
        .service("api::menu.custom-menu")
        .menuDeep(id);

      ctx.body = await sanitizeOutput(data, "api::menu.menu");
    } catch (err) {
      console.log(err);
      ctx.badRequest("get menu-deep error", {
        moreDetails: err.message,
      });
    }
  },
};
