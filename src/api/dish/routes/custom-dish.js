"use strict";

module.exports = {
    routes: [
        {
            method: "GET",
            path: "/my-dish",
            handler: "custom-dish.findMyDish",
            config: {
                policies: [],
                middlewares: [
                    "api::dish.company-tenancy"
                ],
            },
        },
    ],
};