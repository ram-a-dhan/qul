CREATE TABLE "chapters" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"verse_count" smallint NOT NULL
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
ALTER TABLE "translations" ADD CONSTRAINT "translations_verse_id_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."verses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verses" ADD CONSTRAINT "verses_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;