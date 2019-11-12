'use strict';

import { KongService, KongRoute, KongApi, ProtocolType } from "./kong-interfaces";

/** @hidden */
function deducePort(url: URL): number {
    if (url.port) {
        if (typeof url.port === 'number') {
            return url.port;
        }
        try {
            const port = parseInt(url.port);
            return port;
        } catch (err) {
            console.warn(`deducePort(): Could not parse port from upstream url (port: ${url.port}), guessing by protocol.`);
            console.warn(err);
        }
    }

    if (url.protocol) {
        switch (url.protocol) {
            case 'http:': return 80;
            case 'https:': return 443;
            default:
                console.warn(`deducePort(): Unknown protocol for upstream url: ${url.protocol}, default port to 443`);
                return 443;
        }
    }

    console.warn(`deducePort(): Upstream URL has neither port nor protocol, defaulting to port 80`);
    return 80;
}

/** @hidden */
function deducePath(url: URL): string {
    if (url.pathname)
        return url.pathname;
    return '/';
}

/** @hidden */
function deduceProtocol(url: URL): ProtocolType {
    switch (url.protocol) {
        case 'http:': return ProtocolType.http;
        case 'https:': return ProtocolType.https;
    }
    console.warn(`deducePort(): Unknown protocol for upstream url: ${url.protocol}, defaulting to https`);
    return ProtocolType.https;
}

// Service+Route <-> API
export function kongApiToServiceRoute(api: KongApi): { service: KongService, route: KongRoute } {
    let upstreamUrl;
    try {
        upstreamUrl = new URL(api.upstream_url);
    } catch (err) {
        console.error(`kongApiToServiceRoute: The upstream URL "${api.upstream_url}" is not a valid URL. Setting to http://dummy.org/foo`);
        console.error(err);
        upstreamUrl = new URL('http://dummy.org/foo');
    }
    const service: KongService = {
        id: api.id,
        protocol: deduceProtocol(upstreamUrl),
        host: upstreamUrl.hostname,
        port: deducePort(upstreamUrl),
        path: deducePath(upstreamUrl),
        name: api.name,
        retries: api.retries,
        connect_timeout: api.upstream_connect_timeout,
        read_timeout: api.upstream_read_timeout,
        write_timeout: api.upstream_send_timeout,
    }
    const route: KongRoute = {
        hosts: null,
        protocols: [ProtocolType.http, ProtocolType.https],
        paths: api.uris,
        methods: null,
        regex_priority: 0,
        strip_path: api.strip_uri,
        preserve_host: api.preserve_host,
        service: {
            id: api.id
        }
    };
    return {
        service: service,
        route: route
    };
}

export function kongServiceRouteToApi(service: KongService, route: KongRoute): KongApi {
    let upstreamUrl;
    try {
        upstreamUrl = new URL(`${service.protocol}://${service.host}:${service.port}${service.path}`);
    } catch (err) {
        console.error(`kongServiceRouteToApi: Could not assemble valid URL from service definition (see next line), setting to http://dummy.org/foo`);
        console.error(service);
        upstreamUrl = new URL('http://dummy.org/foo');
    }
    return {
        id: service.id,
        name: service.name,
        upstream_url: upstreamUrl.toString(),
        hosts: route.hosts,
        uris: route.paths,
        strip_uri: route.strip_path,
        preserve_host: route.preserve_host,
        retries: service.retries,
        upstream_connect_timeout: service.connect_timeout,
        upstream_read_timeout: service.read_timeout,
        upstream_send_timeout: service.write_timeout
    };
}
