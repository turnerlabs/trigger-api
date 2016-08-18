"use strict";

const yaml = require('js-yaml');
const fs   = require('fs');

const HOME = process.env.HOME || process.env.USERPROFILE;

let kubeCfgLocation = `${HOME}/.kube/config`;
let configs = {};

module.exports = getKubeCfg;

function getKubeCfg(location, name) {
  
    if (location) {
        kubeCfgLocation = location;
    }
    
    if (configs[kubeCfgLocation]) {
        return findContext(configs[kubeCfgLocation], name);
    }
    
    // Get document, or throw exception on error
    try {
      var doc = yaml.safeLoad(fs.readFileSync(kubeCfgLocation, 'utf8'));
      configs[name] = doc;
      return findContext(doc, name);
    } catch (e) {
      console.log('ERROR => ', e);
      return {code: 500, message: `error parsing yml file ${kuebCfgLocation}`};
    }
}

function findContext(doc, name) {
  
    let foundContext;
    
    doc.contexts.forEach((context) => {
        if (context.name === name) {
            foundContext = context;
        }
    });
    
    if (!foundContext) {
        let msg = `Could not find kube context ${name}`;
        console.log('ERROR => ', msg);
        return {code: 500, message: msg};
    }
    
    doc.clusters.forEach((cluster) => {
        if (cluster.name === foundContext.context.cluster) {
            foundContext.cluster = cluster.cluster;
        }
    });
    
    doc.users.forEach((user) => {
        if (user.name === foundContext.context.user) {
            foundContext.user = user.user;
        }
    });
    
    return foundContext;
}
