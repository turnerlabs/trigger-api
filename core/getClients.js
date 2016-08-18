"use strict";

let providers = require('../providers');

module.exports = getClients;

function getClients(config) {
    let clientMap = {};
    config.providers.forEach((provider) => {
        clientMap[provider.name] = getClient(provider);
    });
    return clientMap;
}

function getClient(provider) {
    let clientScaffold = providers[provider.type];
    
    if (!clientScaffold) {
        let msg = `passed in a provider type that does not exist. ${provider.type}`;
        console.log('ERROR => ', msg);
        return {code: 500, msg: msg};
    }
    
    return new clientScaffold.init(provider);
}
