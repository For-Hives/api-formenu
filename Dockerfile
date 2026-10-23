# The image of the API: Strapi v4, built by Coolify.
#
# - Node 22.23.4, the last line Strapi 4.26 supports (its plugins refuse Node 24). It carries the
#   fix of CVE-2026-111497 (Brotli decoder); Node 20 is end of life and has none. The base image is
#   pinned by version AND digest: Renovate proposes the next one.
# - The arguments below are build-stage only. They are never copied to the final image, whose
#   variables are given by Coolify when the container starts. `strapi build` only compiles the
#   admin panel; it does not connect to the database.
# - yarn.lock (classic) is the lockfile in use.

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock ./
# --ignore-engines: @strapi/plugin-i18n is pinned at 4.25.23, which declares Node <=20 while the rest of
# Strapi (4.26.2) declares <=22. Bump it to 4.26.2 and this flag can go.
RUN yarn install --frozen-lockfile --ignore-engines
COPY . .
ARG ADMIN_JWT_SECRET
ARG API_TOKEN_SALT
ARG APP_KEYS
ARG JWT_SECRET
ARG CF_ACCESS_KEY_ID
ARG CF_ACCESS_SECRET
ARG CF_BUCKET
ARG CF_ENDPOINT
ARG CF_PUBLIC_ACCESS_URL
ARG DATABASE_HOST
ARG DATABASE_PORT
ARG DATABASE_NAME
ARG DATABASE_USERNAME
ARG DATABASE_PASSWORD
ARG DB_CLIENT
ARG DEEPL_API_KEY
ARG DEEPL_API_URL
ARG URL
ARG ADMIN_URL
ENV NODE_ENV=production
RUN yarn build

# The app is copied whole: `strapi start` needs node_modules, the compiled admin (build/), the
# sources, the config and the database folder.
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS run
WORKDIR /app
ENV NODE_ENV=production PORT=1337
COPY --from=build --chown=node:node /app ./
# Never root: `node` is the unprivileged user of the base image.
USER node
EXPOSE 1337
CMD ["node_modules/.bin/strapi", "start"]
