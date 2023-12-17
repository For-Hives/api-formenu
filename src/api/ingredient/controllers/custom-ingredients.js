module.exports = {
    async findMyIngredients(ctx, next) {
        try {
            const user = ctx.state.user; // ou ctx.request.user, selon votre configuration d'authentification

            if (!user) {
                return ctx.badRequest("No authenticated user found");
            }

            const data = await strapi
                .service("api::ingredient.custom-ingredient")
                .findMyIngredients(user);

            ctx.body = data;
        } catch (err) {
            console.log(err);
            ctx.badRequest("Error in fetching ingredients by company", {
                moreDetails: err.message,
            });
        }
    },
};