# Qul — Quran Live Interpreter

## Requirements

- node >= 18.x.x
- pnpm >= 10.30.3

## Setup

### Dotenv

Copy the dotenv example file and fill the variables:

```sh
$ cp .env.example .env
```

### Drizzle

Prepare your Neon Postgres DB and then migrate the schema:

```sh
$ pnpm db:migrate
```

## Build Scripts

### Chapters

Build the chapters json file:

```sh
$ pnpm script:build-chapters 
```

### Verses

Download the verses txt files from [https://tanzil.net/download](https://tanzil.net/download) and put it in the txt asset subfolder:

```sh
src/assets/txt/quran-simple-clean.txt
src/assets/txt/quran-uthmani.txt
```

Build the verses json file:

```sh
$ pnpm script:build-verses 
```

### Translation

Download translation txt files from [https://tanzil.net/trans](https://tanzil.net/trans) and put it in the txt asset subfolder:

```sh
src/assets/txt/en.sahih.txt
```

Add the translation specs in the build script:

```ts
// src/scripts/buildTranslation.ts
const TRANSLATION_SPECS: ITranslationSpecs[] = [
  {
    inputFile: "en.sahih.txt",
    outputFile: "translation-en.json",
    lang: "en",
    translator: "Saheeh International",
  },
];
```

Build the translation json file:

```sh
$ pnpm script:build-translation 
```

## Seed Scripts

### Chapters and Verses

Run the chapters and verses seeder:

```sh
$ pnpm db:seed-chapters-verses
```

### Translation

Add the translation source filename in the seed script:

```ts
// src/db/seeders/seedTranslation.ts
const TRANSLATION_FILES = [
  "translation-en.json",
];
```

Run the translation seeder:

```sh
$ pnpm db:seed-translation
```

## Development

Run the development server:

```sh
$ pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
