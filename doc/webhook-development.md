# Webhook Development

To be written.

For starters, have a look at either `wicked.portal-mailer` or `wicked.portal-chatbot` to get a notion how this works.

If you are using node.js, the [Wicked SDK](../src/node-sdk) (`wicked-sdk`) will be of great help to you.

Please also refer to [wicked-in-a-box](wicked-in-a-box.md) to see how to easily set up an environment which can be used for simple webhook development.

## Used ports

The following ports are already used in official wicked components:

| Port | Component |
| ---- | --------- |
| 3000 | `wicked.portal` |
| 3001 | `wicked.portal-api` |
| 3002 | `wicked.portal-kong-adapter` (internal user `kong-adapter`) |
| 3003 | `wicked.portal-mailer` (internal user `mailer`) |
| 3004 | `wicked.portal-chatbot` (internal user `chatbot`) |
| 3010 | `wicked.portal-auth` (internal user `default`) |
