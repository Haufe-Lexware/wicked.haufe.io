'use strict';

/* global alert, Vue, $, injectedData */

Vue.component('wicked-default-group', {
    props: ['value', 'groups'],
    template: `
    <div>
        <p>wicked lets you specify a user group which new users are automatically assigned to as soon as they
        have validated their email addresses, or if they logged in via any of the federated authentication
        means (ADFS, Google or Github). If you don't want the user to be auto assigned a group, specify
        "&lt;none&gt;" here:</p>
        <label>Group automatically assigned to users with a verified email address:</label>
        <wicked-group-picker v-model="value.validatedUserGroup" :groups="groups" :include-none=true />
    </div>
    `
});

Vue.component('wicked-groups', {
    props: ['value'],
    data: function () {
        return {
            selectedIndex: 0
        };
    },
    methods: {
        isSelected: function (index) {
            return index === this.selectedIndex;
        },
        selectGroup: function (index) {
            this.selectedIndex = index; 
        },
        isValidGroupId: function (groupId) {
            return /^[a-z0-9_-]+$/.test(groupId);
        },
        addGroup: function () {
            this.value.groups.push({
                id: "new_group",
                name: "New Group",
                adminGroup: false,
                approverGroup: false
            });
            this.selectedIndex = this.value.groups.length - 1;
        },
        deleteGroup: function (groupIndex) {
            if (groupIndex >= this.value.groups.length - 1)
                this.selectedIndex = this.value.groups.length - 2;
            this.value.groups.splice(groupIndex, 1);
        }
    },
    template: `
    <div class="row">
        <div class="col-md-4">
            <wicked-panel type="primary" :collapsible=false title="Group List">
                <div v-for="(group, index) in value.groups">
                    <div class="btn-group btn-group-justified" style="width:100%">
                        <a role="button" v-on:click="selectGroup(index)" style="width:85%" :class="{ btn: true, 'btn-lg': true, 'btn-primary': isSelected(index), 'btn-default': !isSelected(index) }">{{ group.name }} ({{ group.id }})</a>
                        <a v-if="group.id !== 'admin'" role="button" v-on:click="deleteGroup(index)" style="width:15%" class="btn btn-lg btn-danger"><span class="glyphicon glyphicon-remove"></span></a>
                    </div>
                    <div style="height:10px"></div>
                </div>
                <a role="button" v-on:click="addGroup" class="btn btn-lg btn-success"><span class="glyphicon glyphicon-plus"></span></a>
            </wicked-panel>
        </div>
        <div class="col-md-8">
            <wicked-panel type="primary" :collapsible=false :title="value.groups[selectedIndex].name">
                <wicked-input v-model="value.groups[selectedIndex].id" :readonly="value.groups[selectedIndex].id === 'admin'" label="Group ID:" hint="Must only contain a-z, 0-9, - and _ characters." />
                <p v-if="!isValidGroupId(value.groups[selectedIndex].id)" class="wicked-note" style="color:red">The group ID is not valid.</p>
                <wicked-input v-model="value.groups[selectedIndex].name" label="Group Name:" />

                <wicked-checkbox v-model="value.groups[selectedIndex].adminGroup" label="<b>Admin Group:</b> Members of this group will have Administrator rights inside the wicked Portal." />
                <wicked-checkbox v-model="value.groups[selectedIndex].approverGroup" label="<b>Approver Group:</b> Members of this group will have rights to approve subscriptions." />

                <p class="wicked-note"><b>Note:</b> If you are looking for the ADFS group mapping for groups, this has been moved to the &quot;right&quot; place, in
                  the configuration of the <a href="/authservers">authorization servers</a>, in case you have specified an ADFS auth method.</p>

                <p v-if="value.groups[selectedIndex].id === 'admin'" class="wicked-note"><b>Note:</b> The <code>admin</code> group cannot be renamed or deleted. 
                  You may add additional groups with admin rights, but the main group must remain in the configuration.</p>
            </wicked-panel>
        </div>
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
        url: `/groups/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function () {
        alert('Successfully stored data.');
    });
}
