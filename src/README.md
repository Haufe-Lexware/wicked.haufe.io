# Build scripts

This root directory contains the build scripts which are used forin conjunction with CI/CD systems, in case of wicked, this is Jenkins. See also [../Jenkinsfile](Jenkinsfile).

The test scripts are located inside the `test` folder; as the Jenkinsfile contains separate sections (which can be parallelized), there is not a `test.sh` script here; see the [test](test) folder for more information.


# Local development 

Local development tooling can be found in the [tools/development](tools/development) folder.
