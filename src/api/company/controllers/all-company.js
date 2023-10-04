"use strict";

module.exports = {
  async allCompany(ctx, next) {
    try {
      const data = await strapi
        .service("api::company.all-company")
        .allCompany();

      ctx.body = data;
    } catch (err) {
      console.log(err);
      ctx.badRequest("get all company error", {
        moreDetails: err.message,
      });
    }
  },
};
