"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/menu-deep/:id",
      handler: "custom-menu.menuDeep",
      config: {
        policies: [],
        middlewares: [
          "api::menu.company-tenancy"
        ],
      },
    },
  ],
};
