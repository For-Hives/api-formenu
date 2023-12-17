"use strict";

module.exports = {
    findMyIngredients: async (user) => {
        // Récupérer l'ID de la société associée à l'utilisateur
        const companyId = user.company.id;

        // Utiliser Strapi pour requêter la base de données
        const ingredients = await strapi.entityService.findMany(
            "api::ingredient.ingredient",
            {
                where: {
                    company: companyId,
                },
                populate: { /* champs à peupler si nécessaire */ },
            }
        );
        console.log('(services) findMyIngredients - ingredients', ingredients);

        return ingredients;
    },
};