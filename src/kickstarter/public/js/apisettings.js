/* global Vue, $, injectedData */

Vue.component('wicked-api', {
    props: ['value', 'authMethods', 'groups', 'plans', 'pools', 'envPrefix'],
    data: function () {
        return {
            newScopeId: '',
            newScopeDesc: ''
        };
    },
    methods: {
        deleteScope: function (scopeId) {
            this.$delete(this.value.settings.scopes, scopeId);
        },
        addScope: function (scopeId, scopeDesc) {
            if (!this.isValidScopeId(scopeId)) {
                alert('Scope ID is invalid.');
                return;
            }
            this.$set(this.value.settings.scopes, scopeId, { description: scopeDesc });
            this.newScopeId = '';
            this.newScopeDesc = '';
            $('#new_scope_input').focus();
        },
        isValidScopeId: function (scopeId) {
            return /^[a-z0-9-_\:]+$/.test(scopeId); // eslint-disable-line
        },
        focusDescription: function () {
            $('#new_scope_desc').focus();
        }
    },
    template: `
    <wicked-panel :open=true title="Basic Configuration" type="primary">
        <wicked-input v-model="value.id" :readonly=true label="API ID:" hint="The ID of the API; must only contain a-z, - and _." />
        <wicked-checkbox v-model="value.deprecated" label="<b>Deprecated</b>: Tick this to disable new subscriptions to your API. This is the first thing you should do when you want to phase out usage of an API. Second thing is to delete all subscriptions (in the running Portal, while the API is deprecated), then you can delete the API." />
        <wicked-input v-model="value.name" label="API Name:" hint="Friendly name of the API" :env-var="envPrefix + 'NAME'" />
        <wicked-input v-model="value.desc" label="Short Description:" hint="May contain markdown." :env-var="envPrefix + 'DESC'" />

        <hr>

        <div class="form-group">
            <label>Required User Group:</label>
            <p>Specify whether users need to belong to a specific user group to be able to see and use this API.</p>
            <wicked-group-picker :include-none=true v-model="value.requiredGroup" :groups="groups" />
        </div>

        <wicked-string-array :allow-empty=true v-model="value.tags" label="Tags:" />

        <div class="form-group">
            <label>Authorization Mode:</label>
            <select v-model="value.auth" class="form-control">
                <option value="key-auth">Authorize with simple API Keys (key-auth)</option>
                <option value="oauth2">Authorize using OAuth 2.0 (oauth2)</option>
                <option value="none">Public API/Authorization not required (none)</option>
            </select>
            <wicked-checkbox v-if="value.auth !== 'none'" v-model="value.hide_credentials" label="<b>Hide Credentials</b> from upstream server"/>
        </div>

        <div v-if="value.auth != 'none'" class="form-group">
            <hr>
        
            <label>Associated Plans:</label>
            <p>Each API has to be associated with at least one plan in order to enable subscriptions to the API. Select
               which plans shall be associated with this API.</p>
            <div v-for="plan in plans.plans">
                <input v-model="value.plans" type="checkbox" :id="'plan_' + plan.id" :value="plan.id" />
                <label :for="'plan_' + plan.id">{{ plan.name }} ({{ plan.id }})</label>
            </div>
        </div>
        
        <wicked-panel v-if="value.auth == 'oauth2'" :open=true type="info" title="OAuth 2.0 Settings">
            <div class="form-group">
                <label><a href="/pools" target="_blank">Registration Pool</a>:</label>
                <select v-model="value.registrationPool" class="form-control">
                    <option value="">&lt;none&gt;</option>
                    <option v-for="pool in pools" :value="pool.id">{{ pool.name }} ({{ pool.id}})</option>
                </select>
            </div>

            <label>Supported Flows:</label>
            <wicked-checkbox v-model="value.settings.enable_client_credentials" label="<b>Client Credentials</b> (two-legged, machine to machine)" />
            <wicked-checkbox v-model="value.settings.enable_implicit_grant" label="<b>Implicit Grant</b> (three-legged, for e.g Single Page Applications/client side JavaScript)" />
            <wicked-checkbox v-model="value.settings.enable_password_grant" label="<b>Resource Owner Password Grant</b> (three-legged, for e.g. native mobile Apps)" />
            <wicked-checkbox v-model="value.settings.enable_authorization_code" label="<b>Authorization Code Grant</b> (three-legged, for APIs delegating access to user data)" />
            <wicked-input v-model="value.settings.token_expiration" label="Token Expiration (seconds):" />
            <wicked-input v-model="value.settings.refresh_token_ttl" label="Refresh Token Time to live (seconds):" hint="Leave empty to use the default (2 weeks). Specify <code>0</code> to disable cleanup of refresh tokens. <b>Important</b>: Using <code>0</code> will clog up your token storage (Postgres) over time, so handle with care!" />
            <!-- <wicked-input v-model="value.settings.scopes" label="Scopes:" hint="Space-separated list of scopes." :env-var="envPrefix + 'SCOPES'" /> -->
            <wicked-panel title="API Scopes" type="default">
                <wicked-checkbox v-model="value.settings.mandatory_scope" label="<b>Mandatory Scope:</b> If specified, it is not possible to create access tokens without explicitly specifying a scope. Otherwise an access token with an empty scope may be created." />
                <p>You can either specify a static list of scopes, or you can look the scopes up using a service (which you need to implement).
                   In case the scope lookup URL (below) is specified, the static list is <b>not</b> used. <b>Note:</b> This URL will be called with the API ID
                   appended to it, e.g. <code>http://my-service:3000/scopes/&lt;api_id&gt;</code>. See 
                   <a href="https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.scopelookupresponse.html" target="_blank">ScopeLookupResponse</a>.</p>
                <wicked-input v-model="value.scopeLookupUrl" label="Scope lookup URL:" :env-var="envPrefix + 'SCOPE_LOOKUP_URL'" hint='URL as reachable from the portal API deployment, which by a GET can retrieve a list of scopes. TODO' />

                <p>It is possible to delegate the scope decision from the end user to a third party instance; specify
                   the URL, as reachable from the Authorization Server instance inside your deployment, to the endpoint
                   which accepts a POST with the desired scope and profile of the user.  See 
                   <a href="https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.passthroughscoperequest.html" target="_blank">PassthroughScopeRequest</a>
                   and <a href="https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.passthroughscoperesponse.html" target="_blank">PassthroughScopeResponse</a>
                   for a description of request and response formats.</p>
                <wicked-input v-model="value.passthroughScopeUrl" label="Passthrough Scope URL:" :env-var="envPrefix + 'SCOPE_URL'" hint="URL as reachable from the wicked/auth server deployment."/>
 
                <table style="border-spacing: 5px; width: 100%">
                    <tr>
                        <th class="scopecell">Scope ID</th>
                        <th class="scopecell">Description</th>
                        <th class="scopecell">Action</th>
                    </tr>

                    <tr v-for="(scopeDesc, scopeId) in value.settings.scopes">
                        <td class="scopecell" style="width: 30%"><input class="form-control" :readonly=true :value="scopeId" /></td>
                        <td class="scopecell" style="width: 55%"><input class="form-control" v-model="value.settings.scopes[scopeId].description" /></td>
                        <td class="scopecell" style="width: 15%"><button role="button" v-on:click="deleteScope(scopeId)" class="btn btn-sm btn-danger">Remove</button></td>
                    </tr>

                    <tr>
                        <td class="scopecell"><input class="form-control" id="new_scope_input" v-on:keyup.enter="focusDescription" v-model="newScopeId" /></td>
                        <td class="scopecell"><input class="form-control" id="new_scope_desc" v-model="newScopeDesc" v-on:keyup.enter="addScope(newScopeId, newScopeDesc)" /></td>
                        <td class="scopecell"><button role="button" v-on:click="addScope(newScopeId, newScopeDesc)" class="btn btn-sm btn-success" :disabled="newScopeId === '' || !isValidScopeId(newScopeId)">Add</button></td>
                    </tr>

                    <tr>
                        <td class="scopecell"><p class="wicked-note">{{ newScopeId !== '' && !isValidScopeId(newScopeId) ? 'Scope invalid, can only contain a-z, 0-9, -, _ and :' : '' }}</p></td>
                        <td class="scopecell"></td>
                        <td class="scopecell"</td>
                    </tr>
                </table>

                <p>You can use the enter key to jump between the scope ID and description, and to store the new scope; just press the enter key when inside the description field.</p>

            </wicked-panel>
            <hr>
            <wicked-checkbox v-model="value.passthroughUsers" label="<b>Passthrough Users</b>: If you check this check box, wicked will not persist any users in its internal user database, but simply pass on the <code>sub</code> as authenticated user id to the backend API. Specifically useful in combination with the above &quot;passthrough scope&quot; option." />
            <hr>
            <h5>Specify Auth Methods</h5>
            <p>In order to use OAuth2 to secure this API, you must specify which Auth Methods on your registered Authorization Servers
               may be used to access this API. Most auth methods can be used with most OAuth2 flows, although there may be restrictions,
               e.g. you will not be able to use the Resource Owner Password Grant using a Google Authentication (only works with a User
               Agent).</p>
            <p><a href="/authservers" target="_blank">Configure Auth Methods (Authorization Server)</a> (opens in new window, reload this page for changes to take effect).</p>
            <div v-for="am in authMethods">
                <input v-model="value.authMethods" type="checkbox" :id="am.serverId + '_' + am.name" :value="am.serverId + ':' + am.name"/>
                <label :for="am.serverId + '_' + am.name">{{ am.friendlyShort }} (<code>{{ am.serverId + ':' + am.name }}</code>) <span style="color:red;">{{ !am.enabled ? ' - currently disabled' : '' }}</span></label>
            </div>
        </wicked-panel>
    </wicked-panel>
    `
});

Vue.component('wicked-api-kong', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel :open=true title="Kong (Gateway) Configuration" type="primary">
        <wicked-input v-model="value.api.host" label="API Host:" hint="API Host, it could be alternate DNS for the service" :env-var="envPrefix + 'HOST'" />
        <wicked-input v-model="value.api.upstream_url" label="Upstream (backend) URL:" hint="The URL under which the service can be found, <strong>as seen from the Kong container</strong>" :env-var="envPrefix + 'UPSTREAM_URL'" />
        <wicked-string-array v-model="value.api.uris" :allow-empty=false label="Request URIs:" hint="This is the list of prefix you will use for this API on the API Gateway, e.g. <code>/petstore/v1</code>." />
        <wicked-checkbox v-model="value.api.strip_uri" label="<b>Strip Uri</b>. Check this box if you don't want to pass the uri to the backend URL as well. Normally you wouldn't want that." />
        <wicked-checkbox v-model="value.api.preserve_host" label="<b>Preserve Host</b>. Preserves the original <code>Host</code> header sent by the client, instead of replacing it with the hostname of the <code>upstream_url</code>." />
    </wicked-panel>
`
});

Vue.component('wicked-api-desc', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel :open=false title="Long API Description" type="primary">
        <p>Edit the long description of your API; this is displayed on the main information page of the API; it can
           contain markdown code.</p>
        <wicked-markdown v-on:input="$emit('input', $event)" :value="value" />
    </wicked-panel>
`
});

Vue.component('wicked-api-swagger', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel :open=false title="Swagger/OpenAPI" type="primary">
        <p>If you have trouble in writing valid JSON, try <a href='http://www.jsonlint.org' target='_blank'>JSONlint</a>
           or something similar. A good friend is always <a href='http://editor.swagger.io' target='_blank'>editor.swagger.io</a>.
           It will do more for you, like visualizing things and making sure it's valid Swagger. You can copy this file
           from here and paste it there (it takes both JSON or YAML). Here you'll have to make sure it's JSON.
           If you have YAML, you can paste it here, and the wicked Kickstarter will convert it to JSON.</p>
        <p>In case your backend service has its own end point serving the Swagger JSON, you can point wicked to this location
           by inserting the following JSON into this file: <code>{"href":"http://your.backend/api-docs"}</code>. The <code>href</code>
           may contain environment variables; add here, save, and then edit in the <a href="/envs">Environments section</a>.</p>
        <wicked-input v-on:input="$emit('input', $event)" :textarea=true height="500px" :value="value" />
    </wicked-panel>
`
});

// ==============================================================

const vm = new Vue({
    el: '#vueBase',
    data: injectedData
});

function storeData() {
    const apiId = vm.api.id;
    $.post({
        url: `/apis/${apiId}/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function (data) {
        if (data.message == 'OK')
            alert('Successfully stored data.');
        else
            alert('The data was stored, but the backend returned the following message:\n\n' + data.message);
    });
}
