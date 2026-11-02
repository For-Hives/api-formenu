'use strict';

const { backfillFileOwners } = require('./utils/file-ownership');
const { fileRelatedSanitizer } = require('./utils/sanitize-output');

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // no `related` of a file in any response of the content API
    // (see utils/sanitize-output)
    strapi.sanitizers.add('content-api.output', fileRelatedSanitizer);
  },

  /**
   * Runs after the database schema is synchronised, so the `ownerCompany`
   * column of the files exists (a `database/migrations` file runs before the
   * sync, when it does not exist yet on the first deploy).
   *
   * Records the owner of the files uploaded before owners were recorded,
   * when their links name a single company. Idempotent: it only reads the
   * files without an owner, and never changes an owner already set. A failure
   * is logged and does not stop the start-up: the same deduction is made on
   * the fly by the upload checks (see utils/file-ownership).
   */
  async bootstrap({ strapi }) {
    try {
      const { assigned, unsettled } = await backfillFileOwners();
      if (assigned > 0 || unsettled > 0) {
        strapi.log.info(
          `[file-ownership] owner recorded on ${assigned} file(s), ${unsettled} file(s) without a single owning company`
        );
      }
    } catch (error) {
      strapi.log.error(`[file-ownership] backfill failed: ${error.message}`);
    }
  },
};
