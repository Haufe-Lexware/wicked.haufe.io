'use strict';

/* global describe, it */

const assert = require('chai').assert;
const utils = require('../routes/utils');

describe('utils.js:', function () {
    describe('mixinEnv()', function () {
        it('should mix in simple cases of env variables', function () {
            const ob = {
                something: "$SOMETHING"
            };
            const envVars = {
                default: {
                    SOMETHING: { value: "else" }
                }
            };
            utils.mixinEnv(ob, envVars);

            assert.equal(ob.something, "else");
            assert.isOk(ob.something_);
        });

        it('should mix in nested objects', function () {
            const ob = {
                nest: {
                    something: "$SOMETHING"
                },
                deeper: {
                    deepest: {
                        value1: "$VALUE1",
                        value2: "$VALUE2"
                    }
                }
            };

            const envVars = {
                default: {
                    SOMETHING: { value: 'else' },
                    VALUE1: { value: 'replace1' },
                    VALUE2: { value: 'replace2' }
                }
            };

            utils.mixinEnv(ob, envVars);

            assert.equal(ob.nest.something, 'else');
            assert.isOk(ob.nest.something_);
            assert.equal(ob.deeper.deepest.value1, 'replace1');
            assert.isOk(ob.deeper.deepest.value1_);
            assert.equal(ob.deeper.deepest.value2, 'replace2');
            assert.isOk(ob.deeper.deepest.value2_);
        });

        it('should work with simple arrays', function () {
            const ob = {
                someList: [
                    "$SOMETHING",
                    "$VALUE1",
                    "$VALUE2"
                ]
            };

            const envVars = {
                default: {
                    SOMETHING: { value: 'else' },
                    VALUE1: { value: 'replace1' },
                    VALUE2: { value: 'replace2' }
                }
            };

            utils.mixinEnv(ob, envVars);

            assert.equal(ob.someList[0], 'else');
            assert.equal(ob.someList[1], 'replace1');
            assert.equal(ob.someList[2], 'replace2');
        });

        it('should work with arrays of objects', function () {
            const ob = {
                someList: [
                    { meh: "$SOMETHING" },
                    { meh: "$VALUE1" },
                    { meh: "$VALUE2" }
                ]
            };

            const envVars = {
                default: {
                    SOMETHING: { value: 'else' },
                    VALUE1: { value: 'replace1' },
                    VALUE2: { value: 'replace2' }
                }
            };

            utils.mixinEnv(ob, envVars);

            assert.equal(ob.someList[0].meh, 'else');
            assert.isOk(ob.someList[0].meh_);
            assert.equal(ob.someList[1].meh, 'replace1');
            assert.isOk(ob.someList[1].meh_);
            assert.equal(ob.someList[2].meh, 'replace2');
            assert.isOk(ob.someList[2].meh_);
        });

        it('should work with arrays of objects with arrays in them (who does that?)', function () {
            const ob = {
                someList: [
                    { meh: ["$SOMETHING"] },
                    { meh: ["$VALUE1", "$SOMETHING"] },
                    { meh: ["$VALUE2"] }
                ]
            };

            const envVars = {
                default: {
                    SOMETHING: { value: 'else' },
                    VALUE1: { value: 'replace1' },
                    VALUE2: { value: 'replace2' }
                }
            };

            utils.mixinEnv(ob, envVars);

            assert.equal(ob.someList[0].meh[0], 'else');
            assert.equal(ob.someList[1].meh[0], 'replace1');
            assert.equal(ob.someList[1].meh[1], 'else');
            assert.equal(ob.someList[2].meh[0], 'replace2');
        });
    });

    describe('mixoutEnv()', function () {
        it('must mix out simple envs', function () {
            const ob = {
                something: 'else',
                something_: true
            };

            const envVars = {
                default: {}
            };

            utils.mixoutEnv(ob, envVars);

            //console.log(ob);
            //console.log(envVars);

            assert.equal(ob.something, "$PORTAL_SOMETHING");
            assert.equal(envVars.default.PORTAL_SOMETHING.value, 'else');
        });

        it('must mix out more complicated envs', function () {
            const ob = {
                something: {
                    deeper: 'else',
                    deeper_: true
                },
                elsewhere: 'hello',
                elsewhere_: true
            };

            const envVars = {
                default: {}
            };

            utils.mixoutEnv(ob, envVars);

            //console.log(ob);
            //console.log(envVars);

            assert.equal(ob.something.deeper, "$PORTAL_SOMETHING_DEEPER");
            assert.equal(envVars.default.PORTAL_SOMETHING_DEEPER.value, 'else');
            assert.equal(ob.elsewhere, "$PORTAL_ELSEWHERE");
            assert.equal(envVars.default.PORTAL_ELSEWHERE.value, 'hello');
        });

        it('must mix out things in arrays', function () {
            const ob = {
                someList: [
                    {
                        meh: 'whetever',
                        meh_: true
                    },
                    {
                        muh: 'whetever',
                        muh_: true
                    }
                ]
            };

            const envVars = {
                default: {}
            };

            utils.mixoutEnv(ob, envVars);

            //console.log(ob);
            //console.log(envVars);

            assert.equal(ob.someList[0].meh, '$PORTAL_SOMELIST0_MEH');
            assert.equal(envVars.default.PORTAL_SOMELIST0_MEH.value, 'whetever');
            assert.equal(ob.someList[1].muh, '$PORTAL_SOMELIST1_MUH');
            assert.equal(envVars.default.PORTAL_SOMELIST1_MUH.value, 'whetever');
        });
    });
});