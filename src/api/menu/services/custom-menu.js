"use strict";

module.exports = {
    menuDeep: async (id) => {
        let data = await strapi.entityService.findOne("api::menu.menu", id, {
            fields: ['id', 'title', 'description', 'activated', 'locale'], populate: {
                image: true, categories: {
                    fields: ['id', 'name', 'locale', 'depth', 'order'], populate: {
                        icon: true, category: {
                            fields: ['id', 'name', 'locale', 'depth', 'order'], populate: {icon: true}
                        }, categories: {
                            fields: ['id', 'name', 'locale', 'depth', 'order'], populate: {icon: true}
                        }, dishes: {
                            fields: ['id', 'name', 'description', 'activated', 'is_allergen_gluten', 'is_allergen_shellfishes', 'is_allergen_eggs', 'is_allergen_fishes', 'is_allergen_peanuts', 'is_allergen_soybeans', 'is_allergen_milk', 'is_allergen_nuts', 'is_allergen_celery', 'is_allergen_mustard', 'is_allergen_sesams', 'is_allergen_sulphurous_anhydre', 'is_allergen_lupins', 'is_allergen_mollusks', 'is_vegetarian', 'is_vegan', 'is_sidedish', 'order', 'price', 'available_date_start', 'available_date_end', 'is_pescetarian'],
                            populate: {
                                category: true, ingredients: true, image: true, type_dish: {fields: ['id', 'name', 'color'], populate: {icon: true}}
                            }
                        }
                    }
                }
            }
        });
        return data;
    },
};
