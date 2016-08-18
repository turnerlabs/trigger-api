"use strict";

const HOME = process.env.HOME || process.env.USERPROFILE;
const providers = require(HOME + '/.harbor/providers.json');

module.exports = providers;
