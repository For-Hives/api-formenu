"use strict";

const { errors } = require("@strapi/utils");
const { assertMediaInCompany } = require("../../../utils/file-ownership");

const USER_UID = "plugin::users-permissions.user";

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

        // The profile picture is a file of the user's company, or the one the
        // user already has: never the file of another restaurant (see
        // utils/file-ownership). A user without a company can only keep or
        // remove theirs.
        if (json.profilePicture !== undefined && json.profilePicture !== null) {
            const account = await strapi.entityService.findOne(USER_UID, user.id, {
                populate: { company: true },
            });
            const companyId = account && account.company ? account.company.id : null;
            await assertMediaInCompany(
                USER_UID,
                { profilePicture: json.profilePicture },
                companyId,
                { entryId: user.id }
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
            USER_UID,
            user.id,
            {
                data: updateData,
            }
        );
    },
};
