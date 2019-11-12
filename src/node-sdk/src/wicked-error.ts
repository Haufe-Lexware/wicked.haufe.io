'use strict';

export class WickedError extends Error {
    public status?: number;
    public statusCode?: number;
    public body?: any;

    constructor(message: string, statusCode?: number, body?: any) {
        super(message);
        // See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        // Pass in for both statusCode and status; some libraries do one or the other,
        // we do both.
        this.statusCode = statusCode;
        this.status = statusCode;
        this.body = body;
    }
}