"use strict";
const {stripSensitiveData} = require("../../../utils/sanitize-output");
const {INGREDIENT_FIELDS, SIDE_DISH_FIELDS} = require("../../../utils/public-fields");

module.exports = {
  allCompany: async () => {
    const today = new Date();
    let data = await strapi.entityService.findMany(
      "api::company.company",
      {
        filters: {
          activated: true,
          suscribe_date_start: {
            $lte: today
          },
          suscribe_date_end: {
            $gte: today
          }
        },
        fields: [
          'id',
          'name',
          'country',
          'city',
          'street',
          'postcode',
          'slug',
          'color',
          'fonts',
          'fonts_title',
          'activated',
          'suscribe_date_start',
          'suscribe_date_end',
        ],
        // Explicit selections only. Never `populate: '*'` here: it loads every
        // relation of the target (the users of a company, the `related` rows
        // of a media...). And no `company` below the root: the root already
        // is the company.
        populate: {
          menus: {
            populate: {
              image: true,
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
                    },
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
                    filters: {
                      is_sidedish: {
                        $ne: true // This will exclude dishes where is_sidedish is true
                      }
                    },
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
                      },
                    }
                  }
                }
              }
            },
          },
          content: {
            populate: {
              home_image: true,
              home_background_images: true
            }
          }
        }
      }
    );

    return stripSensitiveData(data);
  },
};
