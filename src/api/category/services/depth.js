module.exports = {
  depth: async () => {

    const existing = await strapi.entityService.findMany(
      "api::category.category"
    );

    if (!existing) {
      throw new Error("categories does not exist");
    }

    return existing;
  },
}
