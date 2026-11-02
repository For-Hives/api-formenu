/**
 * Company isolation of the upload routes (`/api/upload`), on a real Strapi
 * (sqlite, local upload provider) booted by tests/app.test.js.
 *
 * A user of company C tries to write into the files of company D with the
 * only upload right admin-formenu needs, `plugin::upload.content-api.upload`
 * (plus findOne and destroy, to check those routes too).
 */

const request = require("supertest");
const { describe, it, expect, beforeAll } = require("@jest/globals");

const PERMISSION_UID = "plugin::users-permissions.permission";
const FILE_UID = "plugin::upload.file";
const DISH_UID = "api::dish.dish";

// a 4x4 PNG
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000004000000040802000000269309290000001049444154789c63f8cfc000470cc47100ae930ff1d05f239e0000000049454e44ae426082",
  "hex"
);

const http = () => request(strapi.server.httpServer);
const bearer = (jwt) => "Bearer " + jwt;

const dishImage = async (id) => {
  const dish = await strapi.entityService.findOne(DISH_UID, id, {
    populate: { image: true },
  });
  return dish.image;
};

const fileRow = (id) => strapi.db.query(FILE_UID).findOne({ where: { id } });

describe("company isolation of the upload routes", () => {
  let C;
  let D;
  let jwtC;
  let jwtD;
  let dishC;
  let dishD;
  let fileD;

  beforeAll(async () => {
    const role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    for (const action of [
      "plugin::upload.content-api.upload",
      "plugin::upload.content-api.findOne",
      "plugin::upload.content-api.destroy",
      "api::dish.dish.update",
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

    C = await strapi.entityService.create("api::company.company", {
      data: { name: "Restaurant C", slug: "restaurant-c" },
    });
    D = await strapi.entityService.create("api::company.company", {
      data: { name: "Restaurant D", slug: "restaurant-d" },
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
    jwtC = issue(await addUser("upload-c", C));
    jwtD = issue(await addUser("upload-d", D));

    dishC = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat C", company: C.id },
    });
    dishD = await strapi.entityService.create(DISH_UID, {
      data: { name: "Plat D", company: D.id },
    });

    // D puts an image on its own dish, through the API
    const res = await http()
      .post("/api/upload")
      .set("Authorization", bearer(jwtD))
      .field("ref", DISH_UID)
      .field("refId", String(dishD.id))
      .field("field", "image")
      .attach("files", PNG, "imageD.png");
    expect(res.status).toBe(200);
    fileD = res.body[0];
    expect((await dishImage(dishD.id)).id).toBe(fileD.id);
  });

  describe("what admin-formenu sends keeps working", () => {
    it("a plain upload, then the file set on the user's dish", async () => {
      const up = await http()
        .post("/api/upload")
        .set("Authorization", bearer(jwtC))
        .attach("files", PNG, "plat-c.png");
      expect(up.status).toBe(200);

      const put = await http()
        .put(`/api/dishes/${dishC.id}`)
        .set("Authorization", bearer(jwtC))
        // admin-formenu sends the whole file object of the upload response
        // and the whole company object of the user
        .send({
          data: {
            image: up.body[0],
            company: { id: C.id, name: C.name, slug: C.slug },
          },
        });
      expect(put.status).toBe(200);
      expect((await dishImage(dishC.id)).id).toBe(up.body[0].id);
    });
  });

  describe("a user of C cannot write into the files of D", () => {
    it("U1: ref/refId cannot attach a file to the dish of D", async () => {
      const res = await http()
        .post("/api/upload")
        .set("Authorization", bearer(jwtC))
        .field("ref", DISH_UID)
        .field("refId", String(dishD.id))
        .field("field", "image")
        .attach("files", PNG, "pirate.png");
      expect(res.status).toBe(403);
      expect((await dishImage(dishD.id)).id).toBe(fileD.id);
      expect(
        await strapi.db.query(FILE_UID).findOne({ where: { name: "pirate.png" } })
      ).toBeNull();
    });

    it("U1: ref can only name the content of a company", async () => {
      for (const [ref, refId] of [
        ["plugin::users-permissions.user", "1"],
        ["api::type-dish.type-dish", "1"],
        ["api::company.company", String(D.id)],
      ]) {
        const res = await http()
          .post("/api/upload")
          .set("Authorization", bearer(jwtC))
          .field("ref", ref)
          .field("refId", refId)
          .field("field", "image")
          .attach("files", PNG, "pirate.png");
        expect(res.status).toBe(403);
      }
    });

    it("U2: ?id= cannot replace the file of D", async () => {
      const before = await fileRow(fileD.id);
      const res = await http()
        .post(`/api/upload?id=${fileD.id}`)
        .set("Authorization", bearer(jwtC))
        .attach("files", PNG, "remplace.png");
      expect(res.status).toBe(403);
      const after = await fileRow(fileD.id);
      expect(after.name).toBe(before.name);
      expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it("U3: ?id= without a file cannot rename the file of D", async () => {
      const res = await http()
        .post(`/api/upload?id=${fileD.id}`)
        .set("Authorization", bearer(jwtC))
        .field(
          "fileInfo",
          JSON.stringify({ name: "renomme-par-C", alternativeText: "C" })
        );
      expect(res.status).toBe(403);
      const after = await fileRow(fileD.id);
      expect(after.name).toBe("imageD.png");
      expect(after.alternativeText).not.toBe("C");
    });

    it("?id= stays refused once C links the file of D to its own dish", async () => {
      const other = await strapi.entityService.create(DISH_UID, {
        data: { name: "Plat C bis", company: C.id, image: fileD.id },
      });
      expect((await dishImage(other.id)).id).toBe(fileD.id);

      const res = await http()
        .post(`/api/upload?id=${fileD.id}`)
        .set("Authorization", bearer(jwtC))
        .field("fileInfo", JSON.stringify({ alternativeText: "C" }));
      expect(res.status).toBe(403);
    });

    it("?id= must be one id", async () => {
      const res = await http()
        .post(`/api/upload?id=${fileD.id}&id=1`)
        .set("Authorization", bearer(jwtC))
        .field("fileInfo", JSON.stringify({ alternativeText: "C" }));
      expect(res.status).toBe(400);
    });

    it("GET and DELETE /api/upload/files/:id refuse the file of D", async () => {
      const get = await http()
        .get(`/api/upload/files/${fileD.id}`)
        .set("Authorization", bearer(jwtC));
      expect(get.status).toBe(403);

      const del = await http()
        .delete(`/api/upload/files/${fileD.id}`)
        .set("Authorization", bearer(jwtC));
      expect(del.status).toBe(403);
      expect(await fileRow(fileD.id)).not.toBeNull();
    });
  });

  describe("a user still manages the files of their company", () => {
    it("attaches, edits, replaces, reads and deletes a file of their dish", async () => {
      const dish = await strapi.entityService.create(DISH_UID, {
        data: { name: "Plat C ter", company: C.id },
      });
      const up = await http()
        .post("/api/upload")
        .set("Authorization", bearer(jwtC))
        .field("ref", DISH_UID)
        .field("refId", String(dish.id))
        .field("field", "image")
        .attach("files", PNG, "plat-c-ter.png");
      expect(up.status).toBe(200);
      const fileId = up.body[0].id;
      expect((await dishImage(dish.id)).id).toBe(fileId);

      const info = await http()
        .post(`/api/upload?id=${fileId}`)
        .set("Authorization", bearer(jwtC))
        .field("fileInfo", JSON.stringify({ alternativeText: "plat C" }));
      expect(info.status).toBe(200);
      expect((await fileRow(fileId)).alternativeText).toBe("plat C");

      const replace = await http()
        .post(`/api/upload?id=${fileId}`)
        .set("Authorization", bearer(jwtC))
        .attach("files", PNG, "plat-c-nouveau.png");
      expect(replace.status).toBe(200);
      expect((await fileRow(fileId)).name).toBe("plat-c-nouveau.png");

      const get = await http()
        .get(`/api/upload/files/${fileId}`)
        .set("Authorization", bearer(jwtC));
      expect(get.status).toBe(200);

      const del = await http()
        .delete(`/api/upload/files/${fileId}`)
        .set("Authorization", bearer(jwtC));
      expect(del.status).toBe(200);
      expect(await fileRow(fileId)).toBeNull();
    });
  });
});
