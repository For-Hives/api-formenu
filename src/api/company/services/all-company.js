"use strict";

module.exports = {
  allCompany: async () => {
    let data = await strapi.entityService.findMany(
      "api::company.company",
      {
        fields: [
          'id',
          'name',
          'country',
          'city',
          'street',
          'postcode',
          'slug'
        ],
        populate: {
          menus: {
            populate: {
              image: {
                populate: '*'
              },
              company: {
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
                  company: {
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
                      company: {
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
          },
          content:{
            populate: '*'
          }
        }
      }
    );

    /**
     * Remove props recursively
     * @param obj
     */
    // const removePropsRecursively = (obj) => {
    //   if (obj && typeof obj === 'object') {
    //     delete obj.createdBy;
    //     delete obj.updatedBy;
    //
    //     for (let key in obj) {
    //       if (obj.hasOwnProperty(key)) {
    //         removePropsRecursively(obj[key]);
    //       }
    //     }
    //   }
    // }
    // data.forEach(record => removePropsRecursively(record));
    return data;
  },
};
