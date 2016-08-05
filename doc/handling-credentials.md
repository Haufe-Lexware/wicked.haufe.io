# Handling Credentials

## The Problem

In some cases it will be necessary to handle sensitive information inside the configuration repository, e.g. to store the credentials for reCAPTCHA or client ids and secrets for enabling social logins like Google and Github. Other sensitive information might be things like a `Authentication: Basic ...` header which is needed for accessing a backend URL.

Obviously, it is not desired (or advisable) to store these settings inside the git repository with the other configuration. You should not do this even if you are using a private git repository.

On the other hand, having all credentials which you need to deploy and run an API portal in a single place, is very convenient.

## The Solution

There are various different solutions to this problem, and most of them involve environment variables which can be inserted at runtime, so that only the reference to an environment variable is stored in the actual configuration repository; e.g. `$SECRET_PASSWORD`.

This is supported by the API Portal, but as an addition to that, by using encrypted variables, the content of these environment variables can be stored in the git repository together with the rest. What **MUST NOT** be stored in the configuration repository is the key to the secrets.

## Handling using the kickstarter

For those cases where you need a credential/a secret in the configuration, the kickstarter usually always provides a check box underneath the setting which allows you to use an environment variable instead of passing in the text "as is". This environment variable can in turn be encrypted using the "Environments" settings page.

For more information, see [Using Deployment Environments](deployment-environments.md).
  