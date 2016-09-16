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
        let found = false;
        vars[i].value = vars[i].value + '';
        for (var x = 0;x < envVars.lenth;x++) {
            if (envVars[x].name === vars[i].name) {
                envVars[x].value = vars[i].value;
                found = true;
            }
        }
        
        if (found === false) {
            envVars.push(vars[i]);
        }
    }
    
    return envVars;
}
