-- Create new table namespace for registration pools

CREATE TABLE wicked.namespaces (
    id character varying(128) NOT NULL,
    pool_id character varying(128) NOT NULL,
    namespace character varying(128) NOT NULL,
    description character varying(255) NOT NULL,
    data jsonb
);

ALTER TABLE ONLY wicked.namespaces
    ADD CONSTRAINT namespaces_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX namespaces_pool_namespace_idx ON wicked.namespaces USING btree (pool_id, namespace);

CREATE INDEX namespaces_pool_description_idx ON wicked.namespaces USING btree (pool_id, description);
