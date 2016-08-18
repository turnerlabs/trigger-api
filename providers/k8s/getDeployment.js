"use strict";

module.exports = getDeployment;

function getDeployment(shipment, provider, secrets) {
  let product = shipment.name,
      environment = shipment.environment;
      
  return {
    kind: 'Deployment',
    apiVersion: 'extensions/v1beta1',
    metadata: {
      name: 'thedeployment',
      namespace: `${product}-${environment}`,
        labels: {
          name: product,
          environment: environment,
        }
    },
    spec: {
      replicas: provider.replicas,
      selector: {
        matchLabels: {
          name: product,
        }
      },
      template: {
        metadata: {
          labels: {
            name:  product,
            environment: environment,
          }
        },
        spec: {
          containers: shipment.containers,
          imagePullSecrets: provider.metadata.secrets
        }
      }
    }
  }
}
