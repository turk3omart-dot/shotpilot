CREATE TABLE "call_sheet_acks" (
	"call_sheet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_sheet_acks_call_sheet_id_user_id_pk" PRIMARY KEY("call_sheet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "call_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"shooting_day_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"share_token_hash" text,
	"share_expires_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"shooting_day_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shooting_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"breakdown_id" uuid,
	"day_number" integer NOT NULL,
	"shoot_date" date NOT NULL,
	"general_call" text DEFAULT '07:00' NOT NULL,
	"wrap_target" text DEFAULT '17:00' NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_sheet_acks" ADD CONSTRAINT "call_sheet_acks_call_sheet_id_call_sheets_id_fk" FOREIGN KEY ("call_sheet_id") REFERENCES "public"."call_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sheet_acks" ADD CONSTRAINT "call_sheet_acks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sheets" ADD CONSTRAINT "call_sheets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sheets" ADD CONSTRAINT "call_sheets_shooting_day_id_shooting_days_id_fk" FOREIGN KEY ("shooting_day_id") REFERENCES "public"."shooting_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sheets" ADD CONSTRAINT "call_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_shooting_day_id_shooting_days_id_fk" FOREIGN KEY ("shooting_day_id") REFERENCES "public"."shooting_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shooting_days" ADD CONSTRAINT "shooting_days_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shooting_days" ADD CONSTRAINT "shooting_days_breakdown_id_breakdowns_id_fk" FOREIGN KEY ("breakdown_id") REFERENCES "public"."breakdowns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_sheets_day_rev_idx" ON "call_sheets" USING btree ("shooting_day_id","revision");--> statement-breakpoint
CREATE INDEX "call_sheets_share_idx" ON "call_sheets" USING btree ("share_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_items_scene_idx" ON "schedule_items" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "schedule_items_day_idx" ON "schedule_items" USING btree ("shooting_day_id","sort_order");--> statement-breakpoint
CREATE INDEX "shooting_days_project_idx" ON "shooting_days" USING btree ("project_id","shoot_date");