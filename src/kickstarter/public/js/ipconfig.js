/* global Vue, $, injectedData */

Vue.component('wicked-ipconfig', {
    props: ['value'],
    template: `
    <div>
        <wicked-panel type="primary" :open=true title="IP and DNS configuration">
            <p>Specify the DNS names under which the API Portal and Gateway shall be reached. The API portal
            assumes that you can reach the portal under a certain DNS name (e.g. <code>topic.yourcompany.com</code>, and
            the API Gateway is reachable under <code>api.(your domain)</code>, e.g. 
            <code>api.topic.yourcompany.com</code>.</p>
            
            <p>In case you are testing/developing locally, it is easier not to have the load balancer running locally.
            This is assumed below for the local development scenarios; in these cases, the schema is set to
            <code>http</code>. In the real deployment scenario (running in docker), the only allowed schema is
            <code>https</code>.</p>

            <wicked-input v-model="value.network.schema" label="Schema (https):" env-var="PORTAL_NETWORK_SCHEMA" />
            <wicked-input v-model="value.network.portalHost" label="Portal Host:" env-var="PORTAL_NETWORK_PORTALHOST'" hint="This has to be the DNS entry of the host on which the portal UI is to be served from. Use <code>\$\{LOCAL_PORTAL_HOST\}</code> for local development to resolve automatically." />
            <wicked-input v-model="value.network.apiHost" label="API Host:" env-var="PORTAL_NETWORK_APIHOST" hint="This is the DNS name of the API gateway, or the IP when testing locally. For local development, use <code>\$\{LOCAL_API_HOST\}</code> to resolve automatically." />

            <p><strong>IMPORTANT NOTE:</strong> When deploying to Kubernetes using the <helm-chart />,
                the portal and API hosts are injected to the configuration via container environment variables,
                and it's recommended that you always use the same environment setting (by default, that's <code>k8s</code>).</p>
        </wicked-panel>

        <wicked-panel type="danger" :open=false title="Container and Configuration Wiring">

            <p>In most situations you will never ever change any of these values. For Docker deployments, the default values
            are perfectly fine, and in case you develop locally, you can still override the values from the command line.</p>

            <p>Same applies if you are using Kubernetes; the defaults should work nicely with the official <helm-chart />.</p>

            <wicked-input v-model="value.db.staticConfig" label="Static Configuration path:" env-var="PORTAL_API_STATIC_CONFIG" hint="The local path under which the static configuration (<code>/static</code>) can be found." />

            <p><strong>IMPORTANT:</strong> This field is only important if you are still using the <code>json</code> storage backend,
            which is highly <strong>not recommended</strong> for production use. Please use the Postgres backend. See also <a href="/database">Database configuration</a>.</p>

            <wicked-input v-model="value.db.dynamicConfig" label="Dynamic Configuration path:" env-var="PORTAL_API_DYNAMIC_CONFIG" hint="The local path for the dynamic configuration (users, applications, keys,...) can be found (<code>/dynamic</code>)." />
            <hr>
        
            <wicked-input v-model="value.network.apiUrl" label="Portal API URL:" hint="The URL under which the internal API of the API Portal can be reached (behind the load balancer)." env-var="PORTAL_API_URL" />
            <wicked-input v-model="value.network.portalUrl" label="Portal URL:" hint="The URL for the Portal UI, as seen from behind the load balancer (NOT the above Portal Host!)." env-var="PORTAL_PORTAL_URL" />
            <wicked-input v-model="value.network.kongAdapterUrl" label="Kong Adapter URL:" hint="The URL under which the Kong Adapter can be reached (behind the load balancer)." env-var="PORTAL_KONG_ADAPTER_URL" />
            <wicked-input v-model="value.network.kongAdminUrl" label="Kong Management URL:" hint="The Kong Admin URL (usually port 8001), as seen from behind the load balancer." env-var="PORTAL_KONG_ADMIN_URL" />
            <wicked-input v-model="value.network.kongProxyUrl" label="[OPTIONAL] Kong Proxy URL:" hint="The Kong Proxy URL (usually port 8000), as seen from behind the load balancer. This field can be left empty if it is the same as the Kong Admin URL, just using port 8000 instead (the default). If you need a custom setting here, fill this field." env-var="PORTAL_KONG_PROXY_URL" />
            <wicked-input v-model="value.network.mailerUrl" label="Mailer URL:" hint="The URL under which the Mailer component can be reached (behind the load balancer)." env-var="PORTAL_MAILER_URL" />
            <wicked-input v-model="value.network.chatbotUrl" label="Chatbot URL:" hint="The URL under which the Chatbot component can be reached (behind the load balancer)." env-var="PORTAL_CHATBOT_URL" />
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
        url: `/ipconfig/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function () {
        alert('Successfully stored data.');
    });
}
