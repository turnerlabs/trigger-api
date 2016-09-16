"use strict";

module.exports = getService;

function getService(shipment, client) {
    let namespace = shipment.name + '-' + shipment.environment,
        uniqueName = Math.floor(Date.now() / 1000) // generateRando Date name
    
    return new Promise(_getServiceJson);
    
    function _getServiceJson(resolve, reject) {
        return getServicePorts(shipment.containers).then((ports) => {
            return getUnusedServicePort(client, ports).then((ports) => {
                let service = {
                    kind: "Service",
                    apiVersion: "v1",
                    metadata: {
                        name: `s${uniqueName}`,
                        namespace: `${namespace}`,
                        labels: {
                            name: shipment.name,
                            environment: shipment.environment
                        }
                   },
                   spec: {
                       ports: ports,
                       selector: {
                           name: shipment.name,
                           environment: shipment.environment
                       },
                      type: "LoadBalancer",
                      sessionAffinity: "None"
                  }
              }
              resolve(service);
            });
        });
    }
}

function getUnusedServicePort(client, ports) {
    return new Promise(_checkServices);
    
    function _checkServices(resolve, reject) {
        return client.get('services').then((data) => {
            let usedPorts = {};
            data.items.forEach((service) => {
                if (service.spec.ports) {
                    service.spec.ports.forEach((port) => {
                        usedPorts[port.nodePort] = 1;
                        usedPorts[port.port] = 1;
                    });
                }
            });
            return usedPorts;
        }).then((usedPorts) => {
            let servicePorts = [];
            ports.forEach((port) => {
                for (let test_port = 30000;test_port <= 32767;test_port++) {
                    if (!usedPorts[test_port]) {
                        port.nodePort = test_port;
                        port.port = test_port;
                        usedPorts[test_port] = 1;
                        servicePorts.push(port);
                        break;
                    }
                }
            });
            return servicePorts;
        }).then((servicePorts) => {
            if (ports.length !== servicePorts.length) {
                console.log("Could not find open port.")
                reject("Could not find open port.")
            } else {
                resolve(servicePorts);
            }
        });
    }
}

function getServicePorts(containers) {
  return new Promise((resolve, reject) => {
      let ports = [];
      
      containers.forEach((container) => {
          let _ports =  container.ports.map((port) => {
              let tmp = {};
              tmp.name = port.name.replace(/_/g, '-').toLowerCase();
              tmp.protocol = 'TCP';
              tmp.targetPort = port.value;
              return tmp;
          });
          ports = ports.concat(_ports);
      });
      resolve(ports);
  });
}
