'use strict';

const request = require('request');
const xml2js = require('xml2js');

let success = process.argv.length === 3;
if (!success) {
    console.log('Usage: node adfs/get-adfs-signing-cert.js <metadata URL>');
    console.log('');
    console.log('Use this tool to extract the signing certificate from a running ADFS instance. This');
    console.log('certificate is the output in PEM format; by redirecting the output, you can save it');
    console.log('into a file, or you can copy and paste it, e.g. for use with the Kickstarter.');
    console.log('');
    console.log('Example:');
    console.log('  node adfs/get-adfs-signing-cert.js https://identity.yourcompany.com/federationmetadata/2007-06/federationmetadata.xml');
    console.log('');
    process.exit(1);
}

const metadataUrl = process.argv[2];
console.error('Querying metadata URL ' + metadataUrl);

request.get({
    url: metadataUrl
}, function (err, res, body) {
    if (err)
        return handleErrorAndQuit(err);
    if (res.statusCode !== 200)
        return handleErrorAndQuit(new Error('Got unexpected status code from metadata end point: ' + res.statusCode));
    const contentType = res.headers['content-type'];
    const isXml = (contentType.indexOf('xml') >= 0);
    if (!isXml)
        return handleErrorAndQuit(new Error('Unexpected content type retrieved, expected something with xml: ' + contentType));
    
    xml2js.parseString(body, { explicitArray: false }, function (err, jsonBody) {
        if (err)
            handleErrorAndQuit(err);
            
        //console.log(JSON.stringify(jsonBody, null, 2));
        if (!jsonBody.EntityDescriptor)
            handleErrorAndQuit(new Error('Could not find tag <EntityDescriptor>'));
        const sigTag = jsonBody.EntityDescriptor["ds:Signature"];
        if (!sigTag)
            handleErrorAndQuit(new Error('Could not find tag <ds:Signature> in <EntityDescriptor>'));
        //console.log(sigTag);
        const keyInfo = sigTag.KeyInfo;
        if (!keyInfo)
            handleErrorAndQuit(new Error('Could not find tag <KeyInfo> in <ds:Signature>'));
        const x509Data = keyInfo.X509Data;
        if (!x509Data)
            handleErrorAndQuit(new Error('Could not find tag <X509Data> in <KeyInfo> in <ds:Signature>'));
        const x509Certificate = x509Data.X509Certificate;
        if (!x509Certificate)
            handleErrorAndQuit(new Error('Could ot find tag <X509Certificate> in <X509Data> in <KeyInfo> in <ds:Signature>'));
        //console.log(x509Certificate);

        const chunks = chunkString(x509Certificate, 64);
        console.log('-----BEGIN CERTIFICATE-----');
        for (let i = 0; i < chunks.length; ++i)
            console.log(chunks[i]);
        console.log('-----END CERTIFICATE-----');

        done();
    });

});

function chunkString(str, size) {
  var numChunks = Math.ceil(str.length / size),
      chunks = new Array(numChunks);

  for(var i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
}

function handleErrorAndQuit(err) {
    console.error('An error occurred: ' + err.message);
    console.error(err.stack);
    process.exit(1);
}

function done() {
    console.error('Successfully finished.');
    process.exit(0);
}
