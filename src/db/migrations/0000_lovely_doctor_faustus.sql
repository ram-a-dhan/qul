CREATE TABLE "chapters" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"verse_count" smallint NOT NULL,
	"avg_duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "fingerprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"verse_id" integer NOT NULL,
	"reciter_id" integer NOT NULL,
	"hash" text NOT NULL,
	"offset_ms" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reciters" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_display" text NOT NULL,
	"recitation_style" text NOT NULL,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "reciters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"verse_id" integer NOT NULL,
	"lang" text NOT NULL,
	"translator" text NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "translations_unique" UNIQUE("verse_id","lang")
);
--> statement-breakpoint
CREATE TABLE "verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" smallint NOT NULL,
	"verse_number" smallint NOT NULL,
	"reciter_id" integer NOT NULL,
	"duration_ms" integer,
	"text_ar" text NOT NULL,
	CONSTRAINT "verses_unique" UNIQUE("chapter_id","verse_number","reciter_id")
);
--> statement-breakpoint
ALTER TABLE "fingerprints" ADD CONSTRAINT "fingerprints_verse_id_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."verses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fingerprints" ADD CONSTRAINT "fingerprints_reciter_id_reciters_id_fk" FOREIGN KEY ("reciter_id") REFERENCES "public"."reciters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_verse_id_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."verses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verses" ADD CONSTRAINT "verses_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verses" ADD CONSTRAINT "verses_reciter_id_reciters_id_fk" FOREIGN KEY ("reciter_id") REFERENCES "public"."reciters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fingerprints_hash_idx" ON "fingerprints" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "fingerprints_reciter_hash_idx" ON "fingerprints" USING btree ("reciter_id","hash");