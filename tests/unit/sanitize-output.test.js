"use strict";

const { describe, it, expect, afterEach } = require("@jest/globals");

const {
  sanitizeOutput,
  sanitizeCurrentUser,
  stripSensitiveData,
} = require("../../src/utils/sanitize-output");
const { createStrapiStub } = require("./helpers/strapi-stub");
const {
  POISON,
  poisonedUser,
  poisonedAdmin,
  poisonedCompany,
  poisonedMedia,
  poisonedCompanies,
  findKeys,
  expectClean,
  expectAllCompanyShape,
} = require("./helpers/poisoned");

afterEach(() => {
  delete global.strapi;
});

describe("stripSensitiveData (schema independent, no Strapi needed)", () => {
  it("removes credentials, creator fields and users at any depth, arrays included", () => {
    const output = stripSensitiveData({
      id: 1,
      password: `${POISON}-x`,
      resetPasswordToken: `${POISON}-token-x`,
      confirmationToken: null,
      createdBy: poisonedAdmin(),
      updatedBy: poisonedAdmin(),
      level1: [
        {
          id: 2,
          users: [poisonedUser(1)],
          createdBy: poisonedAdmin(),
          level2: {
            id: 3,
            updatedBy: poisonedAdmin(),
            level3: [[{ id: 4, company: poisonedCompany() }]],
          },
        },
      ],
    });

    expectClean(output);
    expect(output).toEqual({
      id: 1,
      level1: [
        {
          id: 2,
          level2: {
            id: 3,
            level3: [[{ id: 4, company: expect.any(Object) }]],
          },
        },
      ],
    });
    // the nested company itself stays, only its users and creators go
    expect(output.level1[0].level2.level3[0][0].company).toMatchObject({
      id: 90,
      name: "Nested company",
    });
  });

  it("drops a user record whatever the key it sits under", () => {
    const output = stripSensitiveData({
      id: 1,
      owner: poisonedUser(1),
      members: [poisonedUser(2), { id: 3, name: "not a user" }],
      // credentials set to null still identify a user row
      author: {
        id: 4,
        email: `${POISON}@example.com`,
        confirmationToken: null,
      },
      // a polymorphic row tagged as a user, without any credential key
      holder: {
        __type: "plugin::users-permissions.user",
        id: 5,
        email: `${POISON}@example.com`,
      },
    });

    expectClean(output);
    expect(output).toEqual({
      id: 1,
      members: [{ id: 3, name: "not a user" }],
    });
  });

  it("removes `user` and `related` when they hold a relation, keeps them as scalars", () => {
    const { password, resetPasswordToken, confirmationToken, ...publicUser } =
      poisonedUser(1);

    const output = stripSensitiveData({
      populated: { id: 1, user: publicUser, related: [publicUser] },
      scalar: { id: 2, user: 12, related: "see also" },
      empty: { id: 3, user: null },
    });

    expect(JSON.stringify(output)).not.toContain(POISON);
    expect(output).toEqual({
      populated: { id: 1 },
      scalar: { id: 2, user: 12, related: "see also" },
      empty: { id: 3, user: null },
    });
  });

  it("removes the `related` rows of a media populated with '*'", () => {
    const output = stripSensitiveData({ icon: poisonedMedia(1, "icon") });

    expectClean(output);
    expect(output.icon).toMatchObject({
      id: 1,
      url: "https://cdn.example.com/icon.png",
      alternativeText: "icon alt",
    });
  });

  it("never drops the root object, it only cleans it", () => {
    const output = stripSensitiveData(poisonedUser(1));

    expect(
      findKeys(output, ["password", "resetPasswordToken", "confirmationToken"])
    ).toEqual([]);
    expect(output).toMatchObject({ id: 1, provider: "local", confirmed: true });
  });

  it("does not mutate its input", () => {
    const input = poisonedCompanies();

    stripSensitiveData(input);

    expect(input).toEqual(poisonedCompanies());
  });

  it("leaves primitives, null and self-serializing values untouched", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");

    expect(stripSensitiveData(null)).toBeNull();
    expect(stripSensitiveData(undefined)).toBeUndefined();
    expect(stripSensitiveData("text")).toBe("text");
    expect(stripSensitiveData(0)).toBe(0);
    expect(stripSensitiveData([])).toEqual([]);
    expect(stripSensitiveData({ date, nothing: null, no: false })).toEqual({
      date,
      nothing: null,
      no: false,
    });
  });

  it("cleans a poisoned company tree and keeps what the clients read", () => {
    const output = stripSensitiveData(poisonedCompanies());

    expectClean(output);
    expectAllCompanyShape(output);
  });
});

describe("sanitizeOutput (with the Strapi schemas)", () => {
  it("cleans a poisoned company tree and keeps what the clients read", async () => {
    global.strapi = createStrapiStub();

    const output = await sanitizeOutput(
      poisonedCompanies(),
      "api::company.company"
    );

    expect(global.strapi.getModel).toHaveBeenCalledWith("api::company.company");
    expectClean(output);
    expectAllCompanyShape(output);
  });

  it("runs Strapi's content API sanitizer on the nested models", async () => {
    global.strapi = createStrapiStub();

    const output = await sanitizeOutput(
      poisonedCompanies(),
      "api::company.company"
    );

    // `folder` and `folderPath` are private attributes of the upload file
    // model: only Strapi's own sanitizer, walking the schemas, removes them
    expect(findKeys(output, ["folder", "folderPath"])).toEqual([]);
    expect(
      findKeys(stripSensitiveData(poisonedCompanies()), ["folderPath"])
    ).not.toEqual([]);
  });

  it("applies the sanitizers registered on Strapi", async () => {
    const registered = jest.fn((schema) => async (entity) => ({
      ...entity,
      sanitizedWith: schema.uid,
    }));
    global.strapi = createStrapiStub({
      sanitizers: { get: () => [registered] },
    });

    const output = await sanitizeOutput(
      { id: 1, name: "Tomate" },
      "api::ingredient.ingredient"
    );

    expect(output).toEqual({
      id: 1,
      name: "Tomate",
      sanitizedWith: "api::ingredient.ingredient",
    });
  });

  it("drops a relation to a user model whatever its name and its content", async () => {
    // rows without any credential key, as a `fields` restricted populate returns them
    const publicUser = (id) => ({
      id,
      email: `${POISON}-${id}@example.com`,
      phoneNumber: `${POISON}-0000000000`,
    });
    global.strapi = createStrapiStub({
      models: {
        "api::thing.thing": {
          uid: "api::thing.thing",
          modelType: "contentType",
          attributes: {
            name: { type: "string" },
            owner: {
              type: "relation",
              relation: "manyToOne",
              target: "plugin::users-permissions.user",
            },
            members: {
              type: "relation",
              relation: "manyToMany",
              target: "plugin::users-permissions.user",
            },
            editor: {
              type: "relation",
              relation: "manyToOne",
              target: "admin::user",
            },
            target: { type: "relation", relation: "morphToOne" },
            things: {
              type: "relation",
              relation: "oneToMany",
              target: "api::thing.thing",
            },
          },
        },
      },
    });

    const thing = (id) => ({
      id,
      name: `thing ${id}`,
      owner: publicUser(1),
      members: [publicUser(2), publicUser(3)],
      editor: publicUser(4),
      target: { __type: "api::dish.dish", id: 5, name: `${POISON} morph` },
    });

    const output = await sanitizeOutput(
      [{ ...thing(1), things: [thing(2)] }],
      "api::thing.thing"
    );

    expect(output).toEqual([
      { id: 1, name: "thing 1", things: [{ id: 2, name: "thing 2" }] },
    ]);
  });

  it("handles a single record, an empty list and null", async () => {
    global.strapi = createStrapiStub();

    const [menu] = poisonedCompanies()[0].menus;
    const output = await sanitizeOutput(menu, "api::menu.menu");

    expectClean(output);
    expect(output).toMatchObject({ id: 10, title: "La carte" });
    expect(output.categories).toHaveLength(2);

    await expect(sanitizeOutput([], "api::menu.menu")).resolves.toEqual([]);
    await expect(sanitizeOutput(null, "api::menu.menu")).resolves.toBeNull();
  });

  it("fails closed on a content type Strapi does not know", async () => {
    global.strapi = createStrapiStub();

    await expect(
      sanitizeOutput(poisonedCompanies(), "api::nope.nope")
    ).rejects.toThrow('unknown content type "api::nope.nope"');
  });

  it("does not mutate its input", async () => {
    global.strapi = createStrapiStub();
    const input = poisonedCompanies();

    await sanitizeOutput(input, "api::company.company");

    expect(input).toEqual(poisonedCompanies());
  });

  it("still strips everything sensitive without a Strapi instance", async () => {
    expect(global.strapi).toBeUndefined();

    const output = await sanitizeOutput(
      poisonedCompanies(),
      "api::company.company"
    );

    expectClean(output);
    expectAllCompanyShape(output);
  });
});

describe("sanitizeCurrentUser (POST /api/users/me)", () => {
  const ownUser = () => ({
    ...poisonedUser(1),
    username: "owner",
    email: "owner@example.com",
    firstname: "Olive",
    lastname: "Owner",
    phoneNumber: "0000000000",
  });

  it("returns the caller's own user without password nor tokens", async () => {
    global.strapi = createStrapiStub();

    const output = await sanitizeCurrentUser(ownUser());

    expect(global.strapi.getModel).toHaveBeenCalledWith(
      "plugin::users-permissions.user"
    );
    expectClean(output);
    // what the back-office reads on its own user
    expect(output).toEqual({
      id: 1,
      username: "owner",
      email: "owner@example.com",
      provider: "local",
      confirmed: true,
      blocked: false,
      firstname: "Olive",
      lastname: "Owner",
      phoneNumber: "0000000000",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("never returns the other users reachable through its relations", async () => {
    global.strapi = createStrapiStub();

    const output = await sanitizeCurrentUser({
      ...ownUser(),
      company: { ...poisonedCompany(), id: 7, slug: "chez-test" },
      role: {
        id: 1,
        name: "Authenticated",
        type: "authenticated",
        users: [poisonedUser(2), poisonedUser(3)],
      },
      profilePicture: poisonedMedia(60, "avatar"),
    });

    expectClean(output);
    expect(output).toMatchObject({
      id: 1,
      firstname: "Olive",
      lastname: "Owner",
      company: { id: 7, name: "Nested company", slug: "chez-test" },
      role: { id: 1, name: "Authenticated", type: "authenticated" },
      profilePicture: { url: "https://cdn.example.com/avatar.png" },
    });
  });

  it("passes the caller's auth to Strapi, which removes the relations it may not read", async () => {
    const auth = { strategy: { name: "users-permissions" } };
    const verify = jest.fn(async (receivedAuth, { scope }) => {
      if (scope !== "plugin::users-permissions.role.find") {
        throw new Error("Forbidden");
      }
    });
    global.strapi = createStrapiStub({ auth: { verify } });

    const output = await sanitizeCurrentUser(
      {
        ...ownUser(),
        company: { id: 7, name: "Chez Test" },
        role: { id: 1, name: "Authenticated" },
      },
      auth
    );

    expect(verify).toHaveBeenCalledWith(auth, {
      scope: "api::company.company.find",
    });
    expect(output.role).toEqual({ id: 1, name: "Authenticated" });
    expect(output).not.toHaveProperty("company");
    expect(output).toMatchObject({ id: 1, email: "owner@example.com" });
  });
});
