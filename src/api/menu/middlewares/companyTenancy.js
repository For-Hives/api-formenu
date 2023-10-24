"use strict";

/**
 * `isOwner` middleware -> to check if the user is from the company associated with the entry
 */

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
        "api::menu.menu", entryId, {populate: "*"});


      const connectedUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user", user.id, {populate: "company"});

      /**
       * Compares user company and entry company
       * to decide whether the request can be fulfilled
       * by going forward in the Strapi backend server
       */

      // console.log("user", user)
      // console.log("entry", entry)

      if (connectedUser.company.id !== entry.company.id) {
        return ctx.unauthorized("This action is unauthorized.You are not from the same company as the entry.");
      } else {
        return next();
      }
    }
    // else {
    // await next();
    //
    // const response = ctx.response.body;
    // console.log("response", response)
    // const data = response.data;
    // console.log("data", data)
    //
    // // let filteredData = [];
    // //
    // // for (let item in data) {
    // //   console.log("d", data[item].attributes)
    // //   if (user.company.id === data[item].attributes.company.id) {
    // //     filteredData.push(data[item])
    // //   }
    // // }
    // //
    // // response.data = filteredData;
    // // return next();
    // }
  };
};
