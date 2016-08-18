"use strict";

const fetch = require('node-fetch');
const SHIPIT_URI = process.env.SHIPIT_URI || 'http://localhost:8081';

module.exports = { getShipment };

function getShipment(shipment, environment) {
    return new Promise((resolve, reject) => {
        resolve({name: 'foo', parentShipment: {name: 'bar'}, containers: [], providers: [{
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
