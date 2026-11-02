/**
 * Who owns a file, on a real Strapi (sqlite, local upload provider) booted by
 * tests/app.test.js.
 *
 * Restaurant P tries to take the files of restaurant Q through the media
 * fields of its own content (dish image, category icon, menu image, the
 * `content` component of the company, the profile picture), then to read,
 * replace or delete them. The owner of a file is the company of the user who
 * uploaded it, never deduced from what the file is linked to.
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

const fileRow = (id) => strapi.db.query(FILE_UID).findOne({ where: { id } });

const mediaOf = async (uid, id, field) => {
  const row = await strapi.entityService.findOne(uid, id, {
    populate: { [field]: true },
  });
  return row[field];
};

const companyContentImage = async (companyId) => {
  const company = await strapi.entityService.findOne(COMPANY_UID, companyId, {
    populate: { content: { populate: { home_image: true } } },
  });
  return company.content && company.content.home_image;
};

/** A file row written straight into the database, like the files already in production. */
let legacyCount = 0;
const legacyFile = async () => {
  legacyCount += 1;
  return strapi.db.query(FILE_UID).create({
    data: {
      name: `legacy-${legacyCount}.png`,
      hash: `legacy_${legacyCount}_${Date.now()}`,
      ext: ".png",
      mime: "image/png",
      size: 0.1,
      url: `/uploads/legacy-${legacyCount}.png`,
      provider: "local",
    },
  });
};

describe("owner of a file", () => {
  let role;
  let P;
  let Q;
  let jwtP;
  let jwtQ;
  let jwtNoCompany;
  let userP;
  let dishP;
  let dishP2;
  let dishQ;
  let categoryP;
  let menuP;
  let typeDish;
  let fileQ; // a plain upload of Q, linked to nothing

  const upload = (jwt, name) =>
    http()
      .post("/api/upload")
      .set("Authorization", bearer(jwt))
      .attach("files", PNG, name);

  beforeAll(async () => {
    role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    for (const action of [
      "plugin::upload.content-api.upload",
      "plugin::upload.content-api.find",
      "plugin::upload.content-api.findOne",
      "plugin::upload.content-api.destroy",
      "api::dish.dish.findOne",
      "api::dish.dish.create",
      "api::dish.dish.update",
      "api::category.category.update",
      "api::menu.menu.update",
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

    P = await strapi.entityService.create(COMPANY_UID, {
      data: { name: "Restaurant P", slug: "restaurant-p" },
    });
    Q = await strapi.entityService.create(COMPANY_UID, {
      data: { name: "Restaurant Q", slug: "restaurant-q" },
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
        ...(company ? { company: company.id } : {}),
      });
    const issue = (user) =>
      strapi.plugins["users-permissions"].services.jwt.issue({ id: user.id });
    userP = await addUser("owner-p", P);
    jwtP = issue(userP);
    jwtQ = issue(await addUser("owner-q", Q));
    jwtNoCompany = issue(await addUser("sans-societe", null));

    menuP = await strapi.entityService.create(MENU_UID, {
      data: { title: "Carte P", company: P.id },
    });
    categoryP = await strapi.entityService.create(CATEGORY_UID, {
      data: { name: "Entrées P", depth: 1, order: 1, menu: menuP.id, company: P.id },
    });
    typeDish = await strapi.entityService.create("api::type-dish.type-dish", {
      data: { name: "Plat principal" },
    });
    dishP = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat P", category: categoryP.id, company: P.id },
    });
    dishP2 = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat P bis", company: P.id },
    });
    dishQ = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat Q", company: Q.id },
    });

    const up = await upload(jwtQ, "fichier-q.png");
    expect(up.status).toBe(200);
    fileQ = up.body[0];
  });

  describe("B1: P cannot take the file of Q through its own content", () => {
    it("PUT /api/dishes/<dish of P> with the file of Q is refused", async () => {
      const res = await json(http().put(`/api/dishes/${dishP.id}`), jwtP).send({
        data: { image: fileQ.id },
      });
      expect(res.status).toBe(403);
      expect(await mediaOf(DISH_UID, dishP.id, "image")).toBeNull();
    });

    it("so P still cannot replace, rename or delete the file of Q", async () => {
      const replace = await http()
        .post(`/api/upload?id=${fileQ.id}`)
        .set("Authorization", bearer(jwtP))
        .attach("files", PNG, "remplace-par-p.png");
      expect(replace.status).toBe(403);

      const rename = await http()
        .post(`/api/upload?id=${fileQ.id}`)
        .set("Authorization", bearer(jwtP))
        .field("fileInfo", JSON.stringify({ name: "a-p" }));
      expect(rename.status).toBe(403);

      const del = await http()
        .delete(`/api/upload/files/${fileQ.id}`)
        .set("Authorization", bearer(jwtP));
      expect(del.status).toBe(403);

      const row = await fileRow(fileQ.id);
      expect(row).not.toBeNull();
      expect(row.name).toBe("fichier-q.png");
    });

    it("POST /api/dishes with the file of Q is refused", async () => {
      const res = await json(http().post("/api/dishes"), jwtP).send({
        data: { name: "Plat volé", image: { id: fileQ.id } },
      });
      expect(res.status).toBe(403);
    });

    it("the other media fields of P refuse the file of Q", async () => {
      const category = await json(
        http().put(`/api/categories/${categoryP.id}`),
        jwtP
      ).send({ data: { icon: fileQ.id } });
      expect(category.status).toBe(403);

      const menu = await json(http().put(`/api/menus/${menuP.id}`), jwtP).send({
        data: { background: [fileQ.id] },
      });
      expect(menu.status).toBe(403);

      const company = await json(
        http().put(`/api/companies/${P.id}`),
        jwtP
      ).send({ data: { content: { home_image: fileQ.id } } });
      expect(company.status).toBe(403);
      expect(await companyContentImage(P.id)).toBeFalsy();

      const background = await json(
        http().put(`/api/companies/${P.id}`),
        jwtP
      ).send({ data: { content: { home_background_images: [fileQ.id] } } });
      expect(background.status).toBe(403);

      const me = await json(http().post("/api/users/me"), jwtP).send({
        profilePicture: fileQ.id,
      });
      expect(me.status).toBe(403);
      expect(await mediaOf(USER_UID, userP.id, "profilePicture")).toBeNull();
    });

    it("a content write cannot carry its own files (multipart)", async () => {
      const res = await http()
        .post("/api/dishes")
        .set("Authorization", bearer(jwtP))
        .field("data", JSON.stringify({ name: "Plat multipart" }))
        .attach("files.image", PNG, "multipart.png");
      expect(res.status).toBe(403);
    });
  });

  describe("B2: P cannot read the file of Q, nor lock Q out of it", () => {
    it("GET /api/dishes/<dish of P>?populate=image does not show the file of Q", async () => {
      await json(http().put(`/api/dishes/${dishP.id}`), jwtP).send({
        data: { image: fileQ.id },
      });
      const res = await json(
        http().get(`/api/dishes/${dishP.id}?populate=image`),
        jwtP
      );
      expect(res.status).toBe(200);
      const image = res.body.data.attributes.image.data;
      expect(image === null || image.id !== fileQ.id).toBe(true);
    });

    it("GET /api/upload/files/<file of Q> is refused to P", async () => {
      const res = await http()
        .get(`/api/upload/files/${fileQ.id}`)
        .set("Authorization", bearer(jwtP));
      expect(res.status).toBe(403);
    });

    it("Q still manages its own file, linked or not", async () => {
      const get = await http()
        .get(`/api/upload/files/${fileQ.id}`)
        .set("Authorization", bearer(jwtQ));
      expect(get.status).toBe(200);

      const info = await http()
        .post(`/api/upload?id=${fileQ.id}`)
        .set("Authorization", bearer(jwtQ))
        .field("fileInfo", JSON.stringify({ alternativeText: "plat Q" }));
      expect(info.status).toBe(200);

      const put = await json(http().put(`/api/dishes/${dishQ.id}`), jwtQ).send({
        data: { image: fileQ.id },
      });
      expect(put.status).toBe(200);
      expect((await mediaOf(DISH_UID, dishQ.id, "image")).id).toBe(fileQ.id);
    });

    it("a file of Q that P managed to link elsewhere stays Q's", async () => {
      // a link written outside the content API (Strapi admin panel, old data)
      await strapi.entityService.update(DISH_UID, dishP2.id, {
        data: { image: fileQ.id },
      });

      const byQ = await http()
        .post(`/api/upload?id=${fileQ.id}`)
        .set("Authorization", bearer(jwtQ))
        .field("fileInfo", JSON.stringify({ caption: "toujours a Q" }));
      expect(byQ.status).toBe(200);

      const byP = await http()
        .post(`/api/upload?id=${fileQ.id}`)
        .set("Authorization", bearer(jwtP))
        .field("fileInfo", JSON.stringify({ caption: "a P" }));
      expect(byP.status).toBe(403);

      await strapi.entityService.update(DISH_UID, dishP2.id, {
        data: { image: null },
      });
    });
  });

  describe("R1 and R3: listing and uploading", () => {
    it("R1: GET /api/upload/files is refused to a user", async () => {
      const res = await http()
        .get("/api/upload/files")
        .set("Authorization", bearer(jwtP));
      expect(res.status).toBe(403);
    });

    it("R3: an account without a company cannot upload", async () => {
      const res = await upload(jwtNoCompany, "sans-societe.png");
      expect(res.status).toBe(403);
      expect(
        await strapi.db
          .query(FILE_UID)
          .findOne({ where: { name: "sans-societe.png" } })
      ).toBeNull();
    });

    it("R3: an account without a company can still edit its profile", async () => {
      const res = await json(http().post("/api/users/me"), jwtNoCompany).send({
        firstname: "Sans",
        profilePicture: null,
      });
      expect(res.status).toBe(200);
    });
  });

  describe("R4: the images of the company's own content", () => {
    it("the owner sets, edits and reads an image of `content`", async () => {
      const up = await upload(jwtP, "accueil-p.png");
      expect(up.status).toBe(200);
      const fileId = up.body[0].id;

      const put = await json(http().put(`/api/companies/${P.id}`), jwtP).send({
        data: {
          content: { home_title: "Bienvenue", home_image: fileId },
        },
      });
      expect(put.status).toBe(200);
      expect((await companyContentImage(P.id)).id).toBe(fileId);

      const info = await http()
        .post(`/api/upload?id=${fileId}`)
        .set("Authorization", bearer(jwtP))
        .field("fileInfo", JSON.stringify({ alternativeText: "accueil" }));
      expect(info.status).toBe(200);

      const get = await http()
        .get(`/api/upload/files/${fileId}`)
        .set("Authorization", bearer(jwtP));
      expect(get.status).toBe(200);

      const other = await http()
        .get(`/api/upload/files/${fileId}`)
        .set("Authorization", bearer(jwtQ));
      expect(other.status).toBe(403);
    });

    // already refused by Strapi itself (400, "components not related to the
    // entity"): kept so that an upgrade cannot reopen it silently
    it("the `content` of another company cannot be rewritten through its component id", async () => {
      await strapi.entityService.update(COMPANY_UID, Q.id, {
        data: { content: { home_title: "Accueil Q" } },
      });
      const contentQ = (
        await strapi.entityService.findOne(COMPANY_UID, Q.id, {
          populate: { content: true },
        })
      ).content;

      const res = await json(http().put(`/api/companies/${P.id}`), jwtP).send({
        data: { content: { id: contentQ.id, home_title: "pirate" } },
      });
      expect(res.status).toBe(400);
      const after = await strapi.entityService.findOne(COMPANY_UID, Q.id, {
        populate: { content: true },
      });
      expect(after.content.id).toBe(contentQ.id);
      expect(after.content.home_title).toBe("Accueil Q");

      // its own component id, as a GET sends it back, is fine
      const own = (
        await strapi.entityService.findOne(COMPANY_UID, P.id, {
          populate: { content: true },
        })
      ).content;
      const ok = await json(http().put(`/api/companies/${P.id}`), jwtP).send({
        data: { content: { id: own.id, home_title: "Bienvenue chez P" } },
      });
      expect(ok.status).toBe(200);
    });

    it("a profile picture of the user's company is accepted", async () => {
      const up = await upload(jwtP, "profil-p.png");
      const res = await json(http().post("/api/users/me"), jwtP).send({
        profilePicture: up.body[0].id,
      });
      expect(res.status).toBe(200);
      expect((await mediaOf(USER_UID, userP.id, "profilePicture")).id).toBe(
        up.body[0].id
      );
    });
  });

  describe("files already in production, without an owner", () => {
    it("an entry saved again with its unchanged image is accepted", async () => {
      const legacy = await legacyFile();
      // shared by P and Q: no owner can be deduced
      await strapi.entityService.update(DISH_UID, dishP2.id, {
        data: { image: legacy.id },
      });
      await strapi.entityService.update(DISH_UID, dishQ.id, {
        data: { image: legacy.id },
      });

      const same = await json(
        http().put(`/api/dishes/${dishP2.id}`),
        jwtP
      ).send({ data: { name: "Plat P bis", image: { id: legacy.id } } });
      expect(same.status).toBe(200);

      // but it cannot be put on another entry
      const elsewhere = await json(
        http().put(`/api/dishes/${dishP.id}`),
        jwtP
      ).send({ data: { image: legacy.id } });
      expect(elsewhere.status).toBe(403);

      // nor replaced by either company
      const replace = await http()
        .post(`/api/upload?id=${legacy.id}`)
        .set("Authorization", bearer(jwtP))
        .field("fileInfo", JSON.stringify({ alternativeText: "P" }));
      expect(replace.status).toBe(403);
    });

    it("an unlinked file without owner is nobody's", async () => {
      const legacy = await legacyFile();
      const res = await json(http().put(`/api/dishes/${dishP.id}`), jwtP).send({
        data: { image: legacy.id },
      });
      expect(res.status).toBe(403);
      const get = await http()
        .get(`/api/upload/files/${legacy.id}`)
        .set("Authorization", bearer(jwtP));
      expect(get.status).toBe(403);
    });

    it("a file linked to the content of one company only is that company's", async () => {
      const legacy = await legacyFile();
      await strapi.entityService.update(CATEGORY_UID, categoryP.id, {
        data: { icon: legacy.id },
      });
      const get = await http()
        .get(`/api/upload/files/${legacy.id}`)
        .set("Authorization", bearer(jwtP));
      expect(get.status).toBe(200);
      const other = await http()
        .get(`/api/upload/files/${legacy.id}`)
        .set("Authorization", bearer(jwtQ));
      expect(other.status).toBe(403);
    });

    it("the start-up backfill records the owner when the links name one company", async () => {
      const { backfillFileOwners, OWNER_FIELD } = require("../../../src/utils/file-ownership");

      const onDish = await legacyFile();
      await strapi.entityService.update(DISH_UID, dishP2.id, {
        data: { image: onDish.id },
      });
      const onContent = await legacyFile();
      await strapi.entityService.update(COMPANY_UID, Q.id, {
        data: { content: { home_image: onContent.id } },
      });
      const onProfile = await legacyFile();
      await strapi.entityService.update(USER_UID, userP.id, {
        data: { profilePicture: onProfile.id },
      });
      const shared = await legacyFile();
      await strapi.entityService.update(MENU_UID, menuP.id, {
        data: { image: shared.id },
      });
      await strapi.entityService.update(DISH_UID, dishQ.id, {
        data: { image: shared.id },
      });
      const onTypeDish = await legacyFile();
      await strapi.entityService.update("api::type-dish.type-dish", typeDish.id, {
        data: { image: onTypeDish.id },
      });
      const unlinked = await legacyFile();

      await backfillFileOwners();

      const owner = async (file) => (await fileRow(file.id))[OWNER_FIELD];
      expect(await owner(onDish)).toBe(P.id);
      expect(await owner(onContent)).toBe(Q.id);
      expect(await owner(onProfile)).toBe(P.id);
      expect(await owner(shared)).toBeNull();
      expect(await owner(onTypeDish)).toBeNull();
      expect(await owner(unlinked)).toBeNull();
      // a plain upload got its owner when it was sent
      expect(await owner(fileQ)).toBe(Q.id);

      // idempotent: a second run changes nothing
      const before = await strapi.db.query(FILE_UID).findMany({
        select: ["id", OWNER_FIELD],
        orderBy: { id: "asc" },
      });
      await backfillFileOwners();
      const after = await strapi.db.query(FILE_UID).findMany({
        select: ["id", OWNER_FIELD],
        orderBy: { id: "asc" },
      });
      expect(after).toEqual(before);

      // the owner stays once the file is unlinked
      await strapi.entityService.update(DISH_UID, dishP2.id, {
        data: { image: null },
      });
      const get = await http()
        .get(`/api/upload/files/${onDish.id}`)
        .set("Authorization", bearer(jwtP));
      expect(get.status).toBe(200);
    });

    it("the owner is never sent back by the API", async () => {
      const up = await upload(jwtP, "prive.png");
      expect(up.body[0]).not.toHaveProperty("ownerCompany");
      const get = await http()
        .get(`/api/upload/files/${up.body[0].id}`)
        .set("Authorization", bearer(jwtP));
      expect(get.body).not.toHaveProperty("ownerCompany");
    });
  });

  describe("R5: the requests admin-formenu really sends", () => {
    it("uploadFile, then putDishes and postDishes with whole objects", async () => {
      // uploadFile: POST /api/upload with `files` only
      const up = await upload(jwtP, "plat-admin.png");
      expect(up.status).toBe(200);
      const uploadedImage = up.body[0];
      expect(uploadedImage).toHaveProperty("url");

      // the company object of GET /api/users/me?populate=company
      const me = await json(
        http().get("/api/users/me?populate=company"),
        jwtP
      );
      const company = me.body.company || { id: P.id, name: P.name, slug: P.slug };

      // the store objects of the category and the dish type
      const category = {
        id: categoryP.id,
        name: categoryP.name,
        depth: 1,
        order: 1,
      };
      const type_dish = { id: typeDish.id, name: typeDish.name };

      // putDishes(id, {...lastDishClicked, ..., image: uploadedImage})
      const lastDishClicked = {
        id: dishP.id,
        name: "Plat P",
        description: null,
        price: null,
        activated: true,
        company,
      };
      const put = await json(http().put(`/api/dishes/${dishP.id}`), jwtP).send({
        data: {
          ...lastDishClicked,
          name: "Plat P modifié",
          description: "avec image",
          price: 14.5,
          category,
          type_dish,
          image: uploadedImage,
        },
      });
      expect(put.status).toBe(200);
      expect((await mediaOf(DISH_UID, dishP.id, "image")).id).toBe(
        uploadedImage.id
      );

      // a second save of the same dish without a new image: image null
      const again = await json(
        http().put(`/api/dishes/${dishP.id}`),
        jwtP
      ).send({
        data: { ...lastDishClicked, category, type_dish, image: null },
      });
      expect(again.status).toBe(200);

      // postDishes: the company object of the user is added to the dish
      const up2 = await upload(jwtP, "plat-admin-2.png");
      const post = await json(http().post("/api/dishes"), jwtP).send({
        data: {
          name: "Nouveau plat",
          description: "neuf",
          price: 9,
          category,
          type_dish,
          image: up2.body[0],
          company,
        },
      });
      expect(post.status).toBe(200);
      expect((await mediaOf(DISH_UID, post.body.data.id, "image")).id).toBe(
        up2.body[0].id
      );
    });
  });
});
