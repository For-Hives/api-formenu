"use strict";
const {stripSensitiveData} = require("../../../utils/sanitize-output");
const {INGREDIENT_FIELDS, SIDE_DISH_FIELDS} = require("../../../utils/public-fields");

module.exports = {
  allMenu: async () => {
    let data = await strapi.entityService.findMany(
      "api::menu.menu",
      {
        fields: [
          'id',
          'title',
          'description',
          'activated',
          'locale'
        ],
        // Explicit selections only, never `populate: '*'` (see all-company.js)
        populate: {
          image: true,
          company: {
            fields: [
              'id',
              'name',
              'description',
              'country',
              'city',
              'street',
              'postcode'
            ]
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
              icon: true,
              category: {
                fields: [
                  'id',
                  'name',
                  'locale',
                  'depth',
                  'order'
                ],
                populate: {
                  icon: true
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
                  icon: true
                },
                sort: {order: 'ASC'},
              },
              dishes: {
                populate: {
                  ingredients: {
                    fields: INGREDIENT_FIELDS
                  },
                  dishes: {
                    fields: SIDE_DISH_FIELDS,
                    populate: {
                      ingredients: {
                        fields: INGREDIENT_FIELDS
                      }
                    }
                  },
                  image: true,
                  type_dish: {
                    fields: [
                      'id',
                      'name',
                      'color',
                    ],
                    populate: {
                      icon: true
                    }
                  }
                }
              }
            }
          }
        },
      }
    );

    return stripSensitiveData(data);
  },
};
