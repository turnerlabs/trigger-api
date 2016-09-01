"use strict";

const deepcopy = require('deepcopy');
const errorFunction = require('../../helpers/errorFunction');
const setEnvVars = require('../../helpers').setEnvVars;
const shipitApi = require('../../core/shipitApi');
const getDeployment = require('./getDeployment');
const getNamespace = require('./getNamespace');
const getSecrets = require('./getSecrets');

module.exports = trigger;

function trigger(shipment, environment, provider, client) {
    let promise = shipitApi.getShipment(shipment, environment).catch(errorFunction)
         //  .then((res) => res.json(), errorFunction)
        .then((shipment) => _parseShipment(shipment), errorFunction).catch(errorFunction)
        .then((shipment) => _launchShipment(shipment, provider, client), errorFunction).catch(errorFunction);
    return promise;
}

function _launchShipment(shipment, provider, client) {
    let promise = new Promise((resolve, reject) => {
        let _provider = shipment.getProvider(provider),
            deployment = getDeployment(shipment, _provider, []);
        
        // post namespace to k8s
        createNamespace(shipment, _provider, client).then((data) => {
            return data;
        }, (error) => {
            reject(error);
        })
        .then((data) => {
            console.log('fetched namespace', data);
            let promise = getSecrets(shipment, _provider),
                promises = [];
                
            return promise.then((secrets) => {
                secrets.forEach((secret) => {
                    promises.push(createSecret(secret, client));
                });
                return Promise.all(promises);
            });
        }, (error) => {
            console.log('ERROR => ', error);
            reject(data);
        })
        .then((data) => {
            console.log('Creating/Updating Deployment');
            return createDeployment(shipment, _provider, client);
        }, (error) => {
            console.log('ERROR => ', error);
            reject(error);
        }).then((data) => {
            console.log('created deployment', data);
            // set client back
            client.domain = client.endpoint + client.version + '/';
            resolve(data);
        }, (error) => {
            console.log('ERROR => ', error);
            // set client back
            client.domain = client.endpoint + client.version + '/';
            reject(error);
        })
        // post deployment to k8s

        // create ELB of specified type. Only allow ALB for now.
    });
    
    return promise;
}

function createDeployment(shipment, provider, client) {
    return new Promise(_getDeployment);
    
    function _getDeployment(resolve, reject) {
       let deploymentJson = getDeployment(shipment, provider),
           path = `/namespaces/${deploymentJson.metadata.namespace}/deployments/thedeployment`;
          
        client.domain = client.endpoint + '/apis/extensions/v1beta1';
        client.get(path).then((data) => {
            // We need to send a PUT here to update our current deployment
            console.log(`Deployment exists for namespace: ${deploymentJson.metadata.name}`);
            // update deployment
            client.put(`/namespaces/${deploymentJson.metadata.namespace}/deployments/thedeployment`, deploymentJson).then((data) => {
                resolve(data);
            }, deploymentCRUDError).catch(errorFunction);
        }, (error) => {
            error = JSON.parse(error);
            if (error.kind === 'Status' && error.code === 404) {
                client.post(`/namespaces/${deploymentJson.metadata.namespace}/deployments`, deploymentJson).then((data) => {
                    resolve(data);
                }, deploymentCRUDError).catch(errorFunction);
            } else {
                reject(error);
            }
        }).catch(errorFunction);
        
        function deploymentCRUDError(error) {
              if (!error) {
                  error = {code: 500, message: `Could not Create Deployment for namespace: ${deploymentJson.metadata.name}`}
              }
              reject(error);
        }
    }
}

function createSecret(secretJson, client) {
    
    return new Promise(_getSecret);
    
    function _getSecret(resolve, reject) {
       let path = `namespaces/${secretJson.metadata.namespace}/secrets/${secretJson.metadata.name}`;
        
        client.get(path).then((data) => {
            // secret exists, delete it
            console.log(`Secret "${secretJson.metadata.name}" exists for namespace: ${secretJson.metadata.namespace}`);
            return client.delete(`namespaces/${secretJson.metadata.namespace}/secrets/${secretJson.metadata.name}`).then((data) => {
                return data;
            }, (error) => {
                console.log(error)
                return error;
            })
        }, (error) => {
            return error;
        }).then((data) => {
            return postSecret();
        }, (error) => {
            reject(error);
        });
        
        function postSecret() {
          return client.post(`namespaces/${secretJson.metadata.namespace}/secrets`, secretJson).then((data) => {
              resolve(data);
          }, (error) => {
              console.log('error', error)
              reject(error);
          }).catch(errorFunction);
        }
    }
}


function createNamespace(shipment, provider, client) {
    
    return new Promise(_getNamespace);
    
    function _getNamespace(resolve, reject) {
       let namespaceJson = getNamespace(shipment, provider),
           path = `namespaces/${namespaceJson.metadata.name}`;
          
        client.get(path).then((data) => {
            // do nothing as we have already created the namespace
            console.log(`Namespace exists ${namespaceJson.metadata.name}`);
            resolve(data);
        }, (error) => {
            error = JSON.parse(error);
            if (error.kind === 'Status' && error.code === 404) {
                client.post('namespaces', namespaceJson).then((data) => {
                    resolve(data);
                }, (error) => {
                    reject(error);
                }).catch(errorFunction);
            } else {
                reject(error);
            }
        }).catch(errorFunction);
    }
}

function _parseShipment(rawShipment) {
    let promise = new Promise((resolve, reject) => {
        let shipment = new Shipment(rawShipment);
        resolve(shipment);
    });
    
    return promise;
}


class Shipment {
  constructor(raw) {
      Object.assign(this, { parentShipment: raw.parentShipment, providers: raw.providers, containers: raw.containers });
      this.name = raw.parentShipment.name;
      this.environment = raw.name;
      this.envVars = raw.envVars;
  }
  
  getProviders() {
      let envVars = [],
          providers = [];
          
      this.providers.map((provider) => {
          let containers = [];
          envVars = setEnvVars(envVars, this.parentShipment.envVars);
          envVars = setEnvVars(envVars, this.envVars);
          envVars = setEnvVars(envVars, provider.envVars);
          
          this.containers.map((container) => {
              let containerEnvVars = [];
              let copiedContainer = deepcopy(container);
              containerEnvVars = setEnvVars(containerEnvVars, envVars);
              containerEnvVars = setEnvVars(containerEnvVars, container.envVars);
              copiedContainer.envVars = containerEnvVars;
              containers.push(copiedContainer);
          });
          
          providers.push({
            name: provider.name, 
            replicas: provider.replicas,
            metadata: provider.metadata,
            envVars, 
            containers
          });
      });
      
      return providers;
  }
  
  getProvider(providerName) {
      let providers = this.getProviders(),
          requestedProvider;
          
      providers.forEach((provider) => {
          if (provider.name === providerName) {
              requestedProvider = provider;
          }
      });
      
      if (!requestedProvider) {
          console.log(`No provider found in shipment:${this.name}-${this.environment} with name ${providerName}`)
      }
      
      return requestedProvider;
  }
}
