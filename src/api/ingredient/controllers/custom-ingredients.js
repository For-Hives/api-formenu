module.exports = {
    routes: [
        {
            method: "GET",
            path: "/my-ingredients",
            handler: "custom-ingredient.findMyIngredients",
            config: {
                policies: [],
                middlewares: [
                    "api::ingredient.company-tenancy"
                ],
            },
        },
    ],
};