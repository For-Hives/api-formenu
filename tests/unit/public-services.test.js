"use strict";

const { describe, it, expect, afterEach } = require("@jest/globals");
const { convertQueryParams } = require("@strapi/utils");

const allCompanyService = require("../../src/api/company/services/all-company");
const allMenuService = require("../../src/api/menu/services/all-menu");
const {
  INGREDIENT_FIELDS,
  SIDE_DISH_FIELDS,
} = require("../../src/utils/public-fields");
const { createStrapiStub } = require("./helpers/strapi-stub");
const {
  findKeyPaths,
  findWildcards,
  validatePopulate,
} = require("./helpers/populate");
const {
  poisonedCompanies,
  poisonedMenu,
  expectClean,
  expectAllCompanyShape,
} = require("./helpers/poisoned");

// The services only use the global `strapi.entityService`: no boot, no database.
const mockStrapi = (rows) => {
  global.strapi = createStrapiStub({
    entityService: { findMany: jest.fn().mockResolvedValue(rows) },
  });

  return global.strapi.entityService.findMany;
};

// Keys of a populate tree, as Strapi's query converter keeps them.
const populateKeys = (populate) =>
  Object.fromEntries(
    Object.entries(populate).map(([key, node]) => [
      key,
      node && node.populate ? populateKeys(node.populate) : true,
    ])
  );

afterEach(() => {
  delete global.strapi;
});

describe("all-company service (GET /api/all-company)", () => {
  const callService = async (rows = []) => {
    const findMany = mockStrapi(rows);
    const output = await allCompanyService.allCompany();

    expect(findMany).toHaveBeenCalledTimes(1);
    const [uid, params] = findMany.mock.calls[0];

    return { uid, params, output };
  };

  it("still only reads the activated companies with a running subscription", async () => {
    const { uid, params } = await callService();

    expect(uid).toBe("api::company.company");
    expect(params.filters).toEqual({
      activated: true,
      suscribe_date_start: { $lte: expect.any(Date) },
      suscribe_date_end: { $gte: expect.any(Date) },
    });
  });

  it("populates no company anywhere below menus", async () => {
    const { params } = await callService();

    expect(Object.keys(params.populate)).toEqual(["menus", "content"]);
    expect(findKeyPaths(params.populate.menus, "company")).toEqual([]);
    expect(findKeyPaths(params, "users")).toEqual([]);
  });

  it("contains no wildcard populate", async () => {
    const { params } = await callService();

    expect(findWildcards(params)).toEqual([]);
  });

  it("only uses populate keys and fields that exist in the schemas", async () => {
    const { uid, params } = await callService();

    expect(validatePopulate(params.populate, uid, strapi.getModel)).toEqual([]);
  });

  it("is kept as a whole by Strapi's own query converter", async () => {
    const { uid, params } = await callService();

    // Strapi drops what it does not know without a word: nothing must be lost
    const query = convertQueryParams.transformParamsToQuery(uid, params);

    expect(populateKeys(query.populate)).toEqual(populateKeys(params.populate));
    expect(populateKeys(query.populate)).toEqual({
      menus: {
        image: true,
        categories: {
          icon: true,
          category: { icon: true },
          categories: { icon: true },
          dishes: {
            ingredients: true,
            dishes: { ingredients: true },
            image: true,
            type_dish: { icon: true },
          },
        },
      },
      content: { home_image: true, home_background_images: true },
    });
  });

  it("selects only what the fronts read on ingredients and side dishes", async () => {
    const { params } = await callService();
    const dishes = params.populate.menus.populate.categories.populate.dishes;

    expect(dishes.populate.ingredients).toEqual({ fields: INGREDIENT_FIELDS });
    expect(dishes.populate.dishes).toEqual({
      fields: SIDE_DISH_FIELDS,
      populate: { ingredients: { fields: INGREDIENT_FIELDS } },
    });
    // the main dishes keep every field, side dishes are still listed apart
    expect(dishes.fields).toBeUndefined();
    expect(dishes.filters).toEqual({ is_sidedish: { $ne: true } });

    expect(INGREDIENT_FIELDS).toEqual([
      "id",
      "name",
      "activated",
      "available_date_start",
      "available_date_end",
    ]);
    expect(SIDE_DISH_FIELDS).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "activated",
        "available_date_start",
        "available_date_end",
        "is_allergen_gluten",
        "is_allergen_shellfishes",
        "is_allergen_eggs",
        "is_allergen_fishes",
        "is_allergen_peanuts",
        "is_allergen_soybeans",
        "is_allergen_milk",
        "is_allergen_nuts",
        "is_allergen_celery",
        "is_allergen_mustard",
        "is_allergen_sesams",
        "is_allergen_sulphurous_anhydre",
        "is_allergen_lupins",
        "is_allergen_mollusks",
        "is_vegetarian",
        "is_vegan",
        "is_sidedish",
        "is_pescetarian",
      ])
    );
  });

  it("returns nothing sensitive even if the database layer returns a poisoned record", async () => {
    const { output } = await callService(poisonedCompanies());

    expect(output).toHaveLength(1);
    expect(output[0]).not.toHaveProperty("users");
    expectClean(output);
  });

  it("keeps the shape and the fields the clients rely on", async () => {
    const { output } = await callService(poisonedCompanies());

    expectAllCompanyShape(output);
  });

  it("returns an empty list when no company matches", async () => {
    const { output } = await callService([]);

    expect(output).toEqual([]);
  });
});

describe("all-menu service (GET /api/all-menu)", () => {
  const callService = async (rows = []) => {
    const findMany = mockStrapi(rows);
    const output = await allMenuService.allMenu();

    expect(findMany).toHaveBeenCalledTimes(1);
    const [uid, params] = findMany.mock.calls[0];

    return { uid, params, output };
  };

  it("uses an explicit and valid populate, without wildcard", async () => {
    const { uid, params } = await callService();

    expect(uid).toBe("api::menu.menu");
    expect(findWildcards(params)).toEqual([]);
    expect(validatePopulate(params.populate, uid, strapi.getModel)).toEqual([]);
  });

  it("only populates the company of the menu itself, restricted to scalar fields", async () => {
    const { params } = await callService();

    expect(findKeyPaths(params.populate, "company")).toEqual(["$.company"]);
    expect(Object.keys(params.populate.company)).toEqual(["fields"]);
    expect(findKeyPaths(params, "users")).toEqual([]);
  });

  it("returns nothing sensitive even if the database layer returns a poisoned record", async () => {
    const { output } = await callService([poisonedMenu(), poisonedMenu()]);

    expect(output).toHaveLength(2);
    expectClean(output);
    expect(output[0]).toMatchObject({
      id: 10,
      title: "La carte",
      image: { url: "https://cdn.example.com/menu.png" },
    });
    expect(output[0].categories[1].dishes[0]).toMatchObject({
      id: 1000,
      name: "Burger",
      ingredients: [{ id: 500, name: "Tomate" }],
    });
  });
});
