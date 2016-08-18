"use strict";

const fetch = require('node-fetch');
const errorFunction = require('../../helpers/errorFunction');
module.exports = getEndpoints;

function getEndpoints(host, port) {
    console.log('getEndpoints', host, port, secrets);
    return () => {
        fetch(`${host}:${port}/`)
            .then((res) => res.json(), errorFunction)
            .then((endpoints) => endpoints)
    }
}
