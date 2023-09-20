"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/all-menu",
      handler: "all-menu.allMenu",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
