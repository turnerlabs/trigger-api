"use strict";

const k8s = require('k8s');
const trigger = require('./trigger');
const K8S_API_VERSION = process.env.K8S_API_VERSION || '/api/v1';

module.exports = { 
    init
};

function init(config) {
    return (() => {
      let { context, cluster, user } = parseConfig(config);
      let client = (cluster, user) => {
          let kubeClient = getKubeClient(cluster, user);
          this.getEndpoints = () => {
              return kubeClient.get('/');
          }
          this.trigger = (shipment, environment, provider) => {
              return trigger(shipment, environment, provider, kubeClient);
          }
          return this;
      };
      
      return client(cluster, user);
    })();
}

function getKubeClient(cluster, user) {
    let options = {
        endpoint: cluster.server,
        version: K8S_API_VERSION,
        auth: {}
    };
    
    // if the kubeCfg contains the base64 encoded certificate values
    if (user['client-key-data'] && user['client-certificate-data'] && cluster['certificate-authority-data']) {
        options.auth.clientKey = Buffer.from(user['client-key-data'], 'base64').toString();
        options.auth.clientCert = Buffer.from(user['client-certificate-data'], 'base64').toString();
        options.auth.caCert = Buffer.from(cluster['certificate-authority-data'], 'base64').toString();
    }
    
    // // if user has a token in their kube config
    if (user.token && cluster['certificate-authority-data']) {
        options.auth.token = user.token;
        options.strictSSL = false;
    }
    
    // we do not support username and password currently
    // the k8s client does, but we are going to leave it out.
    let client = k8s.api(options);
    client.endpoint = cluster.server;
    client.version = K8S_API_VERSION;
    return client;
}

function parseConfig(config) {
    let kubeContext = require('./getKubeCfg')(config.kubeCfgLocation, config.name);
    return kubeContext;
}
