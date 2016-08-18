"use strict";

module.exports = noClientError;

function noClientError(provider, res) {
    let msg = `ERROR => there is no provider configured with the name ${provider}`;
    res.status(500);
    res.json({code: 500, msg: msg});
}
