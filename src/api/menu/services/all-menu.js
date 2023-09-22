"use strict";

/**
 * init-makeup service
 */

module.exports = {
  allMenu: async () => {
    const data = await strapi.entityService.findMany(
      "api::menu.menu",
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
          company: {
            fields: [
              'id',
              'name',
              'description',
              'country',
              'city',
              'street',
              'postcode'
            ],
            populate: {
              logo: {
                populate: '*'
              },
              background: {
                populate: '*'
              },
              // menus:{
              //   populate: '*'
              // }
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
                }
              },
              dishes: {
                populate: {
                  dishes: {
                    populate: '*'
                  },
                  image: {
                    populate: '*'
                  },
                  type_dish: {
                    fields:[
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

    return data;
  },
};
