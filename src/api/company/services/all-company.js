"use strict";
const {removePropsRecursively} = require("../../../utils/remove-props-recursively");

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
        populate: {
          menus: {
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
                    },
                    company: {
                      populate: '*'
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
                      icon: {
                        populate: '*'
                      },
                      company: {
                        populate: '*'
                      },
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
                      },
                    }
                  }
                }
              }
            },
          },
          content: {
            populate: '*'
          }
        }
      }
    );

    data.forEach(record => removePropsRecursively(record));
    return data;
  },
};
