"use strict";

const { errors } = require("@strapi/utils");

const normalizeEmail = (email) =>
    typeof email === "string" ? email.trim().toLowerCase() : email;

module.exports = {
    updateMe: async (user, json) => {
        if (!user) {
            throw new Error("User not found");
        }

        // The email is the login of the account: changing it here, without
        // proving the new address, would let a stolen session take the
        // account over for good. It is changed by an operator for now.
        if (
            json.email !== undefined &&
            normalizeEmail(json.email) !== normalizeEmail(user.email)
        ) {
            throw new errors.ForbiddenError(
                "The email of an account cannot be changed here."
            );
        }

        // Prepare update data
        const updateData = {
            username: json.username,
            firstname: json.firstname,
            lastname: json.lastname,
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
