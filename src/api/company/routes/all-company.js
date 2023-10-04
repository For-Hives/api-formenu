"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/all-company",
      handler: "all-company.allCompany",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
