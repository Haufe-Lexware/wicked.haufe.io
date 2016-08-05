# Contributing to wicked

Feel free to contribute. Please follow the guidelines on this page, then file a pull request. If the PR does not run through the checks and tests, it will not be considered for merging.

Although not enforced, please write a unit test or service test for your PR.

## Licensing

Apache 2.0 License.

## Service and Integration Tests

### Service Tests

Service tests for API Portal.

### Integration Tests

Integration Tests for Portal (using a running API).

### Code Coverage (with `istanbul`)

Is done for `portal` and `portal-api` so far.

## Unit Tests

Unit tests for kickstarter (only some so far).

TODO: Write unit tests for tricky bits of `portal-kong-adapter` (the matching parts).

## JSHint

All files are using `'using strict';` and are regularly (at container build) run past JSHint. Any errors in JSHint will cause the build to fail.

# TODOs

- [ ] Create a first draft of the page
