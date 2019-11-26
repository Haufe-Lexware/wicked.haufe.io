'use strict';

// This is a small script which actually does nothing; it is just here to enable
// automatic rebuilds with the help of pm2 in the local development case.

function nothingLoop() {
    console.log('node-sdk: Nothing loop was retriggered.');
    setTimeout(nothingLoop, 60000);
}

nothingLoop();
