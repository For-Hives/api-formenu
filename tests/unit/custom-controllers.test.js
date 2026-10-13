"use strict";

const fs = require("fs");
const path = require("path");
const {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} = require("@jest/globals");

const { createStrapiStub } = require("./helpers/strapi-stub");
const {
  poisonedUser,
  poisonedCompany,
  poisonedCompanies,
  poisonedMenu,
  poisonedDish,
  poisonedIngredient,
  poisonedCategories,
  expectClean,
} = require("./helpers/poisoned");

const API_DIR = path.join(__dirname, "..", "..", "src", "api");

const ownUser = () => ({
  ...poisonedUser(1),
  username: "owner",
  email: "owner@example.com",
  firstname: "Olive",
  lastname: "Owner",
  phoneNumber: "0000000000",
  // more than the service returns today: other users must never follow
  company: { ...poisonedCompany(), id: 7, slug: "chez-test" },
});

/**
 * Every custom controller of the API. Each one is given a service that
 * returns raw, poisoned records (as if a populate had gone wrong in the
 * service) and must still answer with a clean body.
 */
const CUSTOM_CONTROLLERS = [
  {
    route: "GET /api/all-company",
    file: "company/controllers/all-company.js",
    action: "allCompany",
    service: ["api::company.all-company", "allCompany"],
    model: "api::company.company",
    raw: poisonedCompanies,
    expected: [{ id: 1, slug: "chez-test", menus: [{ id: 10 }] }],
  },
  {
    route: "GET /api/all-menu",
    file: "menu/controllers/all-menu.js",
    action: "allMenu",
    service: ["api::menu.all-menu", "allMenu"],
    model: "api::menu.menu",
    raw: () => [poisonedMenu()],
    expected: [{ id: 10, title: "La carte" }],
  },
  {
    route: "GET /api/menu-deep/:id",
    file: "menu/controllers/custom-menu.js",
    action: "menuDeep",
    service: ["api::menu.custom-menu", "menuDeep"],
    model: "api::menu.menu",
    raw: poisonedMenu,
    expected: {
      id: 10,
      title: "La carte",
      categories: [
        { id: 100, dishes: [] },
        { id: 101, dishes: [{ id: 1000 }] },
      ],
    },
  },
  {
    route: "GET /api/my-menus",
    file: "menu/controllers/my-custom-menu.js",
    action: "findMyMenus",
    service: ["api::menu.my-custom-menu", "findMyMenus"],
    model: "api::menu.menu",
    raw: () => [poisonedMenu()],
    expected: [{ id: 10, title: "La carte" }],
  },
  {
    route: "GET /api/my-dish",
    file: "dish/controllers/custom-dish.js",
    action: "findMyDish",
    service: ["api::dish.custom-dish", "findMyDish"],
    model: "api::dish.dish",
    raw: () => [poisonedDish()],
    expected: [
      {
        id: 1000,
        name: "Burger",
        description: "A burger",
        price: 12.5,
        activated: true,
        is_allergen_shellfishes: true,
        is_vegetarian: false,
        is_vegan: false,
        ingredients: [{ id: 500, name: "Tomate" }],
        category: { id: 101 },
        type_dish: { id: 5 },
        image: { id: 20, url: "https://cdn.example.com/burger.png" },
      },
    ],
  },
  {
    route: "GET /api/my-categories",
    file: "category/controllers/custom-category.js",
    action: "findMyCategories",
    service: ["api::category.custom-category", "findMyCategories"],
    model: "api::category.category",
    raw: poisonedCategories,
    expected: [
      { id: 100, name: "Plats", order: 1, depth: 0, dishes: [] },
      {
        id: 101,
        name: "Burgers",
        order: 1,
        depth: 1,
        category: { id: 100 },
        dishes: [{ id: 1000, name: "Burger" }],
      },
    ],
  },
  {
    route: "GET /api/my-ingredients",
    file: "ingredient/controllers/custom-ingredient.js",
    action: "findMyIngredients",
    service: ["api::ingredient.custom-ingredient", "findMyIngredients"],
    model: "api::ingredient.ingredient",
    raw: () => [poisonedIngredient(500, "Tomate")],
    expected: [
      {
        id: 500,
        name: "Tomate",
        activated: true,
        available_date_start: null,
        available_date_end: null,
      },
    ],
  },
  {
    route: "POST /api/users/me",
    file: "me/controllers/me.js",
    action: "updateMe",
    service: ["api::me.me", "updateMe"],
    model: "plugin::users-permissions.user",
    raw: ownUser,
    expected: {
      id: 1,
      username: "owner",
      email: "owner@example.com",
      firstname: "Olive",
      lastname: "Owner",
      phoneNumber: "0000000000",
      company: { id: 7, name: "Nested company", slug: "chez-test" },
    },
  },
];

const createContext = () => ({
  state: { user: { id: 1 } },
  params: { id: "10" },
  request: { body: { firstname: "Olive" } },
  badRequest: jest.fn(),
});

const callController = async ({ file, action, service, raw }, strapiStub) => {
  const [serviceUid, serviceMethod] = service;
  const method = jest.fn().mockResolvedValue(raw());

  global.strapi = {
    ...strapiStub,
    service: jest.fn((uid) =>
      uid === serviceUid ? { [serviceMethod]: method } : undefined
    ),
  };

  const ctx = createContext();
  await require(path.join(API_DIR, file))[action](ctx);

  return { ctx, method };
};

beforeEach(() => {
  // the controllers log the errors they catch
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.strapi;
});

describe("custom controllers", () => {
  it("are all listed here: a new custom controller needs a sanitizer test", () => {
    const customControllers = fs
      .readdirSync(API_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const directory = path.join(API_DIR, entry.name, "controllers");

        return fs.existsSync(directory)
          ? fs
              .readdirSync(directory)
              .filter((file) => file.endsWith(".js"))
              .map((file) => `${entry.name}/controllers/${file}`)
          : [];
      })
      // the core controllers are sanitized by Strapi itself
      .filter(
        (file) =>
          !fs
            .readFileSync(path.join(API_DIR, file), "utf8")
            .includes("createCoreController")
      );

    expect(customControllers.sort()).toEqual(
      CUSTOM_CONTROLLERS.map(({ file }) => file).sort()
    );
  });

  describe.each(CUSTOM_CONTROLLERS)("$route", (controller) => {
    it("sends a sanitized body, whatever the service returns", async () => {
      const { ctx, method } = await callController(
        controller,
        createStrapiStub()
      );

      expect(method).toHaveBeenCalledTimes(1);
      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(global.strapi.getModel).toHaveBeenCalledWith(controller.model);
      expectClean(ctx.body);
    });

    it("keeps the flat shape and the fields the clients read", async () => {
      const { ctx } = await callController(controller, createStrapiStub());

      expect(Array.isArray(ctx.body)).toBe(Array.isArray(controller.raw()));
      expect(ctx.body).toMatchObject(controller.expected);
    });

    it("sends no body at all when the output cannot be sanitized", async () => {
      // a Strapi that does not know the content type: the sanitizer throws
      const { ctx } = await callController(
        controller,
        createStrapiStub({ getModel: jest.fn(() => undefined) })
      );

      expect(ctx.body).toBeUndefined();
      expect(ctx.badRequest).toHaveBeenCalledTimes(1);
    });
  });
});
