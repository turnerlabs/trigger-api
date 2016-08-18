"use strict";

module.exports = errorFunction;

function errorFunction(error) {
    console.log(error.message);
    console.log(error.stack);
    return {code: 500, message: error.message};
}
