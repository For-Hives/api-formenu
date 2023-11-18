"use strict";

module.exports = {
  menuDeep: async (id) => {
    let data = await strapi.entityService.findOne(
      "api::menu.menu",
      id,
      {
        fields: ['id', 'title', 'description', 'activated', 'locale'],
        populate: {
          image: true,
          categories: {
            fields: ['id', 'name', 'locale', 'depth', 'order'],
            populate: {
              icon: true,
              category: {
                fields: ['id', 'name', 'locale', 'depth', 'order'],
                populate: { icon: true }
              },
              categories: {
                fields: ['id', 'name', 'locale', 'depth', 'order'],
                populate: { icon: true }
              },
              dishes: {
                fields: ['id', 'name', 'description', 'activated'],
                populate: {
                  ingredients: true,
                  image: true,
                  type_dish: { fields: ['id', 'name', 'color'], populate: { icon: true } }
                }
              }
            }
          }
        }
      }
    );
    return data;
  },
};
