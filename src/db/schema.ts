import {
  pgTable,
  serial,
  integer,
  text,
  smallint,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

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
    textNormalized: text("text_normalized").notNull(),
  },
  (t) => [
    unique("verses_unique").on(t.chapterId, t.verseNumber),
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
