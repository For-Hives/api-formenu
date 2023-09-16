"use strict"

module.exports= {
  async depth(ctx, next) {
    try {
      const data = await strapi
        .service("api::category.depth")

      ctx.body = data;
    } catch (err) {
      console.log(err);
      ctx.badRequest("get depth error", {
        moreDetails: err.message,
      });
    }
  },
}
