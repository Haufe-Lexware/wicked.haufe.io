/* global Vue, $, injectedData */

Vue.component('auth-server', {
    props: ['value', 'envPrefix', 'serverId', 'groups'],
    methods: {
        displayCallbackUris: function (event) {
            displayCallbackUris(this.value.uri, event.id);
        },
        deleteAuthMethod: function (event) {
            if (confirm("Are you sure you want to delete this Auth Method? The Auth Method isn't permanently deleted until you save the page.")) {
                const authMethodId = event.id;
                let foundIndex = -1;
                for (let i = 0; i < this.value.authMethods.length; ++i) {
                    const am = this.value.authMethods[i];
                    if (am.name === authMethodId) {
                        foundIndex = i;
                        break;
                    }
                }
                if (foundIndex >= 0) {
                    this.$delete(this.value.authMethods, foundIndex);
                }
            }
        }
    },
    template: `
        <div>
            <auth-server-basic v-model="value" :env-prefix="envPrefix" />

            <wicked-panel title="Auth Methods" type="primary" :open=true>
                <p>Which authentication methods should this authorization server use? You may also specify identity provider
                   specific settings, depending on the effect you want to achieve.</p>
                
                <auth-method v-for="(am, index) in value.authMethods" 
                    v-model="value.authMethods[index]"
                    v-on:display-callback-url="displayCallbackUris"
                    v-on:delete-auth-method="deleteAuthMethod"
                    :key="am.name"
                    :server-id="serverId"
                    :groups="groups" />

                <add-auth-method v-model="value.authMethods" />
            </wicked-panel>
        </div>
    `
});

Vue.component('auth-server-basic', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel title="Basic Configuration" type="primary" :open=true>
        <wicked-input v-model="value.id" label="Name:" readonly=true disallow-env-var=true />
        <wicked-input v-model="value.desc" label="Description:" :env-var="envPrefix + 'DESC'" hint="Friendly description of the Authorization Server. Displayed on the API description page for APIs using this Server." />
        <wicked-input v-model="value.config.api.upstream_url" label="Upstream (backend) URL:" :env-var="envPrefix + 'UPSTREAM_URL'" />
        <wicked-input v-model="value.uri" label="URI:" hint="The API URI under which the Authorization Server should be reachable" />
    </wicked-panel>
    `
});

Vue.component('auth-method', {
    props: ['value', 'serverId', 'groups'],
    data: function () {
        const envPrefix = 'PORTAL_AUTHMETHOD_' + this.serverId.toUpperCase() + '_' + this.value.name.toUpperCase() + '_';
        return {
            envPrefix: envPrefix,
            newAdfsGroup: '',
            newWickedGroup: ''
        };
    },
    methods: {
        emitDisplayCallback: function () {
            this.$emit('display-callback-url', { id: this.value.name, type: this.value.type });
        },
        deleteAuthMethod: function () {
            this.$emit('delete-auth-method', { id: this.value.name });
        },
        deleteGroupMapping: function (adfsGroup) {
            this.$delete(this.value.config.defaultGroups, adfsGroup);
        },
        addGroupMapping: function (adfsGroup, wickedGroup) {
            this.newAdfsGroup = '';
            this.newWickedGroup = '';
            this.$set(this.value.config.defaultGroups, adfsGroup, wickedGroup);
        },
        selectAllApis: function () {
            for (let apiId in this.value.apis) {
                this.$set(this.value.apis, apiId, true);
            }
        },
        deselectAllApis: function () {
            for (let apiId in this.value.apis) {
                this.$set(this.value.apis, apiId, false);
            }
        }
    },
    template:
        `
    <wicked-panel :open=false 
                  :type="value.enabled ? 'success': 'warning'" 
                  :title="(value.useForPortal ? '✓ ' : '') + value.friendlyShort + ' (' + value.name + ', type ' + value.type + ')'"
                  :show-delete=true
                  v-on:delete="deleteAuthMethod"
    >
        <wicked-checkbox v-model="value.enabled" label="Enabled" />
        <wicked-checkbox v-model="value.useForPortal" label="Allow for Portal/wicked login" />
        <wicked-checkbox v-model="value.protected" label="Protected Auth Method (not visible in Portal)" />
        <wicked-input v-model="value.type" label="Type:" :readonly=true />
        <wicked-input v-model="value.name" label="Method ID:" :disallow-env-var=true :readonly=true></wicked-input>
        <wicked-input v-model="value.friendlyShort" label="Friendly short name of this auth method:" :env-var="envPrefix + 'SHORTDESC'"></wicked-input>
        <wicked-input v-model="value.friendlyLong" label="Longer friendly description of this auth method:" :env-var="envPrefix + 'LONGDESC'"></wicked-input>

        <hr>

        <div v-if="value.type == 'local'">
            <wicked-checkbox v-model="value.config.trustUsers" label="Trust user email addresses (only for internal use)" />
            <wicked-checkbox v-model="value.config.disableSignup" label="Disable interactive signup for new users" />
        </div>
        <div v-else-if="value.type == 'external'">
            <wicked-input v-model="value.config.validateUserPassUrl" label="URL to validate username/password:" :env-var="envPrefix + 'USERPASSURL'" hint="The auth server will POST to this URL to validate username and password, and expects a well-formed response. See <a href='https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.externaluserpassrequest.html' target='_blank'>ExternalUserPassRequest</a> and <a href='https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.externaluserpassresponse.html' target='_blank'>ExternalUserPassResponse</a>." />
            <wicked-input v-model="value.config.allowRefreshUrl" label="URL for refreshing tokens:" :env-var="envPrefix + 'REFRESHURL'" hint="The auth server will POST to this URL to check whether it is allowed to refresh a token, and expects a well-formed response. See <a href='https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.externalrefreshrequest.html' target='_blank'>ExternalRefreshRequest</a> and <a href='https://apim-haufe-io.github.io/wicked.node-sdk/interfaces/_interfaces_.externalrefreshresponse.html' target='_blank'>ExternalRefreshResponse</a>." />
            <p>Login UI Tweaks</p>
            <wicked-input v-model="value.config.forgotPasswordUrl" label="URL for resetting password:" :env-var="envPrefix + 'FORGOTPASSWORD'" hint="In case the external source has a web page which can be used to retrieve or reset passwords, you can specify it here, and it will be displayed as a 'Forgot password?' link on the login page." />
            <wicked-input v-model="value.config.usernamePrompt" label="Login prompt for username or email (leave empty for <code>Email</code>):" :env-var="envPrefix + 'USERPROMPT'" />
            <wicked-input v-model="value.config.passwordPrompt" label="Password prompt (leave empty for <code>Password</code>):" :env-var="envPrefix + 'PASSWORDPROMPT'" />
        </div>
        <div v-else-if="value.type == 'google'">
            <wicked-input v-model="value.config.clientId" label="Google client ID:" hint="The Google client ID for the wicked API Portal" :env-var="envPrefix + 'CLIENTID'"/>
            <wicked-input v-model="value.config.clientSecret" label="Google client Secret:" hint="The Google client secret for the wicked API Portal" :env-var="envPrefix + 'CLIENTSECRET'"/>
            <button v-on:click="emitDisplayCallback" class="btn btn-primary">Display Callback URLs</button>
        </div>
        <div v-else-if="value.type == 'github'">
            <wicked-input v-model="value.config.clientId" label="Github client ID:" hint="The Github client ID for the wicked API Portal" :env-var="envPrefix + 'CLIENTID'"/>
            <wicked-input v-model="value.config.clientSecret" label="Github client Secret:" hint="The Github client secret for the wicked API Portal" :env-var="envPrefix + 'CLIENTSECRET'"/>
            <button v-on:click="emitDisplayCallback" class="btn btn-primary">Display Callback URLs</button>
        </div>
        <div v-else-if="value.type == 'twitter'">
            <wicked-input v-model="value.config.consumerKey" label="Twitter consumer key:" hint="The Twitter consumer key for the wicked API Portal" :env-var="envPrefix + 'CONSUMERKEY'" />
            <wicked-input v-model="value.config.consumerSecret" label="Twitter consumer secret:" hint="The Twitter consumer secret for the wicked API Portal" :env-var="envPrefix + 'CONSUMERSECRET'" />
            <button v-on:click="emitDisplayCallback" class="btn btn-primary">Display Callback URLs</button>
        </div>
        <div v-else-if="value.type == 'oauth2'">
            <wicked-checkbox v-model="value.config.trustUsers" label="Trust user email addresses from this source (maps to <code>email_verified</code>)" />
            <wicked-input v-model="value.config.clientId" label="OAuth2 client ID:" hint="The OAuth2 client ID for the wicked API Portal" :env-var="envPrefix + 'CLIENTID'" />
            <wicked-input v-model="value.config.clientSecret" label="OAuth2 client Secret:" hint="The OAuth2 client secret for the wicked API Portal" :env-var="envPrefix + 'CLIENTSECRET'" />
            <wicked-input v-model="value.config.endpoints.authorizeEndpoint" label="Authorize endpoint of OAuth2 server:" hint="The authorization endpoint of the upstream OAuth2 server" :env-var="envPrefix + 'AUTHORIZE_URL'" />
            <wicked-checkbox v-model="value.config.doesNotSupportPrompt" label='Check this if the <code>/authorize</code> endpoint does <b>NOT</b> support the <code>prompt=none|login</code> query parameter (<a href="https://github.com/Haufe-Lexware/wicked.haufe.io/blob/next/doc/oauth-silent-refresh.md" target="_blank">more information</a>)' />
            <wicked-input v-model="value.config.endpoints.tokenEndpoint" label="Token endpoint of OAuth2 server:" hint="The token endpoint of the upstream OAuth2 server" :env-var="envPrefix + 'TOKEN_URL'" />
            <wicked-input v-model="value.config.endpoints.profileEndpoint" label="Profile endpoint of OAuth2 server:" hint="The profile endpoint of the upstream OAuth2 server" :env-var="envPrefix + 'PROFILE_URL'" />
            <wicked-input v-model="value.config.endpoints.authorizeScope" label="Authorization scope:" hint="Space separated scopes for authorization, e.g. <code>profile email</code>" :env-var="envPrefix + 'SCOPE'" />
            <wicked-checkbox v-model="value.config.retrieveProfile" label="Retrieve profile from profile endpoint (must be specified, assumed to be OIDC compliant); IF NOT: Token is assumed to be a JWT, please specify mapping below" />
            <hr>
            <wicked-input v-model="value.config.customIdField" label="JWT claim: Unique ID:" hint="REQUIRED: The JWT claim containing a unique ID from the remote IdP/OAuth2 server; usually <code>sub</code>" :env-var="envPrefix + 'FIELD_CUSTOMID'" />
            <wicked-input v-model="value.config.nameField" label="JWT Claim: Display name (full name):" hint="OPTIONAL: The JWT claim containing the full name/display name of the user (<code>name</code>)" :env-var="envPrefix + 'FIELD_NAME'" />
            <wicked-input v-model="value.config.firstNameField" label="JWT Claim: First/given name:" hint="OPTIONAL: The JWT claim containing the first/given name of the user (<code>given_name</code>)" :env-var="envPrefix + 'FIELD_FIRSTNAME'" />
            <wicked-input v-model="value.config.lastNameField" label="JWT Claim: Last/family name:" hint="OPTIONAL: The JWT claim containing the last/family name of the user (<code>family_name</code>)" :env-var="envPrefix + 'FIELD_LASTNAME'" />
            <wicked-input v-model="value.config.emailField" label="JWT Claim: Email address:" hint="REQUIRED: The JWT claim containing the email address of the user (<code>email</code>)" :env-var="envPrefix + 'FIELD_EMAIL'" />
            <hr>
            <wicked-input v-model="value.config.params" textarea=true json=true label="Additional request parameters when authorizing (<code>&quot;key&quot;: &quot;value&quot;</code> maps to <code>?key=value</code> in the authorize request):" height="150px" :env-var="envPrefix + 'PARAMS'" />
            <button v-on:click="emitDisplayCallback" class="btn btn-primary">Display Callback URLs</button>
        </div>
        <div v-else-if="value.type == 'adfs'">
            <wicked-checkbox v-model="value.config.trustUsers" label="Trust user email addresses from this source (maps to <code>email_verified</code>)" />
            <wicked-input v-model="value.config.clientId" label="ADFS client ID:" hint="The ADFS client ID for the wicked API Portal" :env-var="envPrefix + 'CLIENTID'" />
            <wicked-input v-model="value.config.clientSecret" label="ADFS client Secret:" hint="The ADFS client secret for the wicked API Portal (possibly not used)" :env-var="envPrefix + 'CLIENTSECRET'" />
            <wicked-input v-model="value.config.endpoints.authorizeEndpoint" label="Authorize endpoint of the ADFS server:" hint="The authorization endpoint of the upstream ADFS server" :env-var="envPrefix + 'AUTHORIZE_URL'" />
            <wicked-input v-model="value.config.endpoints.tokenEndpoint" label="Token endpoint of the ADFS server:" hint="The token endpoint of the upstream ADFS server" :env-var="envPrefix + 'TOKEN_URL'" />
            <wicked-input v-model="value.config.resource" label="ADFS Resource URI:" :env-var="envPrefix + 'RESOURCE_URL'" />
            <hr>
            <wicked-input v-model="value.config.customIdField" label="JWT claim: Unique ID:" hint="REQUIRED: The JWT claim containing a unique ID from the remote IdP/OAuth2 server; e.g. <code>upn</code> or <code>sub</code>'" :env-var="envPrefix + 'FIELD_CUSTOMID'" />
            <wicked-input v-model="value.config.nameField" label="JWT Claim: Display name (full name):" hint="OPTIONAL: The JWT claim containing the full name/display name of the user (<code>name</code>)" :env-var="envPrefix + 'FIELD_NAME'" />
            <wicked-input v-model="value.config.firstNameField" label="JWT Claim: First/given name:" hint="OPTIONAL: The JWT claim containing the first/given name of the user (<code>given_name</code>)" :env-var="envPrefix + 'FIELD_FIRSTNAME'" />
            <wicked-input v-model="value.config.lastNameField" label="JWT Claim: Last/family name:" hint="OPTIONAL: The JWT claim containing the last/family name of the user (<code>family_name</code>)" :env-var="envPrefix + 'FIELD_LASTNAME'" />
            <wicked-input v-model="value.config.emailField" label="JWT Claim: Email address:" hint="REQUIRED: The JWT claim containing the email address of the user (<code>email</code>)" :env-var="envPrefix + 'FIELD_EMAIL'" />
            <hr>
            <wicked-input v-model="value.config.certificate" textarea=true label="ADFS JWT Signing Certificate:" height="200px" :env-var="envPrefix + 'CERTIFICATE'" />
            <wicked-panel type="default" title="ADFS Group Mapping">
                <p>You can map ADFS groups to wicked user groups here. To use this feature, specify a group field mapping here, which is expected to contain a JSON array of
                strings (group names).</p>
                <wicked-input v-model="value.config.groupField" label="JWT Claim: Groups:" hint="Defaults to <code>group</code> if not specified." :env-var="envPrefix + 'FIELD_GROUPS'" />
                <table width="100%">
                    <tr>
                        <th class="scopecell">ADFS Group</th>
                        <th class="scopecell">Wicked Group</th>
                        <th class="scopecell">Action</th>
                    </tr>

                    <tr v-for="(wickedGroup, adfsGroup) in value.config.defaultGroups">
                        <td class="scopecell" style="width: 30%"><input class="form-control" :readonly=true :value="adfsGroup" /></td>
                        <td class="scopecell" style="width: 55%"><wicked-group-picker v-model="value.config.defaultGroups[adfsGroup]" :groups="groups"/></td>
                        <td class="scopecell" style="width: 15%"><button role="button" v-on:click="deleteGroupMapping(adfsGroup)" class="btn btn-sm btn-danger">Remove</button></td>
                    </tr>

                    <tr>
                        <td class="scopecell"><input class="form-control" id="new_adfs_group" v-model="newAdfsGroup" /></td>
                        <td class="scopecell"><wicked-group-picker v-model="newWickedGroup" :groups="groups" :include-none=true /></td>
                        <td class="scopecell"><button role="button" v-on:click="addGroupMapping(newAdfsGroup, newWickedGroup)" class="btn btn-sm btn-success" :disabled="newAdfsGroup === '' || !newWickedGroup">Add</button></td>
                    </tr>
                </table>
            </wicked-panel>
            <button v-on:click="emitDisplayCallback" class="btn btn-primary">Display Callback URLs</button>
        </div>
        <div v-else-if="value.type == 'saml'">
            <wicked-checkbox v-model="value.config.trustUsers" label="Trust user email addresses from this source (maps to <code>email_verified</code>)" />
            <wicked-input v-model="value.config.profile" textarea=true json=true label="Profile mapping (from attribute values):" height="200px" :env-var="envPrefix + 'PROFILE_MAP'" />
            <p class="wicked-note">Required claims are <code>sub</code> and <code>email</code>; recommended is also <code>name</code>, supports 
                <a href="https://mustache.github.io" target="_blank">Mustache templates</a>. Attributes are case-insensitive.</p>
            <wicked-input v-model="value.config.spOptions" textarea=true json=true label="SAML Service Profile options:" height="200px" :env-var="envPrefix + 'SP_OPTIONS'" />
            <wicked-input v-model="value.config.idpOptions" textarea=true json=true label="SAML Identity Provider options:" height="200px" :env-var="envPrefix + 'IDP_OPTIONS'" />
            <p>The possible options for "Service Provider" and "Identity Provider" options can be reviewed here: 
                <a href="https://www.npmjs.com/package/saml2-js#ServiceProvider" target="_blank">Service Provider options</a>, 
                <a href="https://www.npmjs.com/package/saml2-js#IdentityProvider" target="_blank">Identity Provider options</a>.</p>
        </div>
        <div v-else-if="value.type == 'ldap'">
            <wicked-checkbox v-model="value.config.trustUsers" label="Trust user email addresses from this source (maps to <code>email_verified</code>)" />
            <wicked-input v-model="value.config.url" label="Fully qualified URL to your LDAP server, as reachable from wicked:" :env-var="envPrefix + 'URL'" />
            <wicked-input v-model="value.config.ldapUser" label="LDAP User allowed to bind and perform a search:" :env-var="envPrefix + 'USER'" />
            <wicked-input v-model="value.config.ldapPassword" label="LDAP Password for above user:" :env-var="envPrefix + 'PASSWORD'" />
            <wicked-input v-model="value.config.base" label="Base search DN:" :env-var="envPrefix + 'BASEDN'" />
            <wicked-input v-model="value.config.filter" label="Filter string; must contain <code>%username%</code>:" :env-var="envPrefix + 'FILTER'" />
            <p class="wicked-note">The filter string must map the entered username to a single LDAP entry. Typical filter strings are (for a Microsoft AD): <code>(&(objectClass=organizationalPerson)(sAMAccountName=%username%))</code> (allows login per plain username), or <code>(&(objectClass=organizationalPerson)(mail=%username%))</code> (log in by email address)</p>
            <wicked-input v-model="value.config.profile" textarea=true json=true label="Profile mapping (from attribute values):" height="200px" :env-var="envPrefix + 'PROFILE_MAP'" />
            <p class="wicked-note">Required claims are <code>sub</code> and <code>email</code>; recommended is also <code>name</code>. Only direct attributes are supported, templating is currently not supported.</p>
            <hr>
            <p>Login UI Tweaks</p>
            <wicked-input v-model="value.config.usernamePrompt" label="Login prompt for username or email (leave empty for <code>Email</code>):" :env-var="envPrefix + 'USERPROMPT'" />
            <wicked-input v-model="value.config.passwordPrompt" label="Password prompt (leave empty for <code>Password</code>):" :env-var="envPrefix + 'PASSWORDPROMPT'" />
            <wicked-input v-model="value.config.forgotPasswordUrl" label="URL for resetting password:" :env-var="envPrefix + 'FORGOTPASSWORD'" hint="In case the LDAP server has a web page which can be used to retrieve or reset passwords, you can specify it here, and it will be displayed as a 'Forgot password?' link on the login page." />
        </div>
        <div v-else>
            <p><i>Unknown auth method type. To change this, please edit the JSON file directly.</i></p>
        </div>

        <br>

        <wicked-panel :open=false 
            type="success" 
            title="Supported APIs">
            <button v-on:click="selectAllApis" class="btn btn-sm btn-primary">Select all</button>
            <button v-on:click="deselectAllApis" class="btn btn-sm btn-default">Deselect all</button>
            <wicked-checkbox v-for="(v, apiId) in value.apis" v-model="value.apis[apiId]" :label="apiId" />
        </wicked-panel>
    </wicked-panel>
    `
});

Vue.component('add-auth-method', {
    props: ['value'],
    data: function () {
        return {
            selectedType: null,
            authMethodId: null
        };
    },
    computed: {
        authMethodIdValid: function () {
            return /^[a-z0-9\_-]+$/.test(this.authMethodId); // eslint-disable-line
        }
    },
    methods: {
        addAuthMethod: function () {
            this.value.push({
                enabled: false,
                useForPortal: false,
                type: this.selectedType,
                name: this.authMethodId,
                friendlyShort: 'Short friendly name',
                friendlyLong: 'Long friendly name',
                config: createDefaultConfig(this.selectedType, this.authMethodId),
                apis: JSON.parse(JSON.stringify(injectedData.oauthApis))
            });
        }
    },
    template: `
        <div>
            <div class="form-group">
                <label for="add_auth_method">Add an auth method:</label>
                <select v-model="selectedType" class="form-control">
                    <option disabled value="">Please select a type</option>
                    <option>local</option>
                    <option>external</option>
                    <option>google</option>
                    <option>github</option>
                    <option>twitter</option>
                    <option>oauth2</option>
                    <option>adfs</option>
                    <option>saml</option>
                    <option>ldap</option>
                </select>
                <p></p>
                <input v-if="!!selectedType" v-model="authMethodId" class="form-control" placeholder="Enter an auth method id (a-z, 0-9, _, -)">
                <span v-if="!!authMethodId && !authMethodIdValid" style="color:red;">Invalid auth method ID; can only contain lower case characters, digits, - and _</span>
                <p></p>
                <button v-if="authMethodId && authMethodIdValid" v-on:click="addAuthMethod" class="btn btn-primary">Add Auth Method</button>
            </div>
        </div>
    `
});

Vue.component('password-validation', {
    props: ['value', 'strategies'],
    template: `
        <wicked-panel type="primary" :open=true :collapsible=false title="Password Validation Strategy">
            <p>Please select the method with which the default authorization server and wicked's API validates password strength.</p>
            <select v-model="value.passwordStrategy" class="form-control">
                <option v-for="(strategy, index) in strategies" :value="strategy.strategy">{{ strategy.description }}</option>
            </select>
        </wicked-panel>
    `
});

function createDefaultConfig(authMethodType, authMethodId) {
    let defaultConfig;
    switch (authMethodType) {
        case 'local':
            defaultConfig = {
                trustUsers: false,
                disableSignup: false
            };
            break;
        case 'external':
            defaultConfig = {
                validateUserPassUrl: 'http://your-service.default.cluster.local:2000/login',
                allowRefreshUrl: 'http://your-service.default.cluster.local:2000/refresh'
            };
            break;
        case 'github':
        case 'google':
            defaultConfig = {
                clientId: 'your-client-id',
                clientSecret: 'your-client-secret'
            };
            break;
        case 'twitter':
            defaultConfig = {
                consumerKey: 'twitter-consumer-key',
                consumerSecret: 'twitter-consumer-secret'
            };
            break;
        case 'oauth2':
            defaultConfig = {
                clientId: 'your-client-id',
                clientSecret: 'your-client-secret',
                endpoints: {
                    authorizeEndpoint: 'https://your.idp.com/oauth2/authorize',
                    authorizeScope: 'profile email',
                    tokenEndpoint: 'https://your.idp.com/oauth2/token',
                    profileEndpoint: 'https://your.idp.com/oauth2/profile',
                },
                params: '{}',
                customIdField: 'sub',
                firstNameField: 'given_name',
                lastNameField: 'family_name',
                emailField: 'email'
            };
            break;
        case 'adfs':
            defaultConfig = {
                clientId: 'your-client-id',
                clientSecret: 'your-client-secret',
                endpoints: {
                    authorizeEndpoint: 'https://your.idp.com/oauth2/authorize',
                    tokenEndpoint: 'https://your.idp.com/oauth2/token',
                },
                resource: "http://your.resource.uri",
                params: {},
                customIdField: 'sub',
                firstNameField: 'given_name',
                lastNameField: 'family_name',
                emailField: 'email',
                certificate: '-----BEGIN CERTIFICATE-----\r\nMIIFBjCCA...',
                defaultGroups: {
                    "DOMAIN\\_Some_Group": "dev"
                }
            };
            break;
        case 'saml': {
            const envVarPrefix = '$PORTAL_AUTH_SAML_' + authMethodId.toUpperCase().replace(/-/g, '_') + '_';
            defaultConfig = {
                trustUsers: true,
                profile: JSON.stringify({
                    "sub": "{{{your_id}}}",
                    "given_name": "{{{firstname}}}",
                    "family_name": "{{{lastname}}}",
                    "name": "{{{firstname}}} {{{lastname}}}",
                    "email": "{{{email}}}"
                }, null, 2),
                "spOptions": JSON.stringify({
                    "nameid_format": "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
                    "certificate": envVarPrefix + 'SP_CERT',
                    "private_key": envVarPrefix + 'SP_KEY',
                    "sign_get_request": false,
                    "allow_unencrypted_assertion": true
                }, null, 2),
                "idpOptions": JSON.stringify({
                    "sso_login_url": "https://login.saml-provider.com/auth/SSORedirect/metaAlias/idp",
                    "sso_logout_url": "https://login.saml-provider.com/auth/IDPSloRedirect/metaAlias/idp",
                    "certificates": [
                        envVarPrefix + 'IDP_CERT'
                    ],
                    "sign_get_request": false,
                    "allow_unencrypted_assertion": true
                }, null, 2)
            };
            break;
        }
        case 'ldap': {
            const envVarPrefix = '$PORTAL_AUTH_LDAP_' + authMethodId.toUpperCase().replace(/-/g, '_') + '_';
            defaultConfig = {
                trustUsers: true,
                url: 'ldaps://ldap.company.com:636',
                ldapUser: '',
                ldapPassword: '',
                base: 'DC=domain,DC=company,DC=com',
                filter: '(&(objectClass=organizationalPerson)(sAMAccountName=%username%))',
                usernamePrompt: 'Username',
                profile: JSON.stringify({
                    sub: 'sAMAccountName',
                    email: 'mail',
                    name: 'displayName'
                }, null, 2)
            };
            break;
        }
        default:
            defaultConfig = {};
            break;
    }
    return defaultConfig;
}

function displayCallbackUris(uri, authMethodId) {
    $.getJSON('/api/globals/hosts').fail(function () {
        alert("Could not retrieve hosts from backend. Is it running?");
    }).done(function (data) {
        $('#modalTitle').text('Callbacks for ' + authMethodId);
        let tabs = `<li class="active"><a data-toggle="tab" href="#tab_default">default</a></li>`;
        let content = `
            <div class="tab-pane fade in active" id="tab_default">
                <div class="panel-content">
                    <br>
                    <input readonly class="form-control" value="${data.default.apiHost}${uri}/${authMethodId}/callback">
                </div>
            </div>`;
        for (let e in data) {
            if (e === 'default')
                continue;
            tabs += `<li><a data-toggle="tab" href="#tab_${e}">${e}</a></li>`;
            content += `
                <div class="tab-pane fade" id="tab_${e}">
                    <div class="panel-content">
                        <br>
                        <input readonly class="form-control" value="${data[e].apiHost}${uri}/${authMethodId}/callback">
                    </div>
                </div>`;
        }
        $('#modalContent').html(`
            <ul class="nav nav-tabs">
                ${tabs}
            </ul>
      
            <div class="tab-content">
                ${content}
            </div>
          `);
        $('#modalDialog').modal();
    });
}

// ==============================================================

const vm = new Vue({
    el: '#authserverBase',
    data: injectedData
});

function storeData() {
    const serverId = vm.serverId;
    $.post({
        url: `/authservers/${serverId}/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function () {
        alert('Successfully stored data.');
    });
}
