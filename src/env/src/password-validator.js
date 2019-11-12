'use strict';

var { debug, info, warn, error } = require('./logger')('portal-env:password-validator');

const passwordValidator = {};

const _strategies = [
    {
        strategy: 'PW_6_24',
        description: 'Password has to be between 6 and 24 characters.',
        regex: '^.{6,24}$'
    },
    {
        strategy: 'PW_8_24_UPPER_LOWER',
        description: 'Password has to be 8 to 24 characters long and contain uppercase and lowercase characters.',
        regex: '^(?=.{8,24}$)(?=.*[A-Z])(?=.*[a-z]).*$'
    },
    {
        strategy: 'PW_8_24_UPPER_LOWER_DIGIT',
        description: 'Password has to be 8 to 24 characters long and contain digits, uppercase and lowercase characters.',
        regex: '^(?=.{8,24}$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).*$'
    },
    {
        strategy: 'PW_8_24_UPPER_LOWER_DIGIT_SPECIAL',
        description: 'Password has to be 8 to 24 characters long and contain uppercase and lowercase characters, digits, and a special character.',
        regex: '^(?=.{8,24}$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).*$'
    }
];

passwordValidator.getStrategies = function () {
    return _strategies;
};

passwordValidator.getStrategy = function (strategyName) {
    const strategy = _strategies.find(s => s.strategy === strategyName);
    if (!strategy) {
        error(`Invalid password strategy name ${strategyName}, falling back to PW_6_24`);
        return _strategies[0];
    }
    return strategy;
};

passwordValidator.validatePassword = function (password, strategyName) {
    debug(`Checking password with strategy ${strategyName}`);
    let strategy = passwordValidator.getStrategy(strategyName);
    const regex = new RegExp(strategy.regex);
    if (regex.test(password)) {
        debug(`Success.`);
        return {
            valid: true,
            message: 'Password matches strategy.'
        };
    }
    warn(`Password did not match security criteria of ${strategyName}.`);
    return {
        valid: false,
        message: strategy.description
    };
};

module.exports = passwordValidator;
