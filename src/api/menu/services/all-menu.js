"use strict";

/**
 * init-makeup service
 */

module.exports = {
  allMenu: async () => {
    const data = await strapi.entityService.findMany(
      "api::menu.menu",
      {
        populate: {
          company: {
            populate: '*'
          },
          categories: {
            populate: {
              category:{
                populate: '*'
              },
              categories:{
                populate: '*'
              },
              dishes: {
                populate: {
                  dishes:{
                    populate: '*'
                  },
                }
              }
            }
          }
        },
      }
    );

    return data;
  },
};
