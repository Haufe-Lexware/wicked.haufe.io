--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.8
-- Dumped by pg_dump version 10.3

-- Started on 2018-04-30 14:45:37 CEST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 8 (class 2615 OID 16715)
-- Name: wicked; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA wicked;

--
-- TOC entry 197 (class 1255 OID 16858)
-- Name: webhooknotify(); Type: FUNCTION; Schema: wicked; Owner: postgres
--

CREATE FUNCTION wicked.webhook_notify() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_notify('webhook_insert', row_to_json(NEW)::text);
  RETURN new;
END;
$$;


SET default_tablespace = '';

SET default_with_oids = false;

--
-- TOC entry 186 (class 1259 OID 16716)
-- Name: applications; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.applications (
    id character varying(128) NOT NULL,
    data jsonb
);


--
-- TOC entry 187 (class 1259 OID 16722)
-- Name: approvals; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.approvals (
    id character varying(128) NOT NULL,
    subscriptions_id character varying(128) NOT NULL,
    data jsonb
);


--
-- TOC entry 188 (class 1259 OID 16728)
-- Name: grants; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.grants (
    id character varying(128) NOT NULL,
    users_id character varying(128) NOT NULL,
    api_id character varying(128) NOT NULL,
    application_id character varying(128) NOT NULL,
    data jsonb
);


--
-- TOC entry 189 (class 1259 OID 16734)
-- Name: meta; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.meta (
    id bigint NOT NULL,
    data jsonb
);


--
-- TOC entry 190 (class 1259 OID 16740)
-- Name: owners; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.owners (
    id character varying(128) NOT NULL,
    users_id character varying(128) NOT NULL,
    applications_id character varying(128) NOT NULL,
    data jsonb
);


--
-- TOC entry 191 (class 1259 OID 16746)
-- Name: registrations; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.registrations (
    id character varying(128) NOT NULL,
    pool_id character varying(128) NOT NULL,
    users_id character varying(128) NOT NULL,
    namespace character varying(128),
    name character varying(256),
    data jsonb
);


--
-- TOC entry 192 (class 1259 OID 16752)
-- Name: subscriptions; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.subscriptions (
    id character varying(128) NOT NULL,
    applications_id character varying(128) NOT NULL,
    plan_id character varying(128) NOT NULL,
    api_id character varying(128) NOT NULL,
    client_id character varying(256),
    data jsonb
);


--
-- TOC entry 193 (class 1259 OID 16758)
-- Name: users; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.users (
    id character varying(64) NOT NULL,
    email character varying(256) NOT NULL,
    custom_id character varying(256),
    data jsonb NOT NULL
);


--
-- TOC entry 194 (class 1259 OID 16764)
-- Name: verifications; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.verifications (
    id character varying(128) NOT NULL,
    users_id character varying(128) NOT NULL,
    data jsonb
);


--
-- TOC entry 195 (class 1259 OID 16770)
-- Name: webhook_events; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.webhook_events (
    id character varying(128) NOT NULL,
    webhook_listeners_id character varying(128),
    data jsonb
);


--
-- TOC entry 196 (class 1259 OID 16776)
-- Name: webhook_listeners; Type: TABLE; Schema: wicked; Owner: postgres
--

CREATE TABLE wicked.webhook_listeners (
    id character varying(128) NOT NULL,
    data jsonb
);


--
-- TOC entry 2057 (class 2606 OID 16783)
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- TOC entry 2059 (class 2606 OID 16785)
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- TOC entry 2061 (class 2606 OID 16787)
-- Name: grants grants_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.grants
    ADD CONSTRAINT grants_pkey PRIMARY KEY (id);


--
-- TOC entry 2066 (class 2606 OID 16789)
-- Name: meta meta_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.meta
    ADD CONSTRAINT meta_pkey PRIMARY KEY (id);


--
-- TOC entry 2070 (class 2606 OID 16791)
-- Name: owners owners_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.owners
    ADD CONSTRAINT owners_pkey PRIMARY KEY (id);


--
-- TOC entry 2073 (class 2606 OID 16793)
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- TOC entry 2078 (class 2606 OID 16795)
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 2083 (class 2606 OID 16797)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 2086 (class 2606 OID 16799)
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 2088 (class 2606 OID 16801)
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- TOC entry 2090 (class 2606 OID 16803)
-- Name: webhook_listeners webhook_listeners_pkey; Type: CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.webhook_listeners
    ADD CONSTRAINT webhook_listeners_pkey PRIMARY KEY (id);


--
-- TOC entry 2067 (class 1259 OID 16804)
-- Name: fki_applications_fkey; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX fki_applications_fkey ON wicked.owners USING btree (applications_id);


--
-- TOC entry 2084 (class 1259 OID 16805)
-- Name: fki_users_fkey; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX fki_users_fkey ON wicked.verifications USING btree (users_id);


--
-- TOC entry 2068 (class 1259 OID 16806)
-- Name: fki_users_id; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX fki_users_id ON wicked.owners USING btree (users_id);


--
-- TOC entry 2062 (class 1259 OID 16807)
-- Name: grants_user_api_application_id_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX grants_user_api_application_id_idx ON wicked.grants USING btree (users_id, api_id, application_id);


--
-- TOC entry 2064 (class 1259 OID 16809)
-- Name: grants_users_id_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX grants_users_id_idx ON wicked.grants USING btree (users_id);


--
-- TOC entry 2071 (class 1259 OID 16810)
-- Name: registrations_name_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX registrations_name_idx ON wicked.registrations USING btree (name);


--
-- TOC entry 2074 (class 1259 OID 16811)
-- Name: registrations_users_pool_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE UNIQUE INDEX registrations_users_pool_idx ON wicked.registrations USING btree (users_id, pool_id, namespace);


--
-- TOC entry 2075 (class 1259 OID 16812)
-- Name: subscriptions_applications_id_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX subscriptions_applications_id_idx ON wicked.subscriptions USING btree (applications_id);


--
-- TOC entry 2076 (class 1259 OID 16813)
-- Name: subscriptions_client_id_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX subscriptions_client_id_idx ON wicked.subscriptions USING btree (client_id);


--
-- TOC entry 2079 (class 1259 OID 16814)
-- Name: users_custom_id_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE UNIQUE INDEX users_custom_id_idx ON wicked.users USING btree (custom_id);


--
-- TOC entry 2080 (class 1259 OID 16815)
-- Name: users_email_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE UNIQUE INDEX users_email_idx ON wicked.users USING btree (email);


--
-- TOC entry 2081 (class 1259 OID 16816)
-- Name: users_name_idx; Type: INDEX; Schema: wicked; Owner: postgres
--

CREATE INDEX users_name_idx ON wicked.users USING btree (custom_id);


--
-- TOC entry 2099 (class 2620 OID 16859)
-- Name: webhook_events webhookinsertionevent; Type: TRIGGER; Schema: wicked; Owner: postgres
--

CREATE TRIGGER webhookinsertionevent AFTER INSERT ON wicked.webhook_events FOR EACH ROW EXECUTE PROCEDURE wicked.webhook_notify();


--
-- TOC entry 2093 (class 2606 OID 16817)
-- Name: owners applications_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.owners
    ADD CONSTRAINT applications_fkey FOREIGN KEY (applications_id) REFERENCES wicked.applications(id) ON DELETE CASCADE;


--
-- TOC entry 2096 (class 2606 OID 16822)
-- Name: subscriptions subscriptions_applications_id_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.subscriptions
    ADD CONSTRAINT subscriptions_applications_id_fkey FOREIGN KEY (applications_id) REFERENCES wicked.applications(id) ON DELETE CASCADE;


--
-- TOC entry 2091 (class 2606 OID 16827)
-- Name: approvals subscriptions_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.approvals
    ADD CONSTRAINT subscriptions_fkey FOREIGN KEY (subscriptions_id) REFERENCES wicked.subscriptions(id) ON DELETE CASCADE;


--
-- TOC entry 2094 (class 2606 OID 16832)
-- Name: owners users_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.owners
    ADD CONSTRAINT users_fkey FOREIGN KEY (users_id) REFERENCES wicked.users(id) ON DELETE CASCADE;


--
-- TOC entry 2097 (class 2606 OID 16837)
-- Name: verifications users_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.verifications
    ADD CONSTRAINT users_fkey FOREIGN KEY (users_id) REFERENCES wicked.users(id) ON DELETE CASCADE;


--
-- TOC entry 2095 (class 2606 OID 16842)
-- Name: registrations users_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.registrations
    ADD CONSTRAINT users_fkey FOREIGN KEY (users_id) REFERENCES wicked.users(id) ON DELETE CASCADE;


--
-- TOC entry 2092 (class 2606 OID 16847)
-- Name: grants users_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.grants
    ADD CONSTRAINT users_fkey FOREIGN KEY (users_id) REFERENCES wicked.users(id) ON DELETE CASCADE;


--
-- TOC entry 2098 (class 2606 OID 16852)
-- Name: webhook_events webhook_listeners_fkey; Type: FK CONSTRAINT; Schema: wicked; Owner: postgres
--

ALTER TABLE ONLY wicked.webhook_events
    ADD CONSTRAINT webhook_listeners_fkey FOREIGN KEY (webhook_listeners_id) REFERENCES wicked.webhook_listeners(id) ON DELETE CASCADE;

-- Completed on 2018-04-30 14:45:37 CEST

--
-- PostgreSQL database dump complete
--

