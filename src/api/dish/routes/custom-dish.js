"use strict";

module.exports = {
    routes: [
        {
            method: "GET",
            path: "/my-dishes",
            handler: "custom-dish.findMyDishes",
            config: {
                policies: [],
                middlewares: [
                    "api::dish.company-tenancy"
                ],
            },
        },
    ],
};