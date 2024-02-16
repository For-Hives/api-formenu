"use strict";

module.exports = {
    updateMe: async (user, json) => {
        if (!user) {
            throw new Error("User not found");
        }

        // Prepare update data
        const updateData = {
            username: json.username,
            firstname: json.firstname,
            lastname: json.lastname,
            email: json.email,
            phoneNumber: json.phoneNumber,
            profilePicture: json.profilePicture
        };

        return strapi.entityService.update(
            "plugin::users-permissions.user",
            user.id,
            {
                data: updateData,
            }
        );
    },
};



