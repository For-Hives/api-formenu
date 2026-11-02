'use strict';

/**
 * company controller: a user only sees and edits their own company
 * (see utils/company-scope).
 *
 * `users` and `menus` are the inverse side of the company of a user and of a
 * menu: writing them would move a user or a menu of another company into this
 * one, so they are dropped from the body. Companies are created by an
 * operator in the Strapi admin panel, not through the content API.
 */

const { companyScopedController } = require('../../../utils/company-scope');

module.exports = companyScopedController('api::company.company', {
  readOnlyFields: ['users', 'menus'],
  allowCreate: false,
});
