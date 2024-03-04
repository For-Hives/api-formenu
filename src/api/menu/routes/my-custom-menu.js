"use strict";

module.exports = {
    routes: [
        {
            method: "GET",
            path: "/my-menus",
            handler: "my-custom-menu.findMyMenus",
            config: {
                policies: [],
                middlewares: [
                    "api::menu.company-tenancy"
                ],
            },
        },
    ],
};