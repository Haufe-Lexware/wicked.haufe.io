'use strict';

import { KongApiConfig, KongPlugin, KongConsumer, WickedSubscription, WickedApplication, WickedApi } from "wicked-sdk";

export interface SyncStatistics {
    actions: any[],
    failedComparisons: any[],
    err?: any
}

export interface ConsumerPlugin {
    consumer?: { id: string },
    created_at?: number,
    id?: string,
}

export interface ConsumerAclConfig extends ConsumerPlugin {
    group: string
}

export interface ConsumerOAuth2Config extends ConsumerPlugin {
    name: string,
    client_id: string,
    client_secret: string,
    redirect_uris: string[]
}

export interface ConsumerKeyAuthConfig extends ConsumerPlugin {
    key: string
}

export interface ConsumerBasicAuthConfig extends ConsumerPlugin {
    username: string,
    password: string
}

export interface ConsumerHmacAuthConfig extends ConsumerPlugin {
    username: string,
    secret: string
}

export interface KongConsumerPlugins {
    acls?: ConsumerAclConfig[],
    oauth2?: ConsumerOAuth2Config[],
    "key-auth"?: ConsumerKeyAuthConfig[],
    "basic-auth"?: ConsumerBasicAuthConfig[],
    "hmac-auth"?: ConsumerHmacAuthConfig[]
}

export interface ConsumerInfo {
    consumer: KongConsumer,
    plugins: KongConsumerPlugins,
    apiPlugins?: KongPlugin[]
}

export interface ApplicationData {
    subscriptions: WickedSubscription[],
    application: WickedApplication
}

export interface ApiDescription extends WickedApi {
    config?: KongApiConfig
}

export interface ApiDescriptionCollection {
    apis: ApiDescription[]
}

export interface KongApiConfigCollection {
    apis: KongApiConfig[]
}


export interface UpdateApiItem {
    portalApi: ApiDescription,
    kongApi: KongApiConfig
}

export interface AddApiItem {
    portalApi: ApiDescription
}

export interface DeleteApiItem {
    kongApi: KongApiConfig
}

export interface ApiTodos {
    addList: AddApiItem[],
    updateList: UpdateApiItem[],
    deleteList: DeleteApiItem[]
}

export interface UpdatePluginItem {
    portalApi: ApiDescription,
    portalPlugin: KongPlugin,
    kongApi: KongApiConfig,
    kongPlugin: KongPlugin
}

export interface AddPluginItem {
    portalApi: ApiDescription,
    portalPlugin: KongPlugin,
    kongApi: KongApiConfig
}

export interface DeletePluginItem {
    kongApi: KongApiConfig,
    kongPlugin: KongPlugin
}

export interface PluginTodos {
    addList: AddPluginItem[],
    updateList: UpdatePluginItem[],
    deleteList: DeletePluginItem[]
}

export interface AddConsumerItem {
    portalConsumer: ConsumerInfo
}

export interface UpdateConsumerItem {
    portalConsumer: ConsumerInfo,
    kongConsumer: ConsumerInfo
}

export interface DeleteConsumerItem {
    kongConsumer: ConsumerInfo
}

export interface ConsumerTodos {
    addList: AddConsumerItem[],
    updateList: UpdateConsumerItem[],
    deleteList: DeleteConsumerItem[]
}

export interface ConsumerApiPluginAddItem {
    portalConsumer: ConsumerInfo,
    portalApiPlugin: KongPlugin
}

export interface ConsumerApiPluginPatchItem {
    portalConsumer: ConsumerInfo,
    portalApiPlugin: KongPlugin,
    kongConsumer: ConsumerInfo,
    kongApiPlugin: KongPlugin
}

export interface ConsumerApiPluginDeleteItem {
    kongConsumer: ConsumerInfo,
    kongApiPlugin: KongPlugin
}

export interface ConsumerApiPluginTodos {
    addList: ConsumerApiPluginAddItem[],
    patchList: ConsumerApiPluginPatchItem[],
    deleteList: ConsumerApiPluginDeleteItem[]
}