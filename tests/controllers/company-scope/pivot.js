/**
 * The `__pivot` key of a relation or media value, on a real Strapi (sqlite)
 * booted by tests/app.test.js.
 *
 * Strapi's database layer copies `__pivot` into the join row it writes
 * (`{ ...data.__pivot }` in createRelations / updateRelations), and the input
 * sanitizer keeps it. The company checks read the `id` of a relation or media
 * value only, so `{ id: <own row>, __pivot: { <join column>: <row of another
 * company> } }` passed them while the join row pointed elsewhere. A client
 * never needs `__pivot` (admin-formenu never sends it): it is refused with a
 * 400, at any depth of the body.
 *
 * Restaurant S attacks restaurant T. Every test checks the response and what
 * the database really holds afterwards.
 */

const request = require("supertest");
const { describe, it, expect, beforeAll } = require("@jest/globals");

const PERMISSION_UID = "plugin::users-permissions.permission";
const USER_UID = "plugin::users-permissions.user";
const FILE_UID = "plugin::upload.file";
const COMPANY_UID = "api::company.company";
const DISH_UID = "api::dish.dish";
const CATEGORY_UID = "api::category.category";

// a 4x4 PNG
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000004000000040802000000269309290000001049444154789c63f8cfc000470cc47100ae930ff1d05f239e0000000049454e44ae426082",
  "hex"
);

const http = () => request(strapi.server.httpServer);
const bearer = (jwt) => "Bearer " + jwt;
const json = (req, jwt) =>
  req
    .set("accept", "application/json")
    .set("Content-Type", "application/json")
    .set("Authorization", bearer(jwt));

const mediaOf = async (uid, id, field) => {
  const row = await strapi.entityService.findOne(uid, id, {
    populate: { [field]: true },
  });
  return row[field];
};

const contentOf = async (companyId) =>
  (
    await strapi.entityService.findOne(COMPANY_UID, companyId, {
      populate: { content: { populate: { home_image: true } } },
    })
  ).content;

describe("`__pivot` cannot redirect a join row", () => {
  let S;
  let T;
  let jwtS;
  let userT;
  let dishS;
  let dishT;
  let categoryS;
  let fileS;
  let fileT;

  const upload = (jwt, name) =>
    http()
      .post("/api/upload")
      .set("Authorization", bearer(jwt))
      .attach("files", PNG, name);

  beforeAll(async () => {
    const role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    for (const action of [
      "plugin::upload.content-api.upload",
      "plugin::upload.content-api.destroy",
      "api::dish.dish.findOne",
      "api::dish.dish.create",
      "api::dish.dish.update",
      "api::category.category.find",
      "api::category.category.update",
      "api::company.company.update",
      "api::me.me.updateMe",
    ]) {
      const existing = await strapi
        .query(PERMISSION_UID)
        .findOne({ where: { action, role: role.id } });
      if (!existing) {
        await strapi
          .query(PERMISSION_UID)
          .create({ data: { action, role: role.id } });
      }
    }

    S = await strapi.entityService.create(COMPANY_UID, {
      data: { name: "Restaurant S", slug: "restaurant-s" },
    });
    T = await strapi.entityService.create(COMPANY_UID, {
      data: { name: "Restaurant T", slug: "restaurant-t" },
    });

    const addUser = (name, company) =>
      strapi.plugins["users-permissions"].services.user.add({
        username: name,
        email: `${name}@formenu.test`,
        provider: "local",
        password: "Passw0rd-test",
        confirmed: true,
        blocked: false,
        role: role.id,
        company: company.id,
      });
    const issue = (user) =>
      strapi.plugins["users-permissions"].services.jwt.issue({ id: user.id });
    jwtS = issue(await addUser("pivot-s", S));
    userT = await addUser("pivot-t", T);
    const jwtT = issue(userT);

    categoryS = await strapi.entityService.create(CATEGORY_UID, {
      data: { name: "Entrées S", depth: 1, order: 1, company: S.id },
    });
    dishS = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat S", company: S.id },
    });
    dishT = await strapi.entityService.create(DISH_UID, {
      data: { name: "secret dish T", company: T.id },
    });
    await strapi.entityService.update(COMPANY_UID, T.id, {
      data: { content: { home_title: "Accueil T" } },
    });

    const upS = await upload(jwtS, "fichier-s.png");
    expect(upS.status).toBe(200);
    fileS = upS.body[0];
    const upT = await upload(jwtT, "secret-t.png");
    expect(upT.status).toBe(200);
    fileT = upT.body[0];
  });

  describe("1: a media written onto an entry of another company", () => {
    it("dish image: `__pivot.related_id` naming the dish of T", async () => {
      const res = await json(http().put(`/api/dishes/${dishS.id}`), jwtS).send({
        data: { image: { id: fileS.id, __pivot: { related_id: dishT.id } } },
      });
      expect(res.status).toBe(400);
      expect(await mediaOf(DISH_UID, dishT.id, "image")).toBeNull();
    });

    it("profile picture: `__pivot.related_id` naming the user of T", async () => {
      const res = await json(http().post("/api/users/me"), jwtS).send({
        profilePicture: { id: fileS.id, __pivot: { related_id: userT.id } },
      });
      expect(res.status).toBe(400);
      expect(await mediaOf(USER_UID, userT.id, "profilePicture")).toBeNull();
    });

    it("company content: `__pivot.related_id` naming the content of T", async () => {
      const contentT = await contentOf(T.id);
      const res = await json(http().put(`/api/companies/${S.id}`), jwtS).send({
        data: {
          content: {
            home_title: "x",
            home_image: { id: fileS.id, __pivot: { related_id: contentT.id } },
          },
        },
      });
      expect(res.status).toBe(400);
      expect((await contentOf(T.id)).home_image).toBeNull();
    });
  });

  it("2: `__pivot.file_id` cannot link, then read, the file of T", async () => {
    const res = await json(
      http().put(`/api/dishes/${dishS.id}?populate=image`),
      jwtS
    ).send({
      data: { image: { id: fileS.id, __pivot: { file_id: fileT.id } } },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain(fileT.hash);
    const image = await mediaOf(DISH_UID, dishS.id, "image");
    expect(image === null || image.id !== fileT.id).toBe(true);
  });

  it("3: `__pivot.file_id` cannot take, then delete, a file without owner", async () => {
    const legacy = await strapi.db.query(FILE_UID).create({
      data: {
        name: "legacy-pivot.png",
        hash: `legacy_pivot_${Date.now()}`,
        ext: ".png",
        mime: "image/png",
        size: 0.1,
        url: "/uploads/legacy-pivot.png",
        provider: "local",
      },
    });

    const res = await json(http().put(`/api/dishes/${dishS.id}`), jwtS).send({
      data: { image: { id: fileS.id, __pivot: { file_id: legacy.id } } },
    });
    expect(res.status).toBe(400);

    const del = await http()
      .delete(`/api/upload/files/${legacy.id}`)
      .set("Authorization", bearer(jwtS));
    expect(del.status).toBe(403);
    expect(
      await strapi.db.query(FILE_UID).findOne({ where: { id: legacy.id } })
    ).not.toBeNull();
  });

  describe("4: ordinary relations", () => {
    const categoryOfDishT = async () =>
      (
        await strapi.entityService.findOne(DISH_UID, dishT.id, {
          populate: { category: true },
        })
      ).category;

    it("`__pivot.dish_id` cannot move the dish of T into a category of S", async () => {
      const res = await json(http().put(`/api/dishes/${dishS.id}`), jwtS).send({
        data: { category: { id: categoryS.id, __pivot: { dish_id: dishT.id } } },
      });
      expect(res.status).toBe(400);
      expect(await categoryOfDishT()).toBeNull();

      const list = await json(
        http().get("/api/categories?populate=dishes"),
        jwtS
      );
      expect(JSON.stringify(list.body)).not.toContain("secret dish T");
    });

    it("nor through `connect`, nor on create", async () => {
      const connect = await json(
        http().put(`/api/dishes/${dishS.id}`),
        jwtS
      ).send({
        data: {
          category: {
            connect: [{ id: categoryS.id, __pivot: { dish_id: dishT.id } }],
          },
        },
      });
      expect(connect.status).toBe(400);

      const create = await json(http().post("/api/dishes"), jwtS).send({
        data: {
          name: "nouveau",
          category: { set: [{ id: categoryS.id, __pivot: { dish_id: dishT.id } }] },
        },
      });
      expect(create.status).toBe(400);
      expect(await categoryOfDishT()).toBeNull();
    });
  });

  it("the same writes without `__pivot` still pass", async () => {
    const res = await json(http().put(`/api/dishes/${dishS.id}`), jwtS).send({
      data: { image: { ...fileS }, category: { id: categoryS.id } },
    });
    expect(res.status).toBe(200);
    expect((await mediaOf(DISH_UID, dishS.id, "image")).id).toBe(fileS.id);
  });
});
