/**
 * Company isolation, on a real Strapi (sqlite) booted by tests/app.test.js.
 *
 * Two restaurants, A and B, one user each. Every test is a request a user of
 * A sends to reach the content of B, or a request the admin (admin-formenu)
 * really sends, which must keep working.
 */

const request = require("supertest");
const { describe, it, expect, beforeAll } = require("@jest/globals");

const USER_UID = "plugin::users-permissions.user";
const PERMISSION_UID = "plugin::users-permissions.permission";

const CONTENT = ["menu", "category", "dish", "ingredient"];
const PLURAL = {
  menu: "menus",
  category: "categories",
  dish: "dishes",
  ingredient: "ingredients",
};

const http = () => request(strapi.server.httpServer);

const as = (jwt) => (req) =>
  req
    .set("accept", "application/json")
    .set("Content-Type", "application/json")
    .set("Authorization", "Bearer " + jwt);

const userJwt = (user) =>
  strapi.plugins["users-permissions"].services.jwt.issue({ id: user.id });

const companyOf = async (uid, id) => {
  const row = await strapi.entityService.findOne(uid, id, {
    populate: { company: true },
  });
  return row.company ? row.company.id : null;
};

describe("company isolation of the content API", () => {
  let authenticated;
  let A;
  let B;
  let userA;
  let userB;
  let jwtA;
  const rowsA = {};
  const rowsB = {};

  beforeAll(async () => {
    authenticated = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    // the rights admin-formenu needs, plus company and type-dish writes so
    // that the refusals below come from this code, not from the role
    const actions = [
      "api::company.company.find",
      "api::company.company.findOne",
      "api::company.company.create",
      "api::company.company.update",
      "api::type-dish.type-dish.find",
      "api::type-dish.type-dish.create",
      "api::me.me.updateMe",
      "api::dish.custom-dish.findMyDish",
      "api::menu.custom-menu.menuDeep",
      ...CONTENT.flatMap((name) =>
        ["find", "findOne", "create", "update", "delete"].map(
          (action) => `api::${name}.${name}.${action}`
        )
      ),
    ];
    for (const action of actions) {
      await strapi
        .query(PERMISSION_UID)
        .create({ data: { action, role: authenticated.id } });
    }

    // subscribed companies: the public menu only shows those
    const subscribed = {
      activated: true,
      suscribe_date_start: "2020-01-01",
      suscribe_date_end: "2100-01-01",
    };
    A = await strapi.entityService.create("api::company.company", {
      data: { name: "Restaurant A", slug: "restaurant-a", ...subscribed },
    });
    B = await strapi.entityService.create("api::company.company", {
      data: { name: "Restaurant B", slug: "restaurant-b", ...subscribed },
    });

    const addUser = (name, company) =>
      strapi.plugins["users-permissions"].services.user.add({
        username: name,
        email: `${name}@formenu.test`,
        provider: "local",
        password: "Passw0rd-test",
        confirmed: true,
        blocked: false,
        role: authenticated.id,
        company: company.id,
      });
    userA = await addUser("owner-a", A);
    userB = await addUser("owner-b", B);
    jwtA = userJwt(userA);

    for (const [company, rows] of [
      [A, rowsA],
      [B, rowsB],
    ]) {
      const suffix = company.name.slice(-1);
      rows.menu = await strapi.entityService.create("api::menu.menu", {
        data: { title: `Carte ${suffix}`, activated: true, company: company.id },
      });
      rows.category = await strapi.entityService.create(
        "api::category.category",
        {
          data: {
            name: `Entrées ${suffix}`,
            depth: 1,
            order: 1,
            menu: rows.menu.id,
            company: company.id,
          },
        }
      );
      rows.ingredient = await strapi.entityService.create(
        "api::ingredient.ingredient",
        { data: { name: `Tomate ${suffix}`, company: company.id } }
      );
      rows.dish = await strapi.entityService.create("api::dish.dish", {
        data: {
          name: `Plat ${suffix}`,
          activated: true,
          category: rows.category.id,
          ingredients: [rows.ingredient.id],
          company: company.id,
        },
      });
    }
  });

  describe("hole 1: sign-up cannot pick a company", () => {
    it("POST /api/auth/local/register ignores `company`", async () => {
      const res = await http()
        .post("/api/auth/local/register")
        .set("Content-Type", "application/json")
        .send({
          username: "intruder",
          email: "intruder@formenu.test",
          password: "Passw0rd-test",
          company: B.id,
        });

      expect(res.status).toBe(200);
      const user = await strapi.entityService.findOne(USER_UID, res.body.user.id, {
        populate: { company: true },
      });
      expect(user.company).toBeNull();

      // and so the new account cannot edit the menu of B
      const put = await as(res.body.jwt)(
        http().put(`/api/dishes/${rowsB.dish.id}`)
      ).send({ data: { name: "Piraté" } });
      expect(put.status).toBeGreaterThanOrEqual(400);
      const dish = await strapi.entityService.findOne(
        "api::dish.dish",
        rowsB.dish.id
      );
      expect(dish.name).toBe("Plat B");
    });
  });

  describe("hole 2: core routes stay inside the caller's company", () => {
    it.each(CONTENT)("GET /api/<%s> lists the rows of A only", async (name) => {
      const res = await as(jwtA)(http().get(`/api/${PLURAL[name]}`));

      expect(res.status).toBe(200);
      const ids = res.body.data.map((row) => row.id);
      expect(ids).toContain(rowsA[name].id);
      expect(ids).not.toContain(rowsB[name].id);
    });

    it("an $or filter does not widen the list", async () => {
      const res = await as(jwtA)(
        http().get(
          `/api/dishes?filters[$or][0][id][$eq]=${rowsB.dish.id}&filters[$or][1][id][$eq]=${rowsA.dish.id}`
        )
      );

      expect(res.status).toBe(200);
      expect(res.body.data.map((row) => row.id)).toEqual([rowsA.dish.id]);
    });

    it("GET /api/companies lists the company of the caller only", async () => {
      const res = await as(jwtA)(http().get("/api/companies"));

      expect(res.status).toBe(200);
      expect(res.body.data.map((row) => row.id)).toEqual([A.id]);
    });

    it("POST /api/dishes with company B creates the dish in A", async () => {
      const res = await as(jwtA)(http().post("/api/dishes")).send({
        data: { name: "Plat posé chez B", company: B.id },
      });

      expect(res.status).toBe(200);
      expect(await companyOf("api::dish.dish", res.body.data.id)).toBe(A.id);
    });

    it("PUT /api/dishes/<dish of A> with company B leaves the dish in A", async () => {
      const res = await as(jwtA)(
        http().put(`/api/dishes/${rowsA.dish.id}`)
      ).send({ data: { company: B.id } });

      expect(res.status).toBe(200);
      expect(await companyOf("api::dish.dish", rowsA.dish.id)).toBe(A.id);
    });

    it("PUT /api/dishes/<dish of B> is refused", async () => {
      const res = await as(jwtA)(
        http().put(`/api/dishes/${rowsB.dish.id}`)
      ).send({ data: { name: "Piraté" } });

      expect(res.status).toBe(401);
    });

    it("a dish of A cannot be put in a category of B", async () => {
      const res = await as(jwtA)(
        http().put(`/api/dishes/${rowsA.dish.id}`)
      ).send({ data: { category: rowsB.category.id } });

      expect(res.status).toBe(403);
      const dish = await strapi.entityService.findOne(
        "api::dish.dish",
        rowsA.dish.id,
        { populate: { category: true } }
      );
      expect(dish.category.id).toBe(rowsA.category.id);
    });

    it("a new category of A cannot take the dishes of B", async () => {
      const res = await as(jwtA)(http().post("/api/categories")).send({
        data: { name: "Vol", depth: 1, order: 9, dishes: [rowsB.dish.id] },
      });

      expect(res.status).toBe(403);
      const dish = await strapi.entityService.findOne(
        "api::dish.dish",
        rowsB.dish.id,
        { populate: { category: true } }
      );
      expect(dish.category.id).toBe(rowsB.category.id);
    });

    it("PUT /api/companies/<A> cannot pull the user of B into A", async () => {
      const res = await as(jwtA)(http().put(`/api/companies/${A.id}`)).send({
        data: { users: [userB.id], menus: [rowsB.menu.id] },
      });

      expect(res.status).toBe(200);
      expect(await companyOf(USER_UID, userB.id)).toBe(B.id);
      expect(await companyOf("api::menu.menu", rowsB.menu.id)).toBe(B.id);
    });

    it("POST /api/companies is refused to a user", async () => {
      const res = await as(jwtA)(http().post("/api/companies")).send({
        data: { name: "Nouvelle" },
      });

      expect(res.status).toBe(403);
    });

    it("dish types (shared by every company) are read-only for a user", async () => {
      const list = await as(jwtA)(http().get("/api/type-dishes"));
      expect(list.status).toBe(200);

      const res = await as(jwtA)(http().post("/api/type-dishes")).send({
        data: { name: "Type ajouté par A" },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("hole 3: POST /api/users/me cannot change the email", () => {
    it("refuses a new email and keeps the old one", async () => {
      const res = await as(jwtA)(http().post("/api/users/me")).send({
        email: "attacker@formenu.test",
      });

      expect(res.status).toBe(403);
      const user = await strapi.entityService.findOne(USER_UID, userA.id);
      expect(user.email).toBe("owner-a@formenu.test");
    });

    it("still updates the other fields, with the same email sent back", async () => {
      const res = await as(jwtA)(http().post("/api/users/me")).send({
        email: "Owner-A@formenu.test",
        firstname: "Alice",
      });

      expect(res.status).toBe(200);
      const user = await strapi.entityService.findOne(USER_UID, userA.id);
      expect(user.firstname).toBe("Alice");
      expect(user.email).toBe("owner-a@formenu.test");
    });
  });

  describe("what admin-formenu sends keeps working", () => {
    // postDish / postCategory / putCategory / putIngredient add the whole
    // company object of the user (GET /api/users/me?populate=company)
    const companyObject = () => ({ id: A.id, name: A.name, slug: A.slug });

    it("postDishes: POST /api/dishes with the company object and relation objects", async () => {
      const res = await as(jwtA)(http().post("/api/dishes")).send({
        data: {
          name: "Plat admin",
          price: 12.5,
          category: { id: rowsA.category.id, name: "Entrées A" },
          ingredients: [{ id: rowsA.ingredient.id, name: "Tomate A" }],
          company: companyObject(),
        },
      });

      expect(res.status).toBe(200);
      expect(await companyOf("api::dish.dish", res.body.data.id)).toBe(A.id);
    });

    it("putDishes / toggleDishState: PUT /api/dishes/<id>", async () => {
      const res = await as(jwtA)(
        http().put(`/api/dishes/${rowsA.dish.id}`)
      ).send({ data: { activated: false } });

      expect(res.status).toBe(200);
      expect(res.body.data.attributes.activated).toBe(false);
    });

    it("putCategory: PUT /api/categories/<id>?populate=... with company, menu and dishes", async () => {
      const res = await as(jwtA)(
        http().put(
          `/api/categories/${rowsA.category.id}?populate=category,menu,dishes`
        )
      ).send({
        data: {
          name: "Entrées A",
          order: "1",
          depth: "1",
          menu: String(rowsA.menu.id),
          dishes: [{ id: rowsA.dish.id }],
          company: companyObject(),
        },
      });

      expect(res.status).toBe(200);
      expect(await companyOf("api::category.category", rowsA.category.id)).toBe(
        A.id
      );
    });

    it("postIngredient / putIngredient", async () => {
      const post = await as(jwtA)(http().post("/api/ingredients")).send({
        data: { name: "Basilic", activated: true, company: companyObject() },
      });
      expect(post.status).toBe(200);

      const put = await as(jwtA)(
        http().put(`/api/ingredients/${post.body.data.id}`)
      ).send({
        data: { name: "Basilic frais", company: companyObject() },
      });
      expect(put.status).toBe(200);
      expect(
        await companyOf("api::ingredient.ingredient", post.body.data.id)
      ).toBe(A.id);
    });

    it("getCategoriesFilteredByDepth: filters on the company name", async () => {
      const res = await as(jwtA)(
        http().get(
          `/api/categories?filters[depth][$eq]=1&filters[company][name][$eq]=${encodeURIComponent(
            A.name
          )}`
        )
      );

      expect(res.status).toBe(200);
      expect(res.body.data.map((row) => row.id)).toContain(rowsA.category.id);
    });

    it("getMenu: GET /api/menu-deep/<menu of A>, and not the menu of B", async () => {
      const own = await as(jwtA)(http().get(`/api/menu-deep/${rowsA.menu.id}`));
      expect(own.status).toBe(200);

      const other = await as(jwtA)(
        http().get(`/api/menu-deep/${rowsB.menu.id}`)
      );
      expect(other.status).toBe(401);
    });

    it("getDishes: GET /api/my-dish", async () => {
      const res = await as(jwtA)(http().get("/api/my-dish"));

      expect(res.status).toBe(200);
      const ids = res.body.map((row) => row.id);
      expect(ids).toContain(rowsA.dish.id);
      expect(ids).not.toContain(rowsB.dish.id);
    });

    it("the public menu: GET /api/all-company with an API token", async () => {
      const token = await strapi.service("admin::api-token").create({
        name: "public-menu-test",
        type: "custom",
        permissions: ["api::company.all-company.allCompany"],
        lifespan: null,
      });

      const res = await as(token.accessKey)(http().get("/api/all-company"));

      expect(res.status).toBe(200);
      const names = res.body.map((company) => company.name);
      expect(names).toEqual(
        expect.arrayContaining(["Restaurant A", "Restaurant B"])
      );
    });
  });
});
