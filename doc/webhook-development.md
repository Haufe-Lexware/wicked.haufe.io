# Webhook Development

To be written.

For starters, have a look at either `wicked.portal-mailer` or `wicked.portal-chatbot` to get a notion how this works.

If you are using node.js, the `npm` packages `wicked-sdk` and possibly `wicked-saml` may help you.

## Used ports

The following ports are already used in official wicked components:

| Port | Component |
| ---- | --------- |
| 3000 | `wicked.portal` |
| 3001 | `wicked.portal-api` |
| 3002 | `wicked.portal-kong-adapter` (internal user `kong-adapter`) |
| 3003 | `wicked.portal-mailer` (internal user `mailer`) |
| 3004 | `wicked.portal-chatbot` (internal user `chatbot`) |
| 3010 | `wicked.auth-passport` (internal user `auth-passport`) |
