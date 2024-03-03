"use strict";

module.exports = {
    findMyCategories: async (user) => {
        // Récupérer l'ID de la société associée à l'utilisateur
        const userPopulated = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
            populate: { company: true },
        });
        if (!userPopulated || !userPopulated.company) {
            throw new Error("User or user's company is undefined");
        }
        const companyId = userPopulated.company.id;

        // Utiliser Strapi pour requêter la base de données
        const categories = await strapi.entityService.findMany(
            "api::category.category",
            {
                where: {
                    company: companyId,
                },
                populate: {
                    category: true, categories: true, icon: true, dishes: true, menu: true
                },
            }
        );

        return categories;
    },
};