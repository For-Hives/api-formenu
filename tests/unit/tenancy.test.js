"use strict";

const { describe, it, expect, afterEach } = require("@jest/globals");
const { convertQueryParams } = require("@strapi/utils");

const { createStrapiStub } = require("./helpers/strapi-stub");

const USER_UID = "plugin::users-permissions.user";

afterEach(() => {
  delete global.strapi;
});

describe("my-* services (rows of the caller's company only)", () => {
  const SERVICES = [
    {
      route: "GET /api/my-menus",
      file: "../../src/api/menu/services/my-custom-menu",
      method: "findMyMenus",
      uid: "api::menu.menu",
    },
    {
      route: "GET /api/my-dish",
      file: "../../src/api/dish/services/custom-dish",
      method: "findMyDish",
      uid: "api::dish.dish",
    },
    {
      route: "GET /api/my-categories",
      file: "../../src/api/category/services/custom-category",
      method: "findMyCategories",
      uid: "api::category.category",
    },
    {
      route: "GET /api/my-ingredients",
      file: "../../src/api/ingredient/services/custom-ingredient",
      method: "findMyIngredients",
      uid: "api::ingredient.ingredient",
    },
  ];

  const mockStrapi = (connectedUser) => {
    global.strapi = createStrapiStub({
      entityService: {
        findOne: jest.fn().mockResolvedValue(connectedUser),
        findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      },
    });

    return global.strapi.entityService;
  };

  describe.each(SERVICES)("$route", ({ file, method, uid }) => {
    it("filters on the company of the caller, in a way Strapi does not ignore", async () => {
      const entityService = mockStrapi({ id: 3, company: { id: 7 } });

      const rows = await require(file)[method]({ id: 3 });

      expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(entityService.findOne).toHaveBeenCalledWith(USER_UID, 3, {
        populate: { company: true },
      });
      expect(entityService.findMany).toHaveBeenCalledTimes(1);

      const [calledUid, params] = entityService.findMany.mock.calls[0];
      expect(calledUid).toBe(uid);
      // entityService only reads `filters`: a `where` key is dropped silently
      expect(params).not.toHaveProperty("where");

      // what really reaches the database layer, through Strapi's own converter
      const query = convertQueryParams.transformParamsToQuery(uid, params);
      expect(query.where).toEqual({ company: { id: { $eq: 7 } } });
    });

    it("reads nothing when the caller has no company", async () => {
      const entityService = mockStrapi({ id: 3, company: null });

      await expect(require(file)[method]({ id: 3 })).rejects.toThrow(
        "User or user's company is undefined"
      );
      expect(entityService.findMany).not.toHaveBeenCalled();
    });
  });
});

describe("company tenancy middlewares", () => {
  const createContext = ({ user, id } = {}) => ({
    state: { user },
    params: { id },
    unauthorized: jest.fn(() => "unauthorized"),
    notFound: jest.fn(() => "notFound"),
  });

  // findOne answers with the connected user or with the requested entry
  const createStrapi = ({ connectedUser, entry }) => ({
    entityService: {
      findOne: jest.fn(async (uid) =>
        uid === USER_UID ? connectedUser : entry
      ),
    },
  });

  const run = async (file, { user, id, connectedUser, entry }) => {
    const strapiStub = createStrapi({ connectedUser, entry });
    const ctx = createContext({ user, id });
    const next = jest.fn(() => "next");

    await require(file)({}, { strapi: strapiStub })(ctx, next);

    return { ctx, next, findOne: strapiStub.entityService.findOne };
  };

  describe("api::company.company", () => {
    const file = "../../src/api/company/middlewares/companyTenancy";

    it("answers 401 to a caller without user (API token), before reading anything", async () => {
      const { ctx, next, findOne } = await run(file, {
        user: undefined,
        id: "1",
        entry: { id: 1 },
      });

      expect(ctx.unauthorized).toHaveBeenCalledWith("User not authenticated");
      expect(findOne).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("answers 401 to a user without company instead of crashing", async () => {
      const { ctx, next } = await run(file, {
        user: { id: 3 },
        id: "1",
        connectedUser: { id: 3, company: null },
        entry: { id: 1 },
      });

      expect(ctx.unauthorized).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it("still refuses another company and lets the user's own company through", async () => {
      const other = await run(file, {
        user: { id: 3 },
        id: "2",
        connectedUser: { id: 3, company: { id: 1 } },
        entry: { id: 2 },
      });
      expect(other.ctx.unauthorized).toHaveBeenCalledTimes(1);
      expect(other.next).not.toHaveBeenCalled();

      const own = await run(file, {
        user: { id: 3 },
        id: "1",
        connectedUser: { id: 3, company: { id: 1 } },
        entry: { id: 1 },
      });
      expect(own.ctx.unauthorized).not.toHaveBeenCalled();
      expect(own.next).toHaveBeenCalledTimes(1);
    });

    it("still answers 404 to a user asking for an unknown company", async () => {
      const { ctx, next } = await run(file, {
        user: { id: 3 },
        id: "404",
        connectedUser: { id: 3, company: { id: 1 } },
        entry: null,
      });

      expect(ctx.notFound).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe.each(["menu", "category", "dish", "ingredient"])(
    "api::%s",
    (name) => {
      const file = `../../src/api/${name}/middlewares/companyTenancy`;
      const user = { id: 3 };
      const connectedUser = { id: 3, company: { id: 1 } };

      it("answers 401 for an entry without company instead of crashing", async () => {
        const { ctx, next } = await run(file, {
          user,
          id: "10",
          connectedUser,
          entry: { id: 10, company: null },
        });

        expect(ctx.unauthorized).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
      });

      it("still refuses the entry of another company", async () => {
        const { ctx, next } = await run(file, {
          user,
          id: "10",
          connectedUser,
          entry: { id: 10, company: { id: 2 } },
        });

        expect(ctx.unauthorized).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
      });

      it("still lets the entry of the user's company through", async () => {
        const { ctx, next } = await run(file, {
          user,
          id: "10",
          connectedUser,
          entry: { id: 10, company: { id: 1 } },
        });

        expect(ctx.unauthorized).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
      });

      it("still refuses a caller without user or without company", async () => {
        const anonymous = await run(file, { user: undefined });
        expect(anonymous.ctx.unauthorized).toHaveBeenCalledTimes(1);
        expect(anonymous.next).not.toHaveBeenCalled();

        const orphan = await run(file, {
          user,
          connectedUser: { id: 3, company: null },
        });
        expect(orphan.ctx.unauthorized).toHaveBeenCalledTimes(1);
        expect(orphan.next).not.toHaveBeenCalled();
      });
    }
  );
});
