"use strict";

module.exports = {
  updateMe: async (user, json) => {
    if (!user) {
      throw new Error("User not found");
    }


    // strapi.entityService.findOne(
    //   "plugin::users-permissions.user",
    //   ctx.state.user.id,
    //   {
    //     populate: [
    //       "role"
    //     ],
    //   }
    // )

    //
    // // find if makeup artist already exists for user
    // const existing = await strapi.entityService.findMany(
    //   "api::makeup-artiste.makeup-artiste",
    //   {
    //     fields: ["id"],
    //     filters: {
    //       user: {
    //         id: {
    //           $eq: user.id,
    //         },
    //       },
    //     },
    //   }
    // );
    //
    // if (!existing || existing.length !== 1) {
    //   throw new Error("Makeup artist does not exist for this user");
    // }

    // Prepare update data
    const updateData = {
      username: json.username,
      firstname: json.firstname,
      lastname: json.lastname,
      email: json.email,
      phoneNumber: json.phoneNumber,
      profilePicture: json.profilePicture
    };

    console.log("updateData", updateData)

    // update the makeup artist linked to user
    return strapi.entityService.update(
      "plugin::users-permissions.user",
      user.id,
      {
        data: updateData,
      }
    );
  },
};



