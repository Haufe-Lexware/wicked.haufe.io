# wicked.haufe.io

This repository is part of the OSS API Portal/API Management system "wicked" by Haufe-Lexware. For more information on the API Portal, see the repository

[wicked.haufe.io](https://github.com/Haufe-Lexware/wicked.haufe.io)

## What's in this repository?

This repository contains tooling for

* wicked development,
* release management.
* ADFS signing certificate extraction (see below)

### Development guides

See the [development README](development/README.md) for more information.

### Release management

All release related tooling can be found in the [release folder](release).


## Extract ADFS Signing Certificate

The `adfs/get-adfs-signing-cert.js` script can be used to extract the certificate used by ADFS to sign its JWT Tokens; this certificate is needed when you want to support either ADFS Login to the Portal, or ADFS securing of APIs, using your own Authorization Server (or the sample [Passport Auth Server](https://github.com/Haufe-Lexware/wicked.auth-passport)).

```bash
$ node adfs/get-adfs-signing-cert.js <metadata.xml URL of your ADFS>
```

If your ADFS runs on `identity.yourcompany.com`, the following command line may work:

```bash
$ node adfs/get-adfs-signing-cert.js https://identity.yourcompany.com/federationmetadata/2007-06/federationmetadata.xml
```

Copy and paste the certificate into the Kickstarter, or pipe it into a `.pem` file.