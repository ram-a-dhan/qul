CREATE TABLE "chapters" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"verse_count" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fingerprints" (
	"verse_id" integer NOT NULL,
	"reciter_id" integer NOT NULL,
	"hash" integer NOT NULL,
	"offset_ms" integer NOT NULL,
	CONSTRAINT "fingerprints_verse_id_reciter_id_hash_offset_ms_pk" PRIMARY KEY("verse_id","reciter_id","hash","offset_ms")
);
--> statement-breakpoint
CREATE TABLE "reciters" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"recitation_style" text NOT NULL,
	CONSTRAINT "reciters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"verse_id" integer NOT NULL,
	"lang" text NOT NULL,
	"translator" text NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "translations_verse_id_lang_translator_pk" PRIMARY KEY("verse_id","lang","translator")
);
--> statement-breakpoint
CREATE TABLE "verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" smallint NOT NULL,
	"verse_number" smallint NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "verses_unique" UNIQUE("chapter_id","verse_number")
);
--> statement-breakpoint
ALTER TABLE "fingerprints" ADD CONSTRAINT "fingerprints_verse_id_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."verses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fingerprints" ADD CONSTRAINT "fingerprints_reciter_id_reciters_id_fk" FOREIGN KEY ("reciter_id") REFERENCES "public"."reciters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_verse_id_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."verses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verses" ADD CONSTRAINT "verses_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fingerprints_hash_idx" ON "fingerprints" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "fingerprints_reciter_hash_idx" ON "fingerprints" USING btree ("reciter_id","hash");