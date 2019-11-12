'use strict';

const passwordValidator = require('../src/password-validator');

/* global it, describe, before, beforeEach, after, afterEach, slow, URL */

const assert = require('chai').assert;

function isNotValid(strategy, password) {
    const result = passwordValidator.validatePassword(password, strategy);
    assert.isFalse(result.valid);
}

function isValid(strategy, password) {
    const result = passwordValidator.validatePassword(password, strategy);
    assert.isTrue(result.valid);
}

describe('password-validator', function () {
    describe('PW_6_24', function () {
        const s = 'PW_6_24';
        it('must reject too short passwords', function () {
            isNotValid(s, 'abcde');
        });

        it('must reject too long passwords', function () {
            isNotValid(s, '0123456789012345678901234');
        });

        it('must accept 6 character long passwords', function () {
            isValid(s, 'abcdef');
        });

        it('must accept 24 character long passwords', function () {
            isValid(s, '012345678901234567890123');
        });

        it('must accept passwords with special characters', function () {
            isValid(s, 'abc!"§öpß');
        });

        it('must accept 8 chars and valid (1)', function () {
            isValid(s, 'abcdEFGH');
        });

        it('must accept 8 chars and valid (2)', function () {
            isValid(s, 'aBcdE$G1');
        });

        it('must accept 24 chars and valid', function () {
            isValid(s, 'Abcdefghijklmno$qrstuvw1');
        });
    });

    describe('PW_8_24_UPPER_LOWER', function () {
        const s = 'PW_8_24_UPPER_LOWER';

        it('must reject too short passwords', function () {
            isNotValid(s, 'abcdEFG');
        });

        it('must reject too long passwords', function () {
            isNotValid(s, 'abCD456789012345678901234');
        });

        it('must accept 8 chars and valid', function () {
            isValid(s, 'abcdEFGH');
        });

        it('must reject 8 chars and invalid', function () {
            isNotValid(s, 'abcdef12');
        });

        it('must accept 24 chars and valid', function () {
            isValid(s, 'Abcdefghijklmnopqrstuvwy');
        });

        it('must accept 8 chars and valid', function () {
            isValid(s, 'aBcdE$G1');
        });

        it('must accept 24 chars and valid', function () {
            isValid(s, 'Abcdefghijklmno$qrstuvw1');
        });
    });

    describe('PW_8_24_UPPER_LOWER_DIGIT', function () {
        const s = 'PW_8_24_UPPER_LOWER_DIGIT';
        it('must reject too short passwords', function () {
            isNotValid(s, 'ab2dEFG');
        });

        it('must reject too long passwords', function () {
            isNotValid(s, 'abCD456789012345678901234');
        });

        it('must accept 8 chars and valid', function () {
            isValid(s, 'abcdEFG1');
        });

        it('must reject 8 chars and invalid', function () {
            isNotValid(s, 'abcdefGH');
        });

        it('must accept 24 chars and valid', function () {
            isValid(s, 'Abcdefghijklmnopqrstuvw1');
        });

        it('must reject 24 chars and invalid', function () {
            isNotValid(s, 'Abcdefghijklmnopqrstuvwy');
        });

        it('must accept 8 chars and valid', function () {
            isValid(s, 'aBcdE$G1');
        });

        it('must accept 24 chars and valid', function () {
            isValid(s, 'Abcdefghijklmno$qrstuvw1');
        });
    });

    describe('PW_8_24_UPPER_LOWER_DIGIT_SPECIAL', function () {
        const s = 'PW_8_24_UPPER_LOWER_DIGIT_SPECIAL';
        it('must reject too short passwords', function () {
            isNotValid(s, 'ab2dEF§');
        });

        it('must reject too long passwords', function () {
            isNotValid(s, 'abCD456789012345!78901234');
        });

        it('must accept 8 chars and valid', function () {
            isValid(s, 'aBcdE$G1');
        });

        it('must reject 8 chars and invalid', function () {
            isNotValid(s, 'abcdefGH');
        });

        it('must reject 8 chars and invalid', function () {
            isNotValid(s, 'a1cdefGH');
        });

        it('must accept 24 chars and valid', function () {
            isValid(s, 'Abcdefghijklmno$qrstuvw1');
        });

        it('must reject 24 chars and invalid (1)', function () {
            isNotValid(s, 'Abcdefghijklmnopqrstuvwy');
        });

        it('must reject 24 chars and invalid (2)', function () {
            isNotValid(s, 'Abcdefghijklmnopqrstuvw1');
        });
    });
});