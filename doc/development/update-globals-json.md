# How to update `globals.json`

Source: https://github.com/Haufe-Lexware/wicked.portal/pull/3#issuecomment-292518025

## Edit files in `wicked.portal-env`

You shouldn't change the initial config in `wicked.portal-env` for it.
If you do that, the changes and customization possibility would only be visible to new configurations, and that's not what we want.

Instead, check out this file: https://github.com/Haufe-Lexware/wicked.portal-env/blob/master/config-updater.js

This file is used to update existing configuration files and has means of editing the `globals.json` on the fly. This is where the defaults for new properties go.

To add properties, do this:

 - Add an update step, e.g. `updateStep5_Apr2017`
 - Create a function with this name, function `updateStep5_Apr2017(targetConfig, sourceConfig, configKey)`
 - Load the target globals (you don't need the source globals)
 - Set the `targetGlobals.version` to the next number, `5` (which right now is the right version)
 - Write the new property `layouts` with the desired default values
 - Save the target globals again

A template of the methods would look like this:

```javascript
function updateStep5_Apr2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep5_Apr2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 5;

    // PUT YOUR CHANGES HERE
    targetGlobals.layouts = {}; // `layouts` is a new key here

    // Save new changes
    saveGlobals(targetConfig, targetGlobals);
}
```

This has the following effect: Whenever either the `portal-api` or the `portal-kickstarter` is started, these update steps will automatically populate the `layout` property. This means it will **always** be present at runtime, even if your static configuration does not contain them.

## Test the local configuration

To test on your local configuration, if you have followed https://github.com/Haufe-Lexware/wicked.haufe.io/blob/master/doc/development-environment.md and cloned the `wicked.portal-kickstarter` project on your local machine.

```
- wicked
   |
   +- wicked-config (Your static configuration repository)
   |
   +- wicked.portal
   |
   +- wicked.portal-env
   |
   +- wicked.portal-kickstarter
   |
   +- ...
```


1. Go to its folder and temporarily edit `packages.json` `portal-env` package to look for your local folder of `wicked.portal-env`:

```json
{
  // ...
  "dependencies": {
    // ...
    "portal-env": "../wicked.portal-env",
  },
  // ...
}
```

2. Attention ! Save your local static `wicked-config` before executing the next command

Go to your local `wicked-config` folder and commit any changes to avoid breaking or loosing it.

3. Launch the Kickstarter localy (in edition mode) with the path to you local configuration (here `wicked-config` is the name of my local configuration:

```shell
node bin/kickstart ../wicked-config
```

4. Check your `wicked-config/static/globals.json`

The `version` setting should be equal to the new number and your changes present

