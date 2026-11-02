"use strict";

/**
 * "Poisoned" raw records, shaped like what `strapi.entityService` returns when
 * a populate goes too far: user rows (password hash, tokens, email, phone)
 * hang at every level of the tree.
 *
 * Every value is fake. Whatever belongs to a user carries the POISON marker,
 * so a test can assert that nothing of it survives with one string search.
 */

const { expect } = require("@jest/globals");

const POISON = "POISON";

const SENSITIVE_KEYS = [
  "password",
  "resetPasswordToken",
  "confirmationToken",
  "registrationToken",
  "createdBy",
  "updatedBy",
  "users",
  "related",
];

const poisonedUser = (id = 1) => ({
  id,
  username: `${POISON}-username-${id}`,
  email: `${POISON}-${id}@example.com`,
  provider: "local",
  password: `${POISON}-${"x".repeat(53)}`,
  resetPasswordToken: `${POISON}-reset-token-x`,
  confirmationToken: `${POISON}-confirmation-token-x`,
  confirmed: true,
  blocked: false,
  firstname: `${POISON}-firstname`,
  lastname: `${POISON}-lastname`,
  phoneNumber: `${POISON}-0000000000`,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
});

const poisonedAdmin = () => ({
  id: 1,
  firstname: `${POISON}-admin`,
  lastname: `${POISON}-admin`,
  username: null,
  email: `${POISON}-admin@example.com`,
  password: `${POISON}-${"x".repeat(53)}`,
  resetPasswordToken: null,
  registrationToken: null,
  isActive: true,
  blocked: false,
});

// A company as `populate: '*'` returns it: with its users.
const poisonedCompany = (id = 90) => ({
  id,
  name: "Nested company",
  description: "A company populated where it should not be",
  country: "France",
  city: "Nantes",
  street: "1 rue du Test",
  postcode: 44000,
  slug: "nested-company",
  activated: true,
  suscribe_date_start: "2024-01-01",
  suscribe_date_end: "2099-01-01",
  createdBy: poisonedAdmin(),
  updatedBy: poisonedAdmin(),
  users: [poisonedUser(1), poisonedUser(2), poisonedUser(3)],
});

// A media as `populate: '*'` returns it: with the raw rows of every entry
// using the file, among which a user (the file is also its profile picture).
const poisonedMedia = (id, name) => ({
  id,
  name: `${name}.png`,
  alternativeText: `${name} alt`,
  caption: null,
  width: 512,
  height: 512,
  formats: { thumbnail: { url: `https://cdn.example.com/thumb_${name}.png` } },
  hash: `${name}_hash`,
  ext: ".png",
  mime: "image/png",
  size: 12.5,
  url: `https://cdn.example.com/${name}.png`,
  previewUrl: null,
  provider: "local",
  provider_metadata: null,
  folderPath: "/1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdBy: poisonedAdmin(),
  updatedBy: poisonedAdmin(),
  folder: { id: 1, name: "private folder", pathId: 1, path: "/1" },
  related: [
    { __type: "plugin::users-permissions.user", ...poisonedUser(7) },
    { __type: "api::category.category", id: 4242, name: "Another category" },
  ],
});

const allergens = () => ({
  is_allergen_gluten: true,
  is_allergen_shellfishes: true,
  is_allergen_eggs: false,
  is_allergen_fishes: false,
  is_allergen_peanuts: false,
  is_allergen_soybeans: false,
  is_allergen_milk: true,
  is_allergen_nuts: false,
  is_allergen_celery: false,
  is_allergen_mustard: false,
  is_allergen_sesams: false,
  is_allergen_sulphurous_anhydre: false,
  is_allergen_lupins: false,
  is_allergen_mollusks: false,
});

const poisonedIngredient = (id, name) => ({
  id,
  name,
  activated: true,
  available_date_start: null,
  available_date_end: null,
  locale: "fr",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdBy: poisonedAdmin(),
  company: poisonedCompany(),
  dishes: [{ id: 3000, name: "Another dish", company: poisonedCompany() }],
  localizations: [{ id: id + 1, name, company: poisonedCompany() }],
});

const poisonedSideDish = () => ({
  id: 1001,
  name: "Frites",
  description: "Side dish",
  activated: true,
  available_date_start: null,
  available_date_end: null,
  ...allergens(),
  is_vegetarian: true,
  is_vegan: true,
  is_sidedish: true,
  is_pescetarian: true,
  createdBy: poisonedAdmin(),
  company: poisonedCompany(),
  ingredients: [poisonedIngredient(502, "Pomme de terre")],
  dishes_2: { id: 1000, name: "Burger", company: poisonedCompany() },
});

const poisonedDish = () => ({
  id: 1000,
  name: "Burger",
  description: "A burger",
  price: 12.5,
  order: 1,
  locale: "fr",
  activated: true,
  available_date_start: null,
  available_date_end: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
  ...allergens(),
  is_vegetarian: false,
  is_vegan: false,
  is_sidedish: false,
  is_pescetarian: false,
  createdBy: poisonedAdmin(),
  updatedBy: poisonedAdmin(),
  company: poisonedCompany(),
  image: poisonedMedia(20, "burger"),
  type_dish: {
    id: 5,
    name: "default",
    color: "black",
    icon: poisonedMedia(21, "type-icon"),
  },
  category: { id: 101, name: "Burgers", company: poisonedCompany() },
  ingredients: [poisonedIngredient(500, "Tomate")],
  dishes: [poisonedSideDish()],
});

const poisonedCategories = () => [
  {
    id: 100,
    name: "Plats",
    locale: "fr",
    depth: 0,
    order: 1,
    createdBy: poisonedAdmin(),
    icon: poisonedMedia(30, "plats-icon"),
    company: poisonedCompany(),
    category: null,
    categories: [
      {
        id: 101,
        name: "Burgers",
        locale: "fr",
        depth: 1,
        order: 1,
        icon: poisonedMedia(31, "burgers-icon"),
        // the path of the real leak: menus > categories > categories > company > users
        company: poisonedCompany(),
      },
    ],
    dishes: [],
  },
  {
    id: 101,
    name: "Burgers",
    locale: "fr",
    depth: 1,
    order: 1,
    icon: poisonedMedia(31, "burgers-icon"),
    company: poisonedCompany(),
    category: {
      id: 100,
      name: "Plats",
      locale: "fr",
      depth: 0,
      order: 1,
      icon: poisonedMedia(30, "plats-icon"),
      company: poisonedCompany(),
    },
    categories: [],
    dishes: [poisonedDish()],
  },
];

const poisonedMenu = () => ({
  id: 10,
  title: "La carte",
  description: "Our menu",
  activated: true,
  locale: "fr",
  available_date_start: null,
  available_date_end: null,
  color: "sky",
  fonts: "lato",
  createdBy: poisonedAdmin(),
  updatedBy: poisonedAdmin(),
  image: poisonedMedia(40, "menu"),
  company: poisonedCompany(),
  categories: poisonedCategories(),
});

/** What GET /api/all-company would get from a populate gone wrong. */
const poisonedCompanies = () => [
  {
    id: 1,
    name: "Chez Test",
    country: "France",
    city: "Nantes",
    street: "1 rue du Test",
    postcode: 44000,
    slug: "chez-test",
    color: "sky",
    fonts: "lato",
    fonts_title: "fraunces",
    activated: true,
    suscribe_date_start: "2024-01-01",
    suscribe_date_end: "2099-01-01",
    createdBy: poisonedAdmin(),
    updatedBy: poisonedAdmin(),
    users: [poisonedUser(1), poisonedUser(2), poisonedUser(3)],
    // a user row under a key that is not an attribute of the schema
    owner: poisonedUser(4),
    content: {
      id: 1,
      metadata_title: "Chez Test",
      metadata_description: "The menu of Chez Test",
      home_title: "Welcome",
      home_subtitle: "Enjoy",
      home_image: poisonedMedia(50, "home"),
      home_background_images: [
        poisonedMedia(51, "background-1"),
        poisonedMedia(52, "background-2"),
        poisonedMedia(53, "background-3"),
      ],
    },
    menus: [poisonedMenu()],
  },
];

/** Every key named `name` in `value`, at any depth, as a list of paths. */
const findKeys = (value, names, path = "$") => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findKeys(item, names, `${path}[${index}]`)
    );
  }

  if (value === null || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => [
    ...(names.includes(key) ? [`${path}.${key}`] : []),
    ...findKeys(child, names, `${path}.${key}`),
  ]);
};

/** Asserts that nothing sensitive is left anywhere in `output`. */
const expectClean = (output) => {
  expect(findKeys(output, SENSITIVE_KEYS)).toEqual([]);
  expect(JSON.stringify(output)).not.toContain(POISON);
};

/**
 * Asserts that the fields the front (formenu) and the back-office
 * (admin-formenu) read on GET /api/all-company are still there, with the flat
 * shape (no data / attributes envelope) and the arrays they iterate on.
 */
const expectAllCompanyShape = (companies) => {
  expect(Array.isArray(companies)).toBe(true);

  const [company] = companies;
  expect(company).toMatchObject({
    id: 1,
    name: "Chez Test",
    country: "France",
    city: "Nantes",
    street: "1 rue du Test",
    postcode: 44000,
    slug: "chez-test",
    color: "sky",
    fonts: "lato",
    fonts_title: "fraunces",
    content: {
      metadata_title: "Chez Test",
      metadata_description: "The menu of Chez Test",
      home_title: "Welcome",
      home_subtitle: "Enjoy",
      home_image: { url: "https://cdn.example.com/home.png" },
    },
  });
  expect(company.content.home_background_images.map(({ url }) => url)).toEqual([
    "https://cdn.example.com/background-1.png",
    "https://cdn.example.com/background-2.png",
    "https://cdn.example.com/background-3.png",
  ]);

  const [menu] = company.menus;
  expect(menu).toMatchObject({
    id: 10,
    title: "La carte",
    description: "Our menu",
    activated: true,
    available_date_start: null,
    available_date_end: null,
    color: "sky",
    fonts: "lato",
    image: { url: "https://cdn.example.com/menu.png" },
  });

  const [parent, child] = menu.categories;
  expect(parent).toMatchObject({
    id: 100,
    name: "Plats",
    order: 1,
    depth: 0,
    icon: { url: "https://cdn.example.com/plats-icon.png" },
    category: null,
    categories: [
      {
        id: 101,
        name: "Burgers",
        icon: { url: "https://cdn.example.com/burgers-icon.png" },
      },
    ],
    dishes: [],
  });
  expect(child).toMatchObject({
    id: 101,
    name: "Burgers",
    order: 1,
    depth: 1,
    category: { id: 100, name: "Plats" },
    categories: [],
  });

  const [dish] = child.dishes;
  expect(dish).toMatchObject({
    id: 1000,
    name: "Burger",
    description: "A burger",
    price: 12.5,
    activated: true,
    available_date_start: null,
    available_date_end: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    is_allergen_gluten: true,
    is_allergen_shellfishes: true,
    is_allergen_eggs: false,
    is_allergen_fishes: false,
    is_allergen_peanuts: false,
    is_allergen_soybeans: false,
    is_allergen_milk: true,
    is_allergen_nuts: false,
    is_allergen_celery: false,
    is_allergen_mustard: false,
    is_allergen_sesams: false,
    is_allergen_sulphurous_anhydre: false,
    is_allergen_lupins: false,
    is_allergen_mollusks: false,
    is_vegetarian: false,
    is_vegan: false,
    is_sidedish: false,
    is_pescetarian: false,
    image: {
      id: 20,
      url: "https://cdn.example.com/burger.png",
      alternativeText: "burger alt",
    },
    type_dish: {
      id: 5,
      color: "black",
      icon: { url: "https://cdn.example.com/type-icon.png" },
    },
    ingredients: [
      {
        id: 500,
        name: "Tomate",
        activated: true,
        available_date_start: null,
        available_date_end: null,
      },
    ],
    dishes: [
      {
        id: 1001,
        name: "Frites",
        activated: true,
        available_date_start: null,
        available_date_end: null,
        is_allergen_gluten: true,
        is_allergen_shellfishes: true,
        is_vegetarian: true,
        is_vegan: true,
        is_sidedish: true,
        is_pescetarian: true,
        ingredients: [{ id: 502, name: "Pomme de terre", activated: true }],
      },
    ],
  });
};

module.exports = {
  POISON,
  SENSITIVE_KEYS,
  poisonedUser,
  poisonedAdmin,
  poisonedCompany,
  poisonedMedia,
  poisonedDish,
  poisonedIngredient,
  poisonedCategories,
  poisonedMenu,
  poisonedCompanies,
  findKeys,
  expectClean,
  expectAllCompanyShape,
};
