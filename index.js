'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const PORT = process.env.PORT || 8080;
const HEALTHCHECK = process.env.HEALTHCHECK || '/hc';
const app = express();

let config = require('./config');
let helpers = require('./helpers');
let core = require('./core');
let clients = core.getClients(config);

app.use(bodyParser.json());
app.use(cors());
app.post('/trigger/:shipment/:environment/:provider', trigger);
app.get('/getEndpoints/:provider', getEndpoints);
app.get(HEALTHCHECK, sayHello);
app.listen(PORT, () => {
    console.log('Listening on => ', PORT);
    console.log('Healthcheck at => ', HEALTHCHECK);
});

function sayHello(req, res) {
    res.send('hey im up...');
}


function getEndpoints(req, res, next) {
    let provider = req.params.provider;
    let client = clients[provider];
    
    if (!client) {
        helpers.noClientError(provider, res);
        return;
    }
    
    client.getEndpoints().then((data) => {
        res.send(data);
    }, (error) => {
        console.log('error', error);
        res.status(500);
        res.json({code: 500, message: error});
    });
}

function trigger(req, res, next) {
    let { shipment, environment, provider } = req.params;
    let client = clients[provider];
    
    if (!client) {
        helpers.noClientError(provider, res);
        return;
    }
    
    client.trigger(shipment, environment, provider).then((data) => {
        res.send(data);
    }, (error) => {
        console.log('ERROR =>', error);
        res.status(500);
        res.json({code: 500, message: error});
    });
}
