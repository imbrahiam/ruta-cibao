CREATE TABLE "invitations" (
	"invitee_user_id" text PRIMARY KEY NOT NULL,
	"inviter_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_not_self_check" CHECK ("invitations"."invitee_user_id" <> "invitations"."inviter_user_id")
);
--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "invite_code" text DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8)) NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitee_user_id_user_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_inviter_idx" ON "invitations" USING btree ("inviter_user_id");--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_inviteCode_unique" UNIQUE("invite_code");