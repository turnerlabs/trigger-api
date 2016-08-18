"use strict";

module.exports = setEnvVars;

function setEnvVars(envVars, vars) {
    if (!vars) {
      vars = [];
    }
  
    if (!envVars) {
        envVars = [];
    }
    
    for (var i = 0;i < vars.length;i++) {
        envVars[vars[i].name] = vars[i].value;
    }
    
    return envVars;
}
