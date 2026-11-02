/**
 * `related`, the polymorphic relation of a file, on a real Strapi booted by
 * tests/app.test.js.
 *
 * Before files had an owner, any company could link any file to its own
 * entries (`PUT /api/dishes/:id { image: <id> }`). Such a file, shared by the
 * dish of S and the dish of T, is still in production. Populating `related`
 * from the dish of S listed the raw row of the dish of T. No content API
 * response may carry `related`, whatever the route and the populate syntax.
 */

const request = require("supertest");
const { describe, it, expect, beforeAll } = require("@jest/globals");

const PERMISSION_UID = "plugin::users-permissions.permission";
const USER_UID = "plugin::users-permissions.user";
const FILE_UID = "plugin::upload.file";
const COMPANY_UID = "api::company.company";
const DISH_UID = "api::dish.dish";
const CATEGORY_UID = "api::category.category";
const MENU_UID = "api::menu.menu";

const SECRET = "secret dish T2 price 99";

const http = () => request(strapi.server.httpServer);
const bearer = (jwt) => "Bearer " + jwt;

let count = 0;
const sharedFile = async () => {
  count += 1;
  return strapi.db.query(FILE_UID).create({
    data: {
      name: `shared-${count}.png`,
      hash: `shared_${count}_${Date.now()}`,
      ext: ".png",
      mime: "image/png",
      size: 0.1,
      url: `/uploads/shared-${count}.png`,
      provider: "local",
    },
  });
};

describe("no `related` in the responses of the content API", () => {
  let S;
  let T;
  let jwtS;
  let userS;
  let dishS;
  let menuS;
  let categoryS;
  let file;

  const get = (path) => http().get(path).set("Authorization", bearer(jwtS));

  const expectNoLeak = (res) => {
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(SECRET);
    expect(body).not.toContain("Maison T");
    expect(body).not.toContain('"related"');
  };

  beforeAll(async () => {
    const role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    for (const action of [
      "api::dish.dish.find",
      "api::dish.dish.findOne",
      "api::dish.dish.update",
      "api::menu.menu.find",
      "api::menu.menu.findOne",
      "api::category.category.find",
      "api::category.category.findOne",
      "api::company.company.find",
      "api::company.company.findOne",
      "plugin::users-permissions.user.me",
      "plugin::upload.content-api.findOne",
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
      data: { name: "Maison S", slug: "maison-s-related" },
    });
    T = await strapi.entityService.create(COMPANY_UID, {
      data: { name: "Maison T", slug: "maison-t-related" },
    });

    userS = await strapi.plugins["users-permissions"].services.user.add({
      username: "related-s",
      email: "related-s@formenu.test",
      provider: "local",
      password: "Passw0rd-test",
      confirmed: true,
      blocked: false,
      role: role.id,
      company: S.id,
    });
    jwtS = strapi.plugins["users-permissions"].services.jwt.issue({
      id: userS.id,
    });

    // one file linked to entries of both companies, as before the owners
    file = await sharedFile();
    menuS = await strapi.entityService.create(MENU_UID, {
      data: { title: "Carte S", company: S.id, image: file.id },
    });
    categoryS = await strapi.entityService.create(CATEGORY_UID, {
      data: { name: "Entrées S", depth: 1, order: 1, company: S.id, icon: file.id },
    });
    dishS = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat S", company: S.id, image: file.id },
    });
    await strapi.entityService.update(COMPANY_UID, S.id, {
      data: { content: { home_image: file.id } },
    });
    await strapi.entityService.update(USER_UID, userS.id, {
      data: { profilePicture: file.id },
    });
    const menuT = await strapi.entityService.create(MENU_UID, {
      data: { title: "Carte T", company: T.id, image: file.id },
    });
    await strapi.entityService.create(DISH_UID, {
      data: { name: SECRET, price: 99, company: T.id, image: file.id },
    });
    await strapi.entityService.update(COMPANY_UID, T.id, {
      data: { content: { home_image: file.id } },
    });
    expect(menuT.id).toBeDefined();

    // the state really is shared: the database lists entries of both companies
    const raw = await strapi.entityService.findOne(FILE_UID, file.id, {
      populate: { related: true },
    });
    expect(JSON.stringify(raw.related)).toContain(SECRET);
  });

  it("findOne dish, populate[image][populate][related]=*", async () => {
    const res = await get(
      `/api/dishes/${dishS.id}?populate[image][populate][related]=*`
    );
    expectNoLeak(res);
    // the image of S itself is still there
    expect(res.body.data.attributes.image.data.id).toBe(file.id);
    expect(res.body.data.attributes.image.data.attributes.url).toBe(file.url);
  });

  it("find dishes, populate[image][populate][related][populate]=*", async () => {
    const res = await get(
      "/api/dishes?populate[image][populate][related][populate]=*"
    );
    expectNoLeak(res);
    expect(res.body.data.map((d) => d.id)).toEqual([dishS.id]);
  });

  it("findOne dish, populate[image][populate]=*", async () => {
    expectNoLeak(await get(`/api/dishes/${dishS.id}?populate[image][populate]=*`));
  });

  it("findOne dish, populate=image.related", async () => {
    expectNoLeak(await get(`/api/dishes/${dishS.id}?populate=image.related`));
  });

  it("findOne dish, populate[0]=image.related", async () => {
    expectNoLeak(await get(`/api/dishes/${dishS.id}?populate[0]=image.related`));
  });

  it("PUT dish, populate[image][populate]=*", async () => {
    const res = await http()
      .put(`/api/dishes/${dishS.id}?populate[image][populate]=*`)
      .set("accept", "application/json")
      .set("Content-Type", "application/json")
      .set("Authorization", bearer(jwtS))
      .send({ data: { name: "Plat S", image: { id: file.id } } });
    expectNoLeak(res);
    expect(res.body.data.attributes.image.data.id).toBe(file.id);
  });

  it("menu.image and category.icon", async () => {
    expectNoLeak(
      await get(`/api/menus/${menuS.id}?populate[image][populate][related]=*`)
    );
    expectNoLeak(await get("/api/menus?populate[image][populate]=*"));
    expectNoLeak(
      await get(
        `/api/categories/${categoryS.id}?populate[icon][populate][related]=*`
      )
    );
  });

  it("company.content.home_image", async () => {
    expectNoLeak(
      await get(
        `/api/companies/${S.id}?populate[content][populate][home_image][populate][related]=*`
      )
    );
    expectNoLeak(
      await get(
        "/api/companies?populate[content][populate][home_image][populate]=*"
      )
    );
  });

  it("GET /api/users/me, populate[profilePicture][populate][related]=*", async () => {
    expectNoLeak(
      await get("/api/users/me?populate[profilePicture][populate][related]=*")
    );
  });

  it("GET /api/upload/files/:id?populate=related, file owned by S", async () => {
    const { OWNER_FIELD } = require("../../../src/utils/file-ownership");
    await strapi.db
      .query(FILE_UID)
      .update({ where: { id: file.id }, data: { [OWNER_FIELD]: S.id } });
    try {
      const res = await get(`/api/upload/files/${file.id}?populate=related`);
      expectNoLeak(res);
      expect(res.body.id).toBe(file.id);
    } finally {
      await strapi.db
        .query(FILE_UID)
        .update({ where: { id: file.id }, data: { [OWNER_FIELD]: null } });
    }
  });

  it("a filter on image.related tells nothing about T", async () => {
    const hit = await get(
      "/api/dishes?filters[image][related][name][$startsWith]=secret"
    );
    const miss = await get(
      "/api/dishes?filters[image][related][name][$startsWith]=zzz"
    );
    expect(hit.status).toBe(miss.status);
    expect(hit.body.data).toEqual(miss.body.data);
  });
});
