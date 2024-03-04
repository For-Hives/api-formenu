"use strict";

module.exports = {
    findMyMenus: async (user) => {
        // Récupérer l'ID de la société associée à l'utilisateur
        const userPopulated = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
            populate: { company: true },
        });
        if (!userPopulated || !userPopulated.company) {
            throw new Error("User or user's company is undefined");
        }
        const companyId = userPopulated.company.id;

        // Utiliser Strapi pour requêter la base de données
        const menus = await strapi.entityService.findMany(
            "api::menu.menu",
            {
                where: {
                    company: companyId,
                },
                populate: {
                    // populate there
                },
            }
        );

        return menus;
    },
};