'use strict';

/**
 * menu controller: rows of the caller's company only (see utils/company-scope)
 */

const { companyScopedController } = require('../../../utils/company-scope');

module.exports = companyScopedController('api::menu.menu');
