CREATE TYPE "public"."business_claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('open', 'in_review', 'answered', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."traffic_report_status" AS ENUM('active', 'cleared', 'expired', 'removed');--> statement-breakpoint
CREATE TYPE "public"."traffic_verdict" AS ENUM('still', 'cleared');--> statement-breakpoint
CREATE TABLE "business_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"claimant_user_id" text NOT NULL,
	"evidence" text NOT NULL,
	"contact_phone" text,
	"whatsapp" text,
	"opening_hours" text,
	"status" "business_claim_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"review_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_user_id" text,
	"status_after" "consultation_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"location" geometry(Point,4326),
	"status" "consultation_status" DEFAULT 'open' NOT NULL,
	"opened_by_user_id" text,
	"answered_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "weekly_report_status" DEFAULT 'pending' NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pdf_storage_key" text,
	"failure_reason" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"verdict" "traffic_verdict" NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	"location" geometry(Point,4326) NOT NULL,
	"description" text,
	"reported_by_user_id" text,
	"status" "traffic_report_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_claims" ADD CONSTRAINT "business_claims_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_claims" ADD CONSTRAINT "business_claims_claimant_user_id_user_id_fk" FOREIGN KEY ("claimant_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_claims" ADD CONSTRAINT "business_claims_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_responses" ADD CONSTRAINT "consultation_responses_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_responses" ADD CONSTRAINT "consultation_responses_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_votes" ADD CONSTRAINT "consultation_votes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_votes" ADD CONSTRAINT "consultation_votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_confirmations" ADD CONSTRAINT "traffic_confirmations_report_id_traffic_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."traffic_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_confirmations" ADD CONSTRAINT "traffic_confirmations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_reports" ADD CONSTRAINT "traffic_reports_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_reports" ADD CONSTRAINT "traffic_reports_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_reports" ADD CONSTRAINT "traffic_reports_reported_by_user_id_user_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_reports" ADD CONSTRAINT "traffic_reports_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_claims_place_idx" ON "business_claims" USING btree ("place_id","status");--> statement-breakpoint
CREATE INDEX "business_claims_claimant_idx" ON "business_claims" USING btree ("claimant_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_claims_owner_idx" ON "business_claims" USING btree ("place_id") WHERE status = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "business_claims_open_idx" ON "business_claims" USING btree ("place_id","claimant_user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "consultation_responses_case_idx" ON "consultation_responses" USING btree ("consultation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_votes_case_user_idx" ON "consultation_votes" USING btree ("consultation_id","user_id");--> statement-breakpoint
CREATE INDEX "consultation_votes_case_idx" ON "consultation_votes" USING btree ("consultation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_slug_idx" ON "consultations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "consultations_municipality_idx" ON "consultations" USING btree ("municipality_id","status","created_at");--> statement-breakpoint
CREATE INDEX "consultations_author_idx" ON "consultations" USING btree ("opened_by_user_id");--> statement-breakpoint
CREATE INDEX "consultations_location_idx" ON "consultations" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reports_period_idx" ON "weekly_reports" USING btree ("municipality_id","period_start");--> statement-breakpoint
CREATE INDEX "weekly_reports_recent_idx" ON "weekly_reports" USING btree ("municipality_id","period_start" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_confirmations_report_user_idx" ON "traffic_confirmations" USING btree ("report_id","user_id");--> statement-breakpoint
CREATE INDEX "traffic_confirmations_report_idx" ON "traffic_confirmations" USING btree ("report_id","verdict");--> statement-breakpoint
CREATE INDEX "traffic_reports_location_idx" ON "traffic_reports" USING gist ("location");--> statement-breakpoint
CREATE INDEX "traffic_reports_active_idx" ON "traffic_reports" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "traffic_reports_municipality_idx" ON "traffic_reports" USING btree ("municipality_id","status");--> statement-breakpoint
CREATE INDEX "traffic_reports_reporter_idx" ON "traffic_reports" USING btree ("reported_by_user_id");