CREATE TABLE wicked.access_tokens (
    id character varying(128) NOT NULL UNIQUE,
    access_token character varying(64) NOT NULL,
    refresh_token character varying(64),
    authenticated_userid character varying(1024),
    users_id character varying(64),
    expires bigint NOT NULL,
    expires_refresh bigint,
    data jsonb
);

ALTER TABLE ONLY wicked.access_tokens
    ADD CONSTRAINT access_tokens_pkey PRIMARY KEY (access_token);

-- Access indexes for quick lookup via refresh token, authenticated user id and internal userid
CREATE UNIQUE INDEX refresh_token_idx ON wicked.access_tokens USING btree (refresh_token);
CREATE INDEX authenticated_userid_idx ON wicked.access_tokens USING btree (authenticated_userid);
CREATE INDEX users_id_idx ON wicked.access_tokens USING btree (users_id);
-- For efficient cleanup, use indexes on the expires values as well
CREATE INDEX expires_idx on wicked.access_tokens USING btree (expires);
CREATE INDEX expires_refresh_idx on wicked.access_tokens USING btree (expires_refresh);
