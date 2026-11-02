const fs = require("fs");
const {setupStrapi, stopStrapi} = require("./helpers/strapi");
const {beforeAll, afterAll, expect} = require("@jest/globals");
beforeAll(async () => {
  await setupStrapi();
}, 20000);

afterAll(async () => {
  await stopStrapi();
});

it("strapi is defined", () => {
  expect(strapi).toBeDefined();
});

require("./controllers/user");
require("./controllers/company-scope");
require("./controllers/upload");
// todo fix this test

