--
-- PostgreSQL database dump
--

\restrict n7l336nRloQttYpPMirxefyzPGOB6mUIQlrmGaBkFKDUhKiJcZloicDoesWOiys

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2025-12-12 22:37:38

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE nails_by_brooke;
--
-- TOC entry 5057 (class 1262 OID 16387)
-- Name: nails_by_brooke; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE nails_by_brooke WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_United States.1252';


ALTER DATABASE nails_by_brooke OWNER TO postgres;

\unrestrict n7l336nRloQttYpPMirxefyzPGOB6mUIQlrmGaBkFKDUhKiJcZloicDoesWOiys
\connect nails_by_brooke
\restrict n7l336nRloQttYpPMirxefyzPGOB6mUIQlrmGaBkFKDUhKiJcZloicDoesWOiys

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 5059 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 225 (class 1255 OID 16460)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 16427)
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    client_id integer NOT NULL,
    appointment_date date NOT NULL,
    service character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    tip numeric(10,2) DEFAULT 0,
    paid boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16426)
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.appointments_id_seq OWNER TO postgres;

--
-- TOC entry 5062 (class 0 OID 0)
-- Dependencies: 223
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- TOC entry 222 (class 1259 OID 16407)
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16406)
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO postgres;

--
-- TOC entry 5065 (class 0 OID 0)
-- Dependencies: 221
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5068 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4875 (class 2604 OID 16430)
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- TOC entry 4872 (class 2604 OID 16410)
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- TOC entry 4869 (class 2604 OID 16393)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5051 (class 0 OID 16427)
-- Dependencies: 224
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointments (id, user_id, client_id, appointment_date, service, price, tip, paid, notes, created_at, updated_at) FROM stdin;
1	1	1	2025-12-10	Full Set	50.00	10.00	t	\N	2025-12-09 00:19:23.603105	2025-12-09 00:19:23.603105
3	1	2	2025-11-19	Fill	25.00	13.00	t	\N	2025-12-09 00:21:40.937947	2025-12-09 00:21:59.344913
2	1	1	2026-01-15	Full	100.00	20.00	t	\N	2025-12-09 00:20:03.293731	2025-12-09 00:24:02.062475
4	1	1	2025-12-10	Fill	40.00	20.00	t	\N	2025-12-09 08:14:06.304634	2025-12-09 12:00:17.135412
\.


--
-- TOC entry 5049 (class 0 OID 16407)
-- Dependencies: 222
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, user_id, name, phone, email, notes, created_at, updated_at) FROM stdin;
1	1	Jeanice	1112223344	j@s.com	\N	2025-12-09 00:13:19.034068	2025-12-09 00:13:19.034068
2	1	Julie	1122233456	julie@gmail.com	\N	2025-12-09 00:21:04.45789	2025-12-09 00:21:04.45789
\.


--
-- TOC entry 5047 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, name, created_at, updated_at) FROM stdin;
1	brooke@nailsbybrooke.com	$2a$10$kmdft4xDCR2ETkDopa439uVj4AEyUet3i9KOemfjkcgATQ0CoGO5.	Brooke	2025-12-08 22:32:48.601875	2025-12-08 22:32:48.601875
\.


--
-- TOC entry 5070 (class 0 OID 0)
-- Dependencies: 223
-- Name: appointments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.appointments_id_seq', 4, true);


--
-- TOC entry 5071 (class 0 OID 0)
-- Dependencies: 221
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_id_seq', 2, true);


--
-- TOC entry 5072 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- TOC entry 4888 (class 2606 OID 16444)
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 4885 (class 2606 OID 16420)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- TOC entry 4881 (class 2606 OID 16405)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4883 (class 2606 OID 16403)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4889 (class 1259 OID 16457)
-- Name: idx_appointments_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_client_id ON public.appointments USING btree (client_id);


--
-- TOC entry 4890 (class 1259 OID 16458)
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- TOC entry 4891 (class 1259 OID 16459)
-- Name: idx_appointments_paid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_paid ON public.appointments USING btree (paid);


--
-- TOC entry 4892 (class 1259 OID 16456)
-- Name: idx_appointments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_user_id ON public.appointments USING btree (user_id);


--
-- TOC entry 4886 (class 1259 OID 16455)
-- Name: idx_clients_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);


--
-- TOC entry 4898 (class 2620 OID 16463)
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4897 (class 2620 OID 16462)
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4896 (class 2620 OID 16461)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4894 (class 2606 OID 16450)
-- Name: appointments appointments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- TOC entry 4895 (class 2606 OID 16445)
-- Name: appointments appointments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4893 (class 2606 OID 16421)
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5058 (class 0 OID 0)
-- Dependencies: 5057
-- Name: DATABASE nails_by_brooke; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON DATABASE nails_by_brooke TO brooke_app;


--
-- TOC entry 5060 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO brooke_app;


--
-- TOC entry 5061 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE appointments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.appointments TO brooke_app;


--
-- TOC entry 5063 (class 0 OID 0)
-- Dependencies: 223
-- Name: SEQUENCE appointments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.appointments_id_seq TO brooke_app;


--
-- TOC entry 5064 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO brooke_app;


--
-- TOC entry 5066 (class 0 OID 0)
-- Dependencies: 221
-- Name: SEQUENCE clients_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.clients_id_seq TO brooke_app;


--
-- TOC entry 5067 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO brooke_app;


--
-- TOC entry 5069 (class 0 OID 0)
-- Dependencies: 219
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO brooke_app;


--
-- TOC entry 2064 (class 826 OID 16465)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO brooke_app;


--
-- TOC entry 2063 (class 826 OID 16464)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO brooke_app;


-- Completed on 2025-12-12 22:37:38

--
-- PostgreSQL database dump complete
--

\unrestrict n7l336nRloQttYpPMirxefyzPGOB6mUIQlrmGaBkFKDUhKiJcZloicDoesWOiys

