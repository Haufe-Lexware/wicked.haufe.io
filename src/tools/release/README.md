# Release checklist

This is for people releasing at Haufe.

1. Run `set-version.sh` if that hasn't been done yet to update all versions on the `next` branch
1. Make sure all builds have run successfully, including tests, on branch `next`
1. Use `merge-next.sh` to merge changes to `master``
1. Make sure all builds have run successfully, including tests, on branch `master`
1. Write release notes on wicked.haufe.io/next for the new version
1. Run `merge-next --docs` to merge the documentation to `master`
1. Run `release-github.sh`
1. Run `pull-docker-push-haufe.sh` to propagate the images to `registry.haufe.io`
