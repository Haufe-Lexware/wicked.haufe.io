/* global Vue, $, injectedData */

Vue.component('wicked-database', {
    props: ['value'],
    template: `
    <div>
        <wicked-panel :open=true type="primary" title="Postgres Configuration">
            <p>Wicked and Kong both usually store their information in Postgres, even if Wicked
               can also use plain files (not recommended for production use). This section allows
               you to configure the Postgres instance which is to be used.</p>
            
            <p><strong>NOTE:</strong> The official <helm-chart /> can install a simple Postgres
               instance for Kong and wicked to use, but it's recommended you run a separate Postgres
               instance (or cluster) separately from the wicked installation and manage the Postgres
               lifecycle independently from wicked. Wicked and Kong presumably also work with most
               managed Postgres services (Amazon RDS, Azure Postgres).</p>
            
            <p>Wicked's <code>portal-api</code> container will try to connect to the given Postgres
               instance's <code>postgres</code> database and then create a separate <code>wicked</code>
               database and schema, so the below user needs to have sufficient rights to do that, OR,
               you can create the database in advance and just assign the rights to that database.</p>

            <wicked-input v-model="value.storage.type" label="Storage Type:" env-var="PORTAL_STORAGE_TYPE" hint="Allowed values are <code>postgres</code> and <code>json</code>" />
            <wicked-input v-model="value.storage.pgHost" label="Postgres Host:" env-var="PORTAL_STORAGE_PGHOST" hint="The host IP of the Postgres server" />
            <wicked-input v-model="value.storage.pgPort" label="Postgres Port:" env-var="PORTAL_STORAGE_PGPORT" hint="The Port of the Postgres server (defaults to <code>5432</code>)" />
            <wicked-input v-model="value.storage.pgUser" label="Postgres Username:" env-var="PORTAL_STORAGE_PGUSER" hint="The Postgres username (needs access to database <code>postgres</code> and must be allowed to create new databases)" />
            <wicked-input v-model="value.storage.pgPassword" label="Postgres Password:" env-var="PORTAL_STORAGE_PGPASSWORD" hint="Password for the postgres user" />
            <wicked-input v-model="value.storage.pgDatabase" label="Postgres Database:" env-var="PORTAL_STORAGE_PGDATABASE" hint="Database to store wicked's data in" />
            
        </wicked-panel>

        <wicked-panel :open=true type="primary" title="Redis Configuration">
            <p>Wicked needs a Redis instance to store session information, both in the Portal UI and in
            in the Authorization Server UI. It also uses the redis instance to cache various other information
            across instances. Additionally, Redis can also be used by Kong to cache rate limiting data.</p>

            <p><strong>NOTE:</strong> The official <helm-chart /> can automatically also deploy a simple redis instance, 
                but it is recommended that you set up a dedicated Redis instance (or cluster) for production use.</p>

            <wicked-input v-model="value.sessionStore.type" label="Session Store type:" env-var="PORTAL_SESSIONSTORE_TYPE" hint="The portal session store type, <code>redis</code> or <code>file</code> is supported" />
            <wicked-input v-model="value.sessionStore.host" label="Redis Host:" env-var="PORTAL_SESSIONSTORE_REDISHOST" hint="The Redis host (if applicable)" />
            <wicked-input v-model="value.sessionStore.port" label="Redis Port:" env-var="PORTAL_SESSIONSTORE_REDISPORT" hint="The Redis port (if applicable, 6379 is default)" />
            <wicked-input v-model="value.sessionStore.password" label="Redis Password:" env-var="PORTAL_SESSIONSTORE_REDISPASSWORD" hint="The Redis password (if applicable, leave empty to not use a password)" />
        </wicked-panel>
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
        url: `/database/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function () {
        alert('Successfully stored data.');
    });
}
