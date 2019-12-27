CREATE TABLE wicked.audit_log (
    id character varying(128) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    data jsonb
);