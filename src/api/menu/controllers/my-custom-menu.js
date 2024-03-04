"use strict";

module.exports = {
    async findMyCategories(ctx, next) {
        try {
            const user = ctx.state.user; // ou ctx.request.user, selon votre configuration d'authentification

            if (!user) {
                return ctx.badRequest("No authenticated user found");
            }

            const data = await strapi
                .service("api::category.custom-category")
                .findMyCategories(user);

            ctx.body = data;
        } catch (err) {
            ctx.badRequest("Error in fetching categories by company", {
                moreDetails: err.message,
            });
        }
    },
};