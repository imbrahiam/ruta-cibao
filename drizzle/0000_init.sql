-- The whole schema, as of 2026-11-04: migrations 0000-0040 squashed into one.
-- Generated from a schema-only dump of a fully migrated database, so it keeps
-- everything Drizzle cannot express (PostGIS columns, functions, triggers,
-- check constraints). Extensions are created first by src/db/migrate.ts.
-- A database that already ran 0000-0040 skips this file: its journal entry
-- carries the same timestamp as 0040.
SET check_function_bodies = false;

CREATE TYPE public.business_claim_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE public.category_kind AS ENUM (
    'place',
    'business',
    'route',
    'traffic',
    'consultation'
);

CREATE TYPE public.consultation_status AS ENUM (
    'open',
    'in_review',
    'answered',
    'resolved',
    'rejected'
);

CREATE TYPE public.place_location_source AS ENUM (
    'map',
    'gps'
);

CREATE TYPE public.place_photo_status AS ENUM (
    'pending',
    'published',
    'rejected'
);

CREATE TYPE public.place_report_reason AS ENUM (
    'incorrect_information',
    'closed',
    'duplicate',
    'wrong_location',
    'other'
);

CREATE TYPE public.place_report_status AS ENUM (
    'pending',
    'resolved',
    'dismissed'
);

CREATE TYPE public.place_status AS ENUM (
    'draft',
    'pending',
    'published',
    'rejected',
    'archived'
);

CREATE TYPE public.place_verdict AS ENUM (
    'exists',
    'gone'
);

CREATE TYPE public.publication_status AS ENUM (
    'pending',
    'published',
    'hidden'
);

CREATE TYPE public.route_difficulty AS ENUM (
    'easy',
    'moderate',
    'hard'
);

CREATE TYPE public.route_status AS ENUM (
    'pending',
    'published',
    'rejected'
);

CREATE TYPE public.staff_role AS ENUM (
    'none',
    'moderator',
    'admin'
);

CREATE TYPE public.traffic_report_status AS ENUM (
    'active',
    'cleared',
    'expired',
    'removed'
);

CREATE TYPE public.traffic_severity AS ENUM (
    'blocking',
    'partial',
    'minor'
);

CREATE TYPE public.traffic_verdict AS ENUM (
    'still',
    'cleared'
);

CREATE TYPE public.weekly_report_status AS ENUM (
    'pending',
    'ready',
    'failed'
);

CREATE FUNCTION public.notify_realtime_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_notify('realtime_event', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TABLE public.account (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp without time zone,
    refresh_token_expires_at timestamp without time zone,
    scope text,
    password text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    issuer text NOT NULL
);

CREATE TABLE public.account_deletions (
    id uuid NOT NULL,
    user_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    inventory_ciphertext text,
    attempts integer DEFAULT 0 NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT account_deletions_inventory_check CHECK ((((status = 'pending'::text) AND (inventory_ciphertext IS NOT NULL)) OR ((status = 'completed'::text) AND (inventory_ciphertext IS NULL)))),
    CONSTRAINT account_deletions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text])))
);

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id text,
    action text NOT NULL,
    subject_type text NOT NULL,
    subject_id text,
    municipality_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.business_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    claimant_user_id text NOT NULL,
    evidence text NOT NULL,
    contact_phone text,
    whatsapp text,
    opening_hours text,
    status public.business_claim_status DEFAULT 'pending'::public.business_claim_status NOT NULL,
    reviewed_by_user_id text,
    review_note text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.categories (
    id text NOT NULL,
    kind public.category_kind NOT NULL,
    name text NOT NULL,
    icon text DEFAULT 'map-pin'::text NOT NULL,
    color text DEFAULT '#166534'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    severity public.traffic_severity
);

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_kind text NOT NULL,
    subject_id uuid NOT NULL,
    municipality_id text NOT NULL,
    author_user_id text NOT NULL,
    body text NOT NULL,
    status public.publication_status DEFAULT 'published'::public.publication_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_body_length_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 500))),
    CONSTRAINT comments_subject_kind_check CHECK ((subject_kind = ANY (ARRAY['consultation'::text, 'place'::text])))
);

CREATE TABLE public.consultation_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid NOT NULL,
    storage_key text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    alt text,
    "position" integer DEFAULT 0 NOT NULL,
    uploaded_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.consultation_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid NOT NULL,
    body text NOT NULL,
    author_user_id text,
    status_after public.consultation_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.consultation_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid NOT NULL,
    user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.consultations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    category_id text NOT NULL,
    municipality_id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    location public.geometry(Point,4326),
    status public.consultation_status DEFAULT 'open'::public.consultation_status NOT NULL,
    opened_by_user_id text,
    answered_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    publication_status public.publication_status DEFAULT 'pending'::public.publication_status NOT NULL
);

CREATE TABLE public.content_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_user_id text,
    subject_kind text NOT NULL,
    subject_ref text NOT NULL,
    author_user_id text,
    municipality_id text NOT NULL,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'open'::text NOT NULL,
    decision_reason text,
    reviewed_by_user_id text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_reports_details_check CHECK (((details IS NULL) OR (char_length(details) <= 500))),
    CONSTRAINT content_reports_reason_check CHECK ((reason = ANY (ARRAY['abuse'::text, 'personal_information'::text, 'unsafe'::text, 'other'::text]))),
    CONSTRAINT content_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text]))),
    CONSTRAINT content_reports_subject_kind_check CHECK ((subject_kind = ANY (ARRAY['place'::text, 'photo'::text, 'route'::text, 'traffic'::text, 'consultation'::text])))
);

CREATE TABLE public.eco_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category_id text NOT NULL,
    municipality_id text NOT NULL,
    path public.geometry(LineString,4326) NOT NULL,
    distance_meters integer NOT NULL,
    duration_minutes integer NOT NULL,
    difficulty public.route_difficulty NOT NULL,
    services text[] DEFAULT '{}'::text[] NOT NULL,
    status public.route_status DEFAULT 'pending'::public.route_status NOT NULL,
    submitted_by_user_id text,
    review_note text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.idempotency_keys (
    key text NOT NULL,
    user_id text,
    request_hash text NOT NULL,
    response_status integer,
    response_body jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE public.job_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.member_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    display_name text NOT NULL,
    municipality_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    staff_role public.staff_role DEFAULT 'none'::public.staff_role NOT NULL,
    staff_municipality_id text,
    residency_verified_at timestamp with time zone,
    residency_verified_by_user_id text,
    CONSTRAINT member_profiles_staff_scope_check CHECK ((((staff_role = 'moderator'::public.staff_role) AND (staff_municipality_id IS NOT NULL)) OR ((staff_role <> 'moderator'::public.staff_role) AND (staff_municipality_id IS NULL))))
);

CREATE TABLE public.municipalities (
    id text NOT NULL,
    name text NOT NULL,
    province_code text DEFAULT 'SR'::text NOT NULL,
    boundary public.geometry(MultiPolygon,4326),
    center public.geometry(Point,4326),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.native_push_devices (
    installation_id uuid NOT NULL,
    user_id text NOT NULL,
    platform text NOT NULL,
    token_ciphertext text NOT NULL,
    token_hash text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT native_push_devices_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))
);

CREATE TABLE public.native_push_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    token_hash text NOT NULL,
    provider_message_id text,
    status text NOT NULL,
    error_code text,
    check_after timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT native_push_tickets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ok'::text, 'error'::text])))
);

CREATE TABLE public.notification_preferences (
    user_id text NOT NULL,
    municipality_ids text[] DEFAULT '{}'::text[] NOT NULL,
    category_ids text[] DEFAULT '{}'::text[] NOT NULL,
    traffic_enabled boolean DEFAULT false NOT NULL,
    case_updates_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_preferences_municipalities_limit CHECK ((cardinality(municipality_ids) <= 3))
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    message_key text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    href text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dedupe_key text
);

CREATE TABLE public.offline_snapshots (
    version text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    storage_key text NOT NULL,
    sha256 text NOT NULL,
    size_bytes integer NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    revoked_at timestamp with time zone,
    revoked_reason text
);

CREATE TABLE public.passkey (
    id text NOT NULL,
    name text,
    public_key text NOT NULL,
    user_id text NOT NULL,
    credential_id text NOT NULL,
    counter integer NOT NULL,
    device_type text NOT NULL,
    backed_up boolean NOT NULL,
    transports text,
    created_at timestamp without time zone,
    aaguid text
);

CREATE TABLE public.passport_stamps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    place_blind_index text NOT NULL,
    place_id text NOT NULL,
    stamped_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.photo_uploads (
    storage_key text NOT NULL,
    user_id text NOT NULL,
    place_id uuid NOT NULL,
    size_bytes integer NOT NULL,
    content_type text NOT NULL,
    final_key text,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    request_id uuid NOT NULL,
    request_hash text NOT NULL,
    temporary_deleted_at timestamp with time zone
);

CREATE TABLE public.place_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    user_id text NOT NULL,
    verdict public.place_verdict NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.place_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    uploaded_by_user_id text,
    storage_key text NOT NULL,
    status public.place_photo_status DEFAULT 'pending'::public.place_photo_status NOT NULL,
    reviewed_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.place_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    reporter_user_id text,
    reason public.place_report_reason NOT NULL,
    details text,
    status public.place_report_status DEFAULT 'pending'::public.place_report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    category_id text NOT NULL,
    municipality_id text NOT NULL,
    location public.geometry(Point,4326) NOT NULL,
    address text,
    status public.place_status DEFAULT 'pending'::public.place_status NOT NULL,
    created_by_user_id text,
    reviewed_by_user_id text,
    review_note text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    location_source public.place_location_source DEFAULT 'map'::public.place_location_source NOT NULL,
    business_details jsonb,
    google_place_id text,
    google_place_checked_at timestamp with time zone
);

CREATE TABLE public.rate_limit_buckets (
    key text NOT NULL,
    scope text NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL
);

CREATE TABLE public.realtime_events (
    id bigint NOT NULL,
    channel text NOT NULL,
    municipality_id text,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    action text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    location public.geometry(Point,4326),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.realtime_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.realtime_events_id_seq OWNED BY public.realtime_events.id;

CREATE TABLE public.roads (
    id text NOT NULL,
    name text,
    kind text NOT NULL,
    path public.geometry(LineString,4326) NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rolling_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE public.saved_places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    place_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session (
    id text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL,
    impersonated_by text
);

CREATE TABLE public.staff_session_verifications (
    session_id text NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE public.traffic_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    user_id text NOT NULL,
    verdict public.traffic_verdict NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.traffic_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id text NOT NULL,
    municipality_id text NOT NULL,
    location public.geometry(Point,4326) NOT NULL,
    description text,
    reported_by_user_id text,
    status public.traffic_report_status DEFAULT 'active'::public.traffic_report_status NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    resolved_by_user_id text,
    resolved_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    path public.geometry(LineString,4326),
    description_moderation_status public.publication_status DEFAULT 'pending'::public.publication_status NOT NULL
);

CREATE TABLE public.two_factor (
    id text NOT NULL,
    secret text NOT NULL,
    backup_codes text NOT NULL,
    user_id text NOT NULL,
    verified boolean DEFAULT true,
    failed_verification_count integer DEFAULT 0,
    locked_until timestamp without time zone
);

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    role text,
    banned boolean DEFAULT false,
    ban_reason text,
    ban_expires timestamp without time zone,
    phone_number text,
    phone_number_verified boolean DEFAULT false,
    two_factor_enabled boolean DEFAULT false
);

CREATE TABLE public.user_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocking_user_id text NOT NULL,
    blocked_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_blocks_not_self CHECK ((blocking_user_id <> blocked_user_id))
);

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.weekly_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    municipality_id text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    status public.weekly_report_status DEFAULT 'pending'::public.weekly_report_status NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    pdf_storage_key text,
    failure_reason text,
    generated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.worker_heartbeats (
    id text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.realtime_events ALTER COLUMN id SET DEFAULT nextval('public.realtime_events_id_seq'::regclass);

ALTER TABLE ONLY public.account_deletions
    ADD CONSTRAINT account_deletions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.account_deletions
    ADD CONSTRAINT account_deletions_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.business_claims
    ADD CONSTRAINT business_claims_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consultation_photos
    ADD CONSTRAINT consultation_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consultation_responses
    ADD CONSTRAINT consultation_responses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consultation_votes
    ADD CONSTRAINT consultation_votes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.eco_routes
    ADD CONSTRAINT eco_routes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.job_outbox
    ADD CONSTRAINT job_outbox_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT "member_profiles_userId_unique" UNIQUE (user_id);

ALTER TABLE ONLY public.municipalities
    ADD CONSTRAINT municipalities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.native_push_devices
    ADD CONSTRAINT native_push_devices_pkey PRIMARY KEY (installation_id);

ALTER TABLE ONLY public.native_push_devices
    ADD CONSTRAINT native_push_devices_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.native_push_tickets
    ADD CONSTRAINT native_push_tickets_expo_ticket_id_key UNIQUE (provider_message_id);

ALTER TABLE ONLY public.native_push_tickets
    ADD CONSTRAINT native_push_tickets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_dedupeKey_unique" UNIQUE (dedupe_key);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.offline_snapshots
    ADD CONSTRAINT offline_snapshots_pkey PRIMARY KEY (version);

ALTER TABLE ONLY public.offline_snapshots
    ADD CONSTRAINT offline_snapshots_storage_key_key UNIQUE (storage_key);

ALTER TABLE ONLY public.passkey
    ADD CONSTRAINT passkey_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.passport_stamps
    ADD CONSTRAINT passport_stamps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.photo_uploads
    ADD CONSTRAINT photo_uploads_pkey PRIMARY KEY (storage_key);

ALTER TABLE ONLY public.place_confirmations
    ADD CONSTRAINT place_confirmations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.place_reports
    ADD CONSTRAINT place_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.realtime_events
    ADD CONSTRAINT realtime_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roads
    ADD CONSTRAINT roads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rolling_rate_limits
    ADD CONSTRAINT rolling_rate_limits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.saved_places
    ADD CONSTRAINT saved_places_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_unique UNIQUE (token);

ALTER TABLE ONLY public.staff_session_verifications
    ADD CONSTRAINT staff_session_verifications_pkey PRIMARY KEY (session_id);

ALTER TABLE ONLY public.traffic_confirmations
    ADD CONSTRAINT traffic_confirmations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.traffic_reports
    ADD CONSTRAINT traffic_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.two_factor
    ADD CONSTRAINT two_factor_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_phone_number_unique UNIQUE (phone_number);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.worker_heartbeats
    ADD CONSTRAINT worker_heartbeats_pkey PRIMARY KEY (id);

CREATE INDEX account_deletions_status_idx ON public.account_deletions USING btree (status);

CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON public.account USING btree (issuer, account_id);

CREATE INDEX "account_userId_idx" ON public.account USING btree (user_id);

CREATE INDEX audit_events_actor_idx ON public.audit_events USING btree (actor_user_id);

CREATE INDEX audit_events_created_idx ON public.audit_events USING btree (created_at);

CREATE INDEX audit_events_subject_idx ON public.audit_events USING btree (subject_type, subject_id);

CREATE INDEX business_claims_claimant_idx ON public.business_claims USING btree (claimant_user_id);

CREATE UNIQUE INDEX business_claims_open_idx ON public.business_claims USING btree (place_id, claimant_user_id) WHERE (status = 'pending'::public.business_claim_status);

CREATE UNIQUE INDEX business_claims_owner_idx ON public.business_claims USING btree (place_id) WHERE (status = 'approved'::public.business_claim_status);

CREATE INDEX business_claims_place_idx ON public.business_claims USING btree (place_id, status);

CREATE INDEX categories_kind_idx ON public.categories USING btree (kind, sort_order);

CREATE UNIQUE INDEX categories_kind_name_idx ON public.categories USING btree (kind, name);

CREATE INDEX comments_author_idx ON public.comments USING btree (author_user_id, created_at);

CREATE INDEX comments_subject_idx ON public.comments USING btree (subject_kind, subject_id, created_at);

CREATE INDEX consultation_photos_case_idx ON public.consultation_photos USING btree (consultation_id, "position");

CREATE UNIQUE INDEX consultation_photos_key_idx ON public.consultation_photos USING btree (storage_key);

CREATE INDEX consultation_responses_case_idx ON public.consultation_responses USING btree (consultation_id, created_at);

CREATE INDEX consultation_votes_case_idx ON public.consultation_votes USING btree (consultation_id);

CREATE UNIQUE INDEX consultation_votes_case_user_idx ON public.consultation_votes USING btree (consultation_id, user_id);

CREATE INDEX consultations_author_idx ON public.consultations USING btree (opened_by_user_id);

CREATE INDEX consultations_location_idx ON public.consultations USING gist (location);

CREATE INDEX consultations_municipality_idx ON public.consultations USING btree (municipality_id, status, created_at);

CREATE INDEX consultations_publication_idx ON public.consultations USING btree (publication_status, municipality_id);

CREATE UNIQUE INDEX consultations_slug_idx ON public.consultations USING btree (slug);

CREATE UNIQUE INDEX content_reports_open_idx ON public.content_reports USING btree (reporter_user_id, subject_kind, subject_ref) WHERE (status = 'open'::text);

CREATE INDEX content_reports_queue_idx ON public.content_reports USING btree (status, municipality_id, created_at);

CREATE INDEX content_reports_subject_idx ON public.content_reports USING btree (subject_kind, subject_ref);

CREATE INDEX eco_routes_browse_idx ON public.eco_routes USING btree (status, municipality_id);

CREATE INDEX eco_routes_path_idx ON public.eco_routes USING gist (path);

CREATE INDEX idempotency_keys_expires_idx ON public.idempotency_keys USING btree (expires_at);

CREATE INDEX job_outbox_pending_idx ON public.job_outbox USING btree (processed_at, created_at);

CREATE INDEX member_profiles_municipality_idx ON public.member_profiles USING btree (municipality_id);

CREATE INDEX member_profiles_staff_idx ON public.member_profiles USING btree (staff_role);

CREATE INDEX municipalities_boundary_idx ON public.municipalities USING gist (boundary);

CREATE INDEX native_push_devices_user_idx ON public.native_push_devices USING btree (user_id, enabled);

CREATE UNIQUE INDEX native_push_tickets_delivery_idx ON public.native_push_tickets USING btree (notification_id, installation_id, token_hash);

CREATE INDEX native_push_tickets_receipt_idx ON public.native_push_tickets USING btree (status, check_after);

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, read_at);

CREATE INDEX offline_snapshots_current_idx ON public.offline_snapshots USING btree (is_current, generated_at);

CREATE INDEX "passkey_credentialID_idx" ON public.passkey USING btree (credential_id);

CREATE INDEX "passkey_userId_idx" ON public.passkey USING btree (user_id);

CREATE INDEX passport_stamps_user_date_idx ON public.passport_stamps USING btree (user_id, stamped_at, id);

CREATE UNIQUE INDEX passport_stamps_user_place_idx ON public.passport_stamps USING btree (user_id, place_blind_index);

CREATE INDEX photo_uploads_expiry_idx ON public.photo_uploads USING btree (expires_at);

CREATE INDEX photo_uploads_user_idx ON public.photo_uploads USING btree (user_id, expires_at);

CREATE UNIQUE INDEX photo_uploads_user_request_idx ON public.photo_uploads USING btree (user_id, request_id);

CREATE INDEX place_confirmations_place_idx ON public.place_confirmations USING btree (place_id, verdict);

CREATE UNIQUE INDEX place_confirmations_place_user_idx ON public.place_confirmations USING btree (place_id, user_id);

CREATE UNIQUE INDEX place_photos_key_idx ON public.place_photos USING btree (storage_key);

CREATE INDEX place_photos_place_idx ON public.place_photos USING btree (place_id, status);

CREATE INDEX place_reports_place_status_idx ON public.place_reports USING btree (place_id, status);

CREATE INDEX place_reports_reporter_idx ON public.place_reports USING btree (reporter_user_id);

CREATE INDEX places_category_idx ON public.places USING btree (category_id);

CREATE INDEX places_location_idx ON public.places USING gist (location);

CREATE UNIQUE INDEX places_slug_idx ON public.places USING btree (slug);

CREATE INDEX places_status_idx ON public.places USING btree (status, municipality_id);

CREATE INDEX rate_limit_buckets_reset_idx ON public.rate_limit_buckets USING btree (reset_at);

CREATE INDEX realtime_events_channel_idx ON public.realtime_events USING btree (channel, id);

CREATE INDEX realtime_events_created_idx ON public.realtime_events USING btree (created_at);

CREATE INDEX realtime_events_location_idx ON public.realtime_events USING gist (location);

CREATE INDEX roads_path_idx ON public.roads USING gist (path);

CREATE INDEX rolling_rate_limits_expiry_idx ON public.rolling_rate_limits USING btree (expires_at);

CREATE INDEX rolling_rate_limits_key_time_idx ON public.rolling_rate_limits USING btree (key, created_at);

CREATE INDEX saved_places_user_idx ON public.saved_places USING btree (user_id, created_at);

CREATE UNIQUE INDEX saved_places_user_place_idx ON public.saved_places USING btree (user_id, place_id);

CREATE INDEX "session_userId_idx" ON public.session USING btree (user_id);

CREATE INDEX staff_session_verifications_expires_idx ON public.staff_session_verifications USING btree (expires_at);

CREATE INDEX traffic_confirmations_report_idx ON public.traffic_confirmations USING btree (report_id, verdict);

CREATE UNIQUE INDEX traffic_confirmations_report_user_idx ON public.traffic_confirmations USING btree (report_id, user_id);

CREATE INDEX traffic_reports_active_idx ON public.traffic_reports USING btree (status, expires_at);

CREATE INDEX traffic_reports_location_idx ON public.traffic_reports USING gist (location);

CREATE INDEX traffic_reports_municipality_idx ON public.traffic_reports USING btree (municipality_id, status);

CREATE INDEX traffic_reports_reporter_idx ON public.traffic_reports USING btree (reported_by_user_id);

CREATE INDEX "twoFactor_secret_idx" ON public.two_factor USING btree (secret);

CREATE INDEX "twoFactor_userId_idx" ON public.two_factor USING btree (user_id);

CREATE INDEX user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_user_id);

CREATE UNIQUE INDEX user_blocks_pair_idx ON public.user_blocks USING btree (blocking_user_id, blocked_user_id);

CREATE INDEX verification_identifier_idx ON public.verification USING btree (identifier);

CREATE UNIQUE INDEX weekly_reports_period_idx ON public.weekly_reports USING btree (municipality_id, period_start);

CREATE INDEX weekly_reports_recent_idx ON public.weekly_reports USING btree (municipality_id, period_start DESC NULLS LAST);

CREATE TRIGGER realtime_events_notify AFTER INSERT ON public.realtime_events FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_event();

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_user_id_user_id_fk FOREIGN KEY (actor_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.business_claims
    ADD CONSTRAINT business_claims_claimant_user_id_user_id_fk FOREIGN KEY (claimant_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.business_claims
    ADD CONSTRAINT business_claims_place_id_places_id_fk FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.business_claims
    ADD CONSTRAINT business_claims_reviewed_by_user_id_user_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_user_id_user_id_fk FOREIGN KEY (author_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id);

ALTER TABLE ONLY public.consultation_photos
    ADD CONSTRAINT consultation_photos_consultation_id_consultations_id_fk FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.consultation_photos
    ADD CONSTRAINT consultation_photos_uploaded_by_user_id_user_id_fk FOREIGN KEY (uploaded_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.consultation_responses
    ADD CONSTRAINT consultation_responses_author_user_id_user_id_fk FOREIGN KEY (author_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.consultation_responses
    ADD CONSTRAINT consultation_responses_consultation_id_consultations_id_fk FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.consultation_votes
    ADD CONSTRAINT consultation_votes_consultation_id_consultations_id_fk FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.consultation_votes
    ADD CONSTRAINT consultation_votes_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id);

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_opened_by_user_id_user_id_fk FOREIGN KEY (opened_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id);

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.eco_routes
    ADD CONSTRAINT eco_routes_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);

ALTER TABLE ONLY public.eco_routes
    ADD CONSTRAINT eco_routes_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id);

ALTER TABLE ONLY public.eco_routes
    ADD CONSTRAINT eco_routes_submitted_by_user_id_user_id_fk FOREIGN KEY (submitted_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_residency_verified_by_user_id_user_id_fk FOREIGN KEY (residency_verified_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_staff_municipality_id_municipalities_id_fk FOREIGN KEY (staff_municipality_id) REFERENCES public.municipalities(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.native_push_devices
    ADD CONSTRAINT native_push_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.native_push_tickets
    ADD CONSTRAINT native_push_tickets_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.native_push_devices(installation_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.native_push_tickets
    ADD CONSTRAINT native_push_tickets_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.passkey
    ADD CONSTRAINT passkey_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.passport_stamps
    ADD CONSTRAINT passport_stamps_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.photo_uploads
    ADD CONSTRAINT photo_uploads_place_id_places_id_fk FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.photo_uploads
    ADD CONSTRAINT photo_uploads_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.place_confirmations
    ADD CONSTRAINT place_confirmations_place_id_places_id_fk FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.place_confirmations
    ADD CONSTRAINT place_confirmations_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_place_id_places_id_fk FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_reviewed_by_user_id_user_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_uploaded_by_user_id_user_id_fk FOREIGN KEY (uploaded_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.place_reports
    ADD CONSTRAINT place_reports_place_id_places_id_fk FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.place_reports
    ADD CONSTRAINT place_reports_reporter_user_id_user_id_fk FOREIGN KEY (reporter_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_created_by_user_id_user_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id);

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_reviewed_by_user_id_user_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.realtime_events
    ADD CONSTRAINT realtime_events_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.saved_places
    ADD CONSTRAINT saved_places_place_id_places_id_fk FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.saved_places
    ADD CONSTRAINT saved_places_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.staff_session_verifications
    ADD CONSTRAINT staff_session_verifications_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.traffic_confirmations
    ADD CONSTRAINT traffic_confirmations_report_id_traffic_reports_id_fk FOREIGN KEY (report_id) REFERENCES public.traffic_reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.traffic_confirmations
    ADD CONSTRAINT traffic_confirmations_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.traffic_reports
    ADD CONSTRAINT traffic_reports_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);

ALTER TABLE ONLY public.traffic_reports
    ADD CONSTRAINT traffic_reports_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id);

ALTER TABLE ONLY public.traffic_reports
    ADD CONSTRAINT traffic_reports_reported_by_user_id_user_id_fk FOREIGN KEY (reported_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.traffic_reports
    ADD CONSTRAINT traffic_reports_resolved_by_user_id_user_id_fk FOREIGN KEY (resolved_by_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.two_factor
    ADD CONSTRAINT two_factor_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocking_user_id_fkey FOREIGN KEY (blocking_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_municipality_id_municipalities_id_fk FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON DELETE CASCADE;
