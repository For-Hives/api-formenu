"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/categories_depth",
      handler: "depth.depth",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
