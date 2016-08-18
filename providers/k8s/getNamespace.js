"use strict";

module.exports = getNamespace;

function getNamespace(shipment, provider, secrets) {
  let namespace = shipment.name + '-' + shipment.environment;
  return {
    kind: "Namespace",
    apiVersion: "v1",
    metadata: {
      name: namespace,
      labels: {
        name: namespace
      }
    }
  }
}
