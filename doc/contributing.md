# Contributing to Wicked

Feel free to contribute. Please follow the guidelines on this page, then file a pull request. If the PR does not run through the checks and tests, it will not be considered for merging.

Although not enforced, please write a unit test or service test for your PR.

## Licensing

Apache 2.0 License.

## Service and Integration Tests

See [wicked.portal-test](https://github.com/Haufe-Lexware/wicked.portal-test) for information on how to run the integration test suite.

Any contributions must not break the integration test suites, and new test cases should cover the new code. 

## JSHint

All files are using `'using strict';` and are regularly (at container build) run past JSHint. Any errors in JSHint will cause the build to fail.

## Developer tooling

The repository [wicked.portal-tools](https://github.com/apim-haufe-io/wicked.portal-tools) contains tooling to ease development with wicked. Please note that most developers currently are using macOS to develop wicked, so if using Windows or Linux, you may experience issues. Feel free to either also contribute by fixing these issues, or by filing them as such (issues) on Github.

