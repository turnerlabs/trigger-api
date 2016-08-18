"use strict";

const getEndpoints = require('./getEndpoints');

module.exports = { 
    init
};

function init(config) {
    let dockerClient = {};
    dockerClient.getEndpoints = getEndpoints;
    return dockerClient;
}
