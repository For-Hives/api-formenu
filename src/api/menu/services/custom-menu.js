"use strict";

const { removePropsRecursively } = require("../../../utils/remove-props-recursively");

module.exports = {
  menuDeep: async (id) => {
    let data = await strapi.entityService.findOne(
      "api::menu.menu",
      id,
      {
        fields: [
          'id',
          'title',
          'description',
          'activated',
          'locale'
        ],
        populate: {
          image: {
            populate: '*'
          },
          categories: {
            fields: [
              'id',
              'name',
              'locale',
              'depth',
              'order'
            ],
            sort: {order: 'ASC'},
            populate: {
              icon: {
                populate: '*'
              },
              category: {
                fields: [
                  'id',
                  'name',
                  'locale',
                  'depth',
                  'order'
                ],
                populate: {
                  icon: {
                    populate: '*'
                  }
                }
              },
              categories: {
                fields: [
                  'id',
                  'name',
                  'locale',
                  'depth',
                  'order'
                ],
                populate: {
                  icon: {
                    populate: '*'
                  }
                },
                sort: {order: 'ASC'},
              },
              dishes: {
                populate: {
                  ingredients: {
                    populate: '*'
                  },
                  dishes: {
                    populate: '*'
                  },
                  image: {
                    populate: '*'
                  },
                  type_dish: {
                    fields: [
                      'id',
                      'name',
                      'color',
                    ],
                    populate: {
                      icon: {
                        populate: '*'
                      }
                    }
                  }
                }
              }
            }
          }
        },
      }
    );
    removePropsRecursively(data);
    return data;
  },
};
