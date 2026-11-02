'use strict';

/**
 * ingredient controller: rows of the caller's company only (see utils/company-scope)
 */

const { companyScopedController } = require('../../../utils/company-scope');

module.exports = companyScopedController('api::ingredient.ingredient');
