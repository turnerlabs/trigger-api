"use strict";

const deepcopy = require('deepcopy');
const errorFunction = require('../../helpers/errorFunction');
const setEnvVars = require('../../helpers').setEnvVars;
const shipitApi = require('../../core/shipitApi');
const getDeployment = require('./getDeployment');
const getNamespace = require('./getNamespace');
const getSecrets = require('./getSecrets');
const getServiceData = require('./getService');
const HEALTHCHECK_DELAY_SECS = 30;

module.exports = trigger;

function trigger(shipment, environment, provider, client) {
    let promise = shipitApi.getShipment(shipment, environment)
         //  .then((res) => res.json(), errorFunction)
        .then((shipment) => _parseShipment(shipment))
        .then((shipment) => _launchShipment(shipment, provider, client));
    return promise;
}

function _launchShipment(shipment, provider, client) {
    let promise = new Promise((resolve, reject) => {
        let _provider = shipment.getProvider(provider);
        
        // post namespace to k8s
        createNamespace(shipment, _provider, client).then((data) => {
            return data;
        })
        .then((data) => {
            return createService(shipment, client);
        })
        .then((data) => {
           // set containers onto shipment as k8s expects
           return getContainers(shipment, _provider);
        })
        .then((data) => {
            // set containers on shipment. These were retrieved from 
            // the previus step
            shipment.containers = data.containers;
            shipment.primary = data.primary;
            
            console.log('fetched namespace', data);
            let promise = getSecrets(shipment, _provider),
                promises = [];
                
            return promise.then((secrets) => {
                secrets.forEach((secret) => {
                    promises.push(createSecret(secret, client));
                });
                return Promise.all(promises);
            });
        })
        .then((data) => {
            console.log('Creating/Updating Deployment');
            let secrets = data.map((secret) => {
                return {name: secret.metadata.name};
            });
            return createDeployment(shipment, _provider, secrets, client);
        }).then((data) => {
            console.log('created deployment', data);
            // set client back
            client.domain = client.endpoint + client.version + '/';
            resolve(data);
        }, (error) => {
            // set client back
            client.domain = client.endpoint + client.version + '/';
            reject(error);
        });
        // post deployment to k8s

        // create ELB of specified type. Only allow ALB for now.
    });
    
    return promise;
}

function createDeployment(shipment, provider, secrets, client) {
    return new Promise(_getDeployment);
    
    function _getDeployment(resolve, reject) {
       let deploymentJson = getDeployment(shipment, provider, secrets),
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

function createService(shipment, client) {
    
    let namespace = shipment.name + '-' + shipment.environment;
    return new Promise(_getService);
    
    function _getService(resolve, reject) {
       let path = `namespaces/${namespace}/services`;
        
        client.get(path).then((data) => {
            let services;
            // if service exists, return this value, if not then let's create a new one
            if (data.items.length > 0) { 
                console.log(`Service "${shipment.name}" exists`);
                services = data.items.filter((service) => {
                    if (service.metadata.labels && service.metadata.labels.name === shipment.name && service.metadata.labels.environment === shipment.environment ) {
                        return service;
                    }
                });
                if (services[0]) {
                    return services[0];
                } else {
                    // did not find service 
                    return false;
                }
            } else {
              return false;
            }
        }, (error) => {
            console.log('INFO =>', `404: Service ${namespace} Not Found`);
            return false;
        }).then((data) => {
            if (!data) {
                return postService();
            } else {
                resolve(data);
                return data;
            }
        }, (error) => {
            reject(error);
        });
        
        function postService() {
          return getServiceData(shipment, client).then((serviceJson) => {
              return client.post(`namespaces/${namespace}/services`, serviceJson).then((data) => {
                  resolve(data);
              }, (error) => {
                  reject(error);
              }).catch(errorFunction);
          });
        }
    }
}

function getContainers(shipment, provider) {
  
    return new Promise(_getContainers);
    
    function _getContainers(resolve, reject) {
        
        let containers = provider.containers.map((container) => {
            container.config = {};
            container.config.PRODUCT = shipment.name;
            container.config.ENVIRONMENT = shipment.environment;
            container.config.LOCATION = provider.name;
            
            // could get the config from the manifest here, but nah
            
            // test for valid HEALTHCHECK
            let healthcheck = getHealthchecks(container);
            
            if (healthcheck.message) {
                reject(healthcheck.message);
                return healthcheck.message;
            }
            
            if (healthcheck.protocol === 'tcp') {
                container.livenessProbe = { 
                  type: 'tcp', 
                  initialDelaySeconds: HEALTHCHECK_DELAY_SECS,
                  tcpSocket: { port: healthcheck.value }
                }
            } else {
                container.livenessProbe = {
                  type: 'http', 
                  initialDelaySeconds: HEALTHCHECK_DELAY_SECS,
                  httpGet: { path: healthcheck.healthcheck, port: healthcheck.value }
                }
            }
        
            container.config.HEALTHCHECK = healthcheck.healthcheck;
            container.config.PORT = healthcheck.value;
            container.env = [];
            for (let key in container.config) {
                container.env.push({name: key, value: container.config[key] + ''});
            }
            container.env = setEnvVars(container.env, container.envVars);
            return container;
        });
        
        // this is the primary object that gives us information for edge level healthchecks
        let primary = getPrimaryContainer(provider.containers);
        
        if (primary.message) {
            reject(primary.message);
            return primary.message;
        }
        
        console.log('INFO', 'Primary Container', primary.container);
        console.log('INFO', 'Primary Port', primary.port);
        resolve({containers, primary});
    }
}

function getPrimaryContainer(containers) {
    let primary;
        
    containers.forEach((container) => {
        let primaryPorts = container.ports.filter((port) => {
            if (port.primary) {
                return port;
            }
        });
        
        container.ports = container.ports.map((port) => {
            return {containerPort: port.value};
        });
        
        if (primaryPorts.length > 1) {
            primary = {code: 500, message: `Multiple primary ports configured for container ${container.name}, only one allowed per container`};
        }  else if (primaryPorts.length === 1) {
            if (primary) {
                primary = {code: 500, message: `Multiple primary ports across multiple containers, only allowed one primary port per shipment`};
            } else {
                primary = {
                  port: primaryPorts[0],
                  container: container
                };  
            }
        }
    });
    
    if (!primary) {
        primary = {code: 500, message: `No primary port defined on shipment`};
    }
    
    return primary;
}

function getHealthchecks(container) {
  
    if (!container.ports) {
        return {code: 500, message: `No ports found on container ${container.name}, check configuration`};
    }
    
    let healthchecks = container.ports.filter((port) => {
        if (port.healthcheck) {
            return port;
        }
    });
    
    if (healthchecks.length === 0) {
        return {code: 500, message: `No healthcheck found on any ports for container ${container.name}, check configuration`};
    } else if (healthchecks.length > 1) {
        return {code: 500, message: `Ambiguous healthcheck found for container ${container.name}, only one healthcheck allowed per container`};
    }
    
    return healthchecks[0];
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
                console.log('ERROR =>', `${secretJson.metadata.namespace} Error Deleting Secret`);
                reject(false);
            });
        }, (error) => {
            console.log('INFO =>', `404: ${secretJson.metadata.namespace} Not Found`);
            return false;
        }).then((data) => {
            return postSecret();
        }, (error) => {
            reject(error);
        });
        
        function postSecret() {
          return client.post(`namespaces/${secretJson.metadata.namespace}/secrets`, secretJson).then((data) => {
              resolve(data);
          }, (error) => {
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
        let shipment = new shipitApi.Shipment(rawShipment);
        resolve(shipment);
    });
    
    return promise;
}
