"use strict";

const entityPath = "api::ingredient.ingredient"

module.exports = (config, {strapi}) => {
  return async (ctx, next) => {
    console.log("middleware companyTenancy ingredients")
    const user = ctx.state.user;
    const entryId = ctx.params.id;

    if (!user) {
      return ctx.unauthorized("User not authenticated");
    }

    // Retrieve the connected user's details
    const connectedUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user", user.id, { populate: "company" });

    if (!connectedUser.company) {
      return ctx.unauthorized("User is not associated with any company");
    }

    if (entryId) {
      // Logic for handling requests with an entry `id`
      let entry = await strapi.entityService.findOne(
          entityPath, entryId, {populate: "*"});

      if (entry === null) {
        return ctx.notFound("No entry found for id " + entryId + ".");
      }

      if (connectedUser.company.id !== entry.company.id) {
        return ctx.unauthorized("This action is unauthorized. You are not from the same company as the entry.");
      }
    }

    // If no `id` is provided, or if the user is associated with the same company as the entry, continue
    return next();
  };
};
