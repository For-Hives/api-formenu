"use strict";

module.exports = {
    routes: [
        {
            method: "GET",
            path: "/my-categories",
            handler: "custom-category.findMyCategories",
            config: {
                policies: [],
                middlewares: [
                    "api::category.company-tenancy"
                ],
            },
        },
    ],
};