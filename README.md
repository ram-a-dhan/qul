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

Download the verses txt file from [https://tanzil.net/download](https://tanzil.net/download) and put it in the txt asset subfolder:

```sh
src/assets/txt/quran-simple.txt
```

Build the verses json file:

```sh
$ pnpm script:build-verses 
```

### Translation

Download translation txt file from [https://tanzil.net/trans](https://tanzil.net/trans) and put it in the txt asset subfolder:

```sh
src/assets/txt/en.sahih.txt
```

Add the translation specs in the build script:

```ts
// src/scripts/buildTranslation.ts
const SPECS: ISpecs = {
  INPUT_FILE: "en.sahih.txt",
  OUTPUT_FILE: "translation-en.json",
  LANGUAGE: "en",
  TRANSLATOR: "Saheeh International",
};
```

Build the translation json file:

```sh
$ pnpm script:build-translation 
```

### Audio Fingerprint

Add the target reciter folder name from [https://everyayah.com/data](https://everyayah.com/data) in the download script:

```ts
// src/scripts/downloadAudio.ts
const FOLDER_NAME = "Alafasy_128kbps";
```

Download all 114 chapters of audio zip files:

```sh
$ pnpm script:download-audio 
```

Build the audio fingerprint json file:

```sh
$ pnpm script:build-fingerprint 
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
const TRANSLATION_FILE = "translation-en.json";
```

Run the translation seeder:

```sh
$ pnpm db:seed-translation
```

### Audio Fingerprint

Add the reciter specs the seed script:

```ts
// src/db/seeders/seedReciterFingerprint
const RECITER: ISeedReciter = {
  slug:            "mishary-alafasy",
  name:            "Mishary Rashid Alafasy",
  recitationStyle: "hafs",
};
```

Run the reciter fingerprint seeder:

```sh
$ pnpm db:seed-reciter-fingerprint
```

## Development

Run the development server:

```sh
$ pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
