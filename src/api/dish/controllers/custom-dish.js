"use strict";

module.exports = {
    async findMyDish(ctx, next) {
        try {
            const user = ctx.state.user; // ou ctx.request.user, selon votre configuration d'authentification

            if (!user) {
                return ctx.badRequest("No authenticated user found");
            }

            ctx.body = await strapi
                .service("api::dish.custom-dish")
                .findMyDish(user);
        } catch (err) {
            ctx.badRequest("Error in fetching dishes by company", {
                moreDetails: err.message,
            });
        }
    },
};