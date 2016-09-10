"use strict";

const fetch = require('node-fetch');
const setEnvVars = require('../helpers').setEnvVars;
const SHIPIT_URI = process.env.SHIPIT_URI || 'http://localhost:8081';

module.exports = { getShipment };

function getShipment(shipment, environment) {
    return new Promise((resolve, reject) => {
        resolve({name: 'foo', parentShipment: {name: 'bar'}, 
          containers: [{
            name: 'hello-world',
            image: 'quay.io/turner/hello-world:0.1.2',
            ports: [{
                primary: true,
                healthcheck: '/hc',
                value: 8080,
                name: 'PORT'
            }],
            envVars: [{name: 'TEST', value: 'foobar', type: 'basic'}]
          }], 
          providers: [{
            name: 'gke_mss-cloud-arch-1331_us-east1-b_spinnaker',
            replicas: 1,
            metadata: {
                type: 'k8s',
                version: 'extensions/v1beta1',
                secrets: []
            },
            envVars: [{type: 'basic', name: 'PORT', value: 8080}, {type: 'basic', name: 'HEALTHCHECK', value: '/hc'}]
        }]});
    });
    //return fetch(`${SHIPIT_URI}/v1/${shipment}/${environment}`)
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
              let copiedContainer = JSON.parse(JSON.stringify(container));
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

module.exports.Shipment = Shipment;
