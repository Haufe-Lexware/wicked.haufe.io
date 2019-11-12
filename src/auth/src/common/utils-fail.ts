'use strict';

export class StatusError extends Error {
    public status: number;
    public oauthError: string;
    public redirectUri: string;
    public internalError: Error;
    public issueAsJson: boolean = false;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export function makeError(message: string, status: number): StatusError;
export function makeError(message: string, status: number, internalError: Error): StatusError;
export function makeError() {
    const message = arguments[0];
    const status = arguments[1]
    const internalError = arguments[2];
    const err = new StatusError(status, message);
    if (status)
        err.status = status;
    else
        err.status = 500;
    if (internalError)
        err.internalError = internalError;
    return err;
}

export function makeOAuthError(statusCode: number, oauthError: string, message: string): void;
export function makeOAuthError(statusCode: number, oauthError: string, message: string, internalError: Error): void;
export function makeOAuthError() {
    const statusCode = arguments[0];
    const oauthError = arguments[1];
    const message = arguments[2];
    const internalError = arguments[3];

    const err = new StatusError(statusCode, message);
    err.oauthError = oauthError;
    if (internalError)
        err.internalError = internalError;
    return err;
}

// Makes sure the application fails with a HTML generated error
// message; use for UI failures.
export function failMessage(statusCode: number, message: string, callback): void {
    const err = new StatusError(statusCode, message);
    return callback(err);
}

// Makes sure the app returns a OAuth2 compliant error message:
// {
//   "error": "some oauth2 error",
//   "error_description": "nice description"   
// }
export function failOAuth(statusCode: number, oauthError: string, message: string, callback): void;
export function failOAuth(statusCode: number, oauthError: string, message: string, internalError: Error, callback): void;
export function failOAuth() {
    const statusCode = arguments[0];
    const oauthError = arguments[1];
    const message = arguments[2];
    const internalErrorOrCallback = arguments[3];
    let callback = arguments[4];

    const err = new StatusError(statusCode, message);
    err.oauthError = oauthError;
    if (typeof(internalErrorOrCallback) === 'function')
        callback = internalErrorOrCallback;
    else
        err.internalError = internalErrorOrCallback;
    return callback(err);
}

export function failRedirect(oauthError: string, message: string, redirectUri: string, callback): void {
    const err = new StatusError(302, message);
    err.oauthError = oauthError;
    err.redirectUri = redirectUri;
    return callback(err);
}

// Makes sure the app returns a JSON error message
// {
//   "status": <status code>
//   "message": "the message"
//   "error": <the internal error if applicable>
// }
export function failJson (status: number, message: string, internalError: Error, callback): void;
export function failJson (status: number, message: string, callback): void;
export function failJson(): void {
    const status = arguments[0];
    const message = arguments[1];
    const internalErrorOrCallback = arguments[2];
    let callback = arguments[3];
    const err = new StatusError(status, message);
    err.issueAsJson = true;
    err.status = status;
    if (typeof (internalErrorOrCallback) === 'function')
        callback = internalErrorOrCallback;
    else
        err.internalError = internalErrorOrCallback;
    return callback(err);
}

export function failError(statusCode: number, err, callback) {
    // Don't overwrite pre-existing status codes.
    if (err.statusCode && !err.status)
        err.status = err.statusCode;
    if (!err.status)
        err.status = statusCode;
    return callback(err);
}
