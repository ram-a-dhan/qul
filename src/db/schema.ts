import {
  pgTable,
  serial,
  integer,
  text,
  smallint,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const reciters = pgTable(
  "reciters",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    nameDisplay: text("name_display").notNull(),
    recitationStyle: text("recitation_style").notNull(),
    isActive: boolean("is_active").default(true),
  },
);

export const chapters = pgTable(
  "chapters", {
    id: smallint("id").primaryKey(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    verseCount: smallint("verse_count").notNull(),
    avgDurationMs: integer("avg_duration_ms"),
  },
);

export const verses = pgTable(
  "verses",
  {
    id: serial("id").primaryKey(),
    chapterId: smallint("chapter_id").notNull().references(() => chapters.id),
    verseNumber: smallint("verse_number").notNull(),
    reciterId: integer("reciter_id").notNull().references(() => reciters.id),
    durationMs: integer("duration_ms"),
    textAr: text("text_ar").notNull(),
  },
  (t) => [
    unique("verses_unique").on(t.chapterId, t.verseNumber, t.reciterId)
  ],
);

export const fingerprints = pgTable(
  "fingerprints",
  {
    id: serial("id").primaryKey(),
    verseId: integer("verse_id").notNull().references(() => verses.id),
    reciterId: integer("reciter_id").notNull().references(() => reciters.id),
    hash: text("hash").notNull(),
    offsetMs: integer("offset_ms").notNull(),
  },
  (t) => [
    index("fingerprints_hash_idx").on(t.hash),
    index("fingerprints_reciter_hash_idx").on(t.reciterId, t.hash),
  ],
);

export const translations = pgTable(
  "translations",
  {
    id: serial("id").primaryKey(),
    verseId: integer("verse_id").notNull().references(() => verses.id),
    lang: text("lang").notNull(),
    translator: text("translator").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    unique("translations_unique").on(t.verseId, t.lang)
  ],
);
