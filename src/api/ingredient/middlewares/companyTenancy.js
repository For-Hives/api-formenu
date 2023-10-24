"use strict";

/**
 * `isOwner` middleware -> to check if the user is from the company associated with the entry
 */

const entityPath = "api::ingredient.ingredient"

module.exports = (config, {strapi}) => {
  // Add your own logic here.
  return async (ctx, next) => {
    const user = ctx.state.user;
    const entryId = ctx.params.id ? ctx.params.id : undefined;
    let entry = {};

    /**
     * Gets all information about a given entry,
     * including the company associated with it,
     * then checks if the user if from the same company
     * thanks to every relations to ensure
     * the response includes author-related information
     */
    if (entryId) {
      entry = await strapi.entityService.findOne(// replace the next line with your proper content-type identifier
        entityPath, entryId, {populate: "*"});


      const connectedUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user", user.id, {populate: "company"});

      /**
       * Compares user company and entry company
       * to decide whether the request can be fulfilled
       * by going forward in the Strapi backend server
       */

      if (connectedUser.company.id !== entry.company.id) {
        return ctx.unauthorized("This action is unauthorized.You are not from the same company as the entry.");
      } else {
        return next();
      }
    }
  };
};
