"use strict";

const { sanitizeOutput } = require("../../../utils/sanitize-output");

module.exports = {
  async allCompany(ctx, next) {
    try {
      const data = await strapi
        .service("api::company.all-company")
        .allCompany();

      ctx.body = await sanitizeOutput(data, "api::company.company");
    } catch (err) {
      console.log(err);
      ctx.badRequest("get all company error", {
        moreDetails: err.message,
      });
    }
  },
};
