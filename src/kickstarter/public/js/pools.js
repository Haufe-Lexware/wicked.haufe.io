/* global Vue, $, injectedData, randomId */

Vue.component('wicked-pools', {
    props: ['value'],
    data: function () {
        // console.log(this.value);
        const oidcClaims = [
            "sub",
            "name",
            "given_name",
            "family_name",
            "middle_name",
            "nickname",
            "preferred_username",
            "profile",
            "picture",
            "website",
            "email",
            "email_verified",
            "gender",
            "birthdate",
            "zoneinfo",
            "locale",
            "phone_number",
            "phone_number_verified"
        ];
        return {
            internalId: randomId(),
            standardClaims: oidcClaims,
            newPropName: '',
            newPoolId: ''
        };
    },
    methods: {
        deleteProperty: function (poolId, propId) {
            if (confirm('Are you sure you want to delete the property ' + propId + '? You will have to save for this to be permanent.')) {
                const propIndex = this.value[poolId].properties.findIndex(p => p.id === propId);
                if (propIndex >= 0) {
                    this.value[poolId].properties.splice(propIndex, 1);
                }
            }
        },
        addProperty: function (poolId, propId) {
            alert(poolId + ' ' + propId);

            this.newPropName = '';
            this.value[poolId].properties.push({
                id: propId,
                description: "Add property description",
                type: "string",
                minLength: 0,
                maxLength: 0,
                required: false,
                oidcClaim: ''
            });
        },
        isValidPropName: function (propId) {
            return /^[a-z0-9_\:]+$/.test(propId);
        },
        addPool: function (poolId) {
            this.$set(this.value, poolId, {
                id: poolId,
                name: 'Enter Pool Name',
                disallowRegister: false,
                requiresNamespace: false,
                properties: [
                    {
                        id: 'name',
                        description: 'Display name (full name)',
                        type: 'string',
                        minLength: 0,
                        maxLength: 255,
                        required: true,
                        oidcClaim: 'name'
                    }
                ]
            });
            // Note, due to https://github.com/wxsms/uiv/issues/231, the "oidcClaim"
            // will not be visible in the UI directly after adding a new pool. Arghl.
            // And the jQuery bugaround does not work here, as the DOM has not yet
            // been rebuilt. Leaving it as-is right now.
        },
        isValidPoolId: function (poolId) {
            return /^[a-z0-9_]+$/.test(poolId);
        },
        deletePool: function (poolId) {
            if (confirm(`Are you sure you want to delete this registration pool?
            
Deleting registration pools is only possible if there are no existing registrations within this pool.
There will be no error messages in the Kickstarter, but wicked will get into serious trouble.

To persist the deletion, you will need to save this page.`)) {
                this.$delete(this.value, poolId);                
            }
        }
    },
    // Workaround for https://github.com/wxsms/uiv/issues/231, can be removed once fixed
    mounted: function () {
        for (let poolId in this.value) {
            const poolInfo = this.value[poolId];
            for (let i = 0; i < poolInfo.properties.length; ++i) {
                const propInfo = poolInfo.properties[i];
                const inputId = this.internalId + '_' + poolId + '_' + propInfo.id;
                $('#' + inputId).val(propInfo.oidcClaim);
            }
        }
    },
    template: `
        <div>
            <!--
            <input :id="internalId + '_woo'" class="form-control" type="text" placeholder="OpenID Connect claim..." />
            <typeahead v-model="whatever" :target="'#' + internalId + '_woo'" :data="standardClaims" /> -->
            <div v-for="(poolInfo, poolId) in value">
                <wicked-panel type="primary" :open=false :title="'Pool ' + poolId" :show-delete="poolId !== 'wicked'" v-on:delete="deletePool(poolId)">
                    <wicked-input :readonly=true v-model="value[poolId].id" label="Pool ID:"/>
                    <wicked-input v-model="value[poolId].name" label="Pool Name:" hint="This name can be used by your application to display information on the registration pool, it is also used to distinguish between registrations for users by the Authorization Server." />
                    <wicked-checkbox v-model="value[poolId].disallowRegister" label="<b>Disallow interactive registration</b>: Check the following check box if you do not want to enable interative registration to this pool; this means that you need to create user registrations for this pool via the wicked API." />
                    <wicked-checkbox v-model="value[poolId].requiresNamespace" label="<b>Pool Requires a Namespace:</b> Check this checkbox to ensure that there can be no registrations without a namespace (tenant) attached to it. Read the docs for more information on registration namespaces." />
                    
                    <hr>
                    <h4>Pool properties</h4>
                    <p>Specify which properties shall be collected from the user when registering. Please note that these properties <b>can be changed</b> by the user,
                        and should thus not contain properties such as "roles" or "rights". These properties are the profile information of the user which he is free 
                        to change as he wishes (as long as they comply to the validation rules). There <b>must</b> exist a property called <code>name</code>.</p>

                    <wicked-panel v-for="(propInfo, index) in value[poolId].properties" :key="propInfo.id" :title="propInfo.id" :show-delete="propInfo.id !== 'name'" v-on:delete="deleteProperty(poolId, propInfo.id)" type="success">
                        <wicked-input v-model="value[poolId].properties[index].description" label="Description:" />
                        <label>Type:</label>
                        <select v-model="value[poolId].properties[index].type" class="form-control">
                            <option>string</option>
                        </select>
                        <wicked-input v-model.number="value[poolId].properties[index].maxLength" label="Maximum length of input (0 to disable)" />
                        <wicked-input v-model.number="value[poolId].properties[index].minLength" label="Minimum length of input (0 to disable)" />
                        <wicked-checkbox v-model="value[poolId].properties[index].required" label="<b>Required field:</b> Check this checkbox to make sure this field is always filled by the user." />
                        <label>Open ID Claim:</label>
                        <input :id="internalId + '_' + poolId + '_' + propInfo.id" class="form-control" type="text" placeholder="Specify claim name..." />
                        <typeahead v-model="value[poolId].properties[index].oidcClaim" :target="'#' + internalId + '_' + poolId + '_' + propInfo.id" :data="standardClaims" /> 
                        <!-- <input id="aninput" class="form-control" type="text" />
                        <typeahead v-model="oidcClaim" target="#aninput" :data="standardClaims" /> -->
                    </wicked-panel>

                    <label>To add a property, specify the ID:</label>
                    <div class="input-group">
                        <input class="form-control" v-model="newPropName" />
                        <span class="input-group-btn">
                            <button v-on:click="addProperty(poolId, newPropName)" :disabled="newPropName === '' || !isValidPropName(newPropName)" class="btn btn-success">Add Property</button>
                        </span>
                    </div>
                    <p v-if="newPropName === '' || isValidPropName(newPropName)" class="wicked-note">Property names can contain lower case characters, numbers, underscore _ and colon :.</p>
                    <p v-if="newPropName !== '' && !isValidPropName(newPropName)" class="wicked-note"><span style="font-weight:bold; color:red">Invalid property name</span>: Property names can contain lower case characters, numbers, underscore _ and colon :.</p>
                </wicked-panel>
            </div>
            <label>To create a new pool, specify the pool ID:</label>
            <div class="input-group">
                <input class="form-control" v-model="newPoolId" />
                <span class="input-group-btn">
                    <button v-on:click="addPool(newPoolId)" :disabled="newPoolId === '' || !isValidPoolId(newPoolId)" class="btn btn-success">Add Pool</button>
                </span>
            </div>
            <p v-if="newPoolId === '' || isValidPoolId(newPoolId)" class="wicked-note">Pool IDs can contain lower case characters, numbers, and underscore _.</p>
            <p v-if="newPoolId !== '' && !isValidPoolId(newPoolId)" class="wicked-note"><span style="font-weight:bold; color:red">Invalid pool ID</span>: Pool IDs can contain lower case characters, numbers, and underscore _.</p>
        </div>
    `
});

// ==============================================================

const vm = new Vue({
    el: '#vueBase',
    data: injectedData
});

function storeData() {
    $.post({
        url: `/pools/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function () {
        alert('Successfully stored data.');
    });
}
