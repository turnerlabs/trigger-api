"use strict";

module.exports = getSecrets;

let DOCKER_KEY = 'HARBOR_DOCKERCFG';

function getSecrets(shipment, provider) {
  let namespace = shipment.name + '-' + shipment.environment;
  
  // returning a promise here, because we may want to get more sophistocated on how we retrieve 
  // dockercfgs. For now its just any environmnet variable with HARBOR_DOCKERCFG as the prefix.
  return getDockercfgs().then((dockercfgs) => {
      let secrets = [];
      dockercfgs.forEach((dockercfg) => {
          let secret = {
              kind: "Secret",
              apiVersion: "v1",
              metadata: {
                  name: dockercfg.name,
                  namespace: `${namespace}`
              },
              data: {
                  ".dockerconfigjson": dockercfg.value
              },
              type: "kubernetes.io/dockerconfigjson"
          }
          secrets.push(secret);
      });
      return secrets;
  });
}

function getDockercfgs() {
  return new Promise((resolve, reject) => {
      let dockercfgs = [];
      Object.keys(process.env).forEach((key) => {
          if (key.indexOf(DOCKER_KEY) !== -1) {
              dockercfgs.push({name: key.replace(/_/g, '-').toLowerCase(), value: process.env[key]});
          }
      })
      resolve(dockercfgs);
  });
}
