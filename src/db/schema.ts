import {
  pgTable,
  serial,
  integer,
  text,
  smallint,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

export const reciters = pgTable(
  "reciters",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    recitationStyle: text("recitation_style").notNull(),
  },
);

export const chapters = pgTable(
  "chapters",
  {
    id: smallint("id").primaryKey(),
    name: text("name").notNull(),
    verseCount: smallint("verse_count").notNull(),
  },
);

export const verses = pgTable(
  "verses",
  {
    id: serial("id").primaryKey(),
    chapterId: smallint("chapter_id").notNull().references(() => chapters.id),
    verseNumber: smallint("verse_number").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    unique("verses_unique").on(t.chapterId, t.verseNumber),
  ],
);

export const fingerprints = pgTable(
  "fingerprints",
  {
    verseId: integer("verse_id").notNull().references(() => verses.id),
    reciterId: integer("reciter_id").notNull().references(() => reciters.id),
    hash: integer("hash").notNull(),
    offsetMs: integer("offset_ms").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.verseId, t.reciterId, t.hash, t.offsetMs] }),
    index("fingerprints_hash_idx").on(t.hash),
    index("fingerprints_reciter_hash_idx").on(t.reciterId, t.hash),
  ],
);

export const translations = pgTable(
  "translations",
  {
    verseId: integer("verse_id").notNull().references(() => verses.id),
    lang: text("lang").notNull(),
    translator: text("translator").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.verseId, t.lang, t.translator] }),
  ],
);
