"use strict";

module.exports = {
    async findMyIngredients(ctx, next) {
        console.log('(controller) findMyIngredients - ctx.state.user', ctx.state.user);
        try {
            const user = ctx.state.user; // ou ctx.request.user, selon votre configuration d'authentification

            if (!user) {
                return ctx.badRequest("No authenticated user found");
            }

            const data = await strapi
                .service("api::ingredient.custom-ingredient")
                .findMyIngredients(user);

            console.log('(controller) findMyIngredients - ingredients', data);

            ctx.body = data;
        } catch (err) {
            console.log(err);
            ctx.badRequest("Error in fetching ingredients by company", {
                moreDetails: err.message,
            });
        }
    },
};