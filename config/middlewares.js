module.exports = ({ env }) => {
  return [
    "strapi::errors",
    {
      name: "strapi::security",
      config: {
        cors: {},
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "connect-src": ["'self'", "https:"],
            "img-src": [
              "'self'",
              "data:",
              "blob:",
              env("CF_PUBLIC_ACCESS_URL")?.replace(/^https?:\/\//, ""),
            ],
            "media-src": [
              "'self'",
              "data:",
              "blob:",
              env("CF_PUBLIC_ACCESS_URL")?.replace(/^https?:\/\//, ""),
            ],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    "strapi::cors",
    "strapi::poweredBy",
    "strapi::logger",
    "strapi::query",
    "strapi::body",
    "strapi::session",
    "strapi::favicon",
    "strapi::public",
  ];
};
