"use strict";

/**
 * Field whitelists shared by the public read endpoints (/api/all-company and
 * /api/all-menu). They replace `populate: '*'`, which loads every relation of
 * the target (its company, the other dishes using an ingredient, the
 * localizations...) instead of the few fields the clients read.
 */

// What the fronts read on an ingredient: its name and its availability.
const INGREDIENT_FIELDS = [
  "id",
  "name",
  "activated",
  "available_date_start",
  "available_date_end",
];

// What the fronts read on a side dish (the `dishes` of a dish): its name, its
// availability, its allergens and its diets.
const SIDE_DISH_FIELDS = [
  "id",
  "name",
  "activated",
  "available_date_start",
  "available_date_end",
  "is_allergen_gluten",
  "is_allergen_shellfishes",
  "is_allergen_eggs",
  "is_allergen_fishes",
  "is_allergen_peanuts",
  "is_allergen_soybeans",
  "is_allergen_milk",
  "is_allergen_nuts",
  "is_allergen_celery",
  "is_allergen_mustard",
  "is_allergen_sesams",
  "is_allergen_sulphurous_anhydre",
  "is_allergen_lupins",
  "is_allergen_mollusks",
  "is_vegetarian",
  "is_vegan",
  "is_sidedish",
  "is_pescetarian",
];

module.exports = {
  INGREDIENT_FIELDS,
  SIDE_DISH_FIELDS,
};
