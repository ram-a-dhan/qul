# Qul

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

## Development

Run the development server:

```sh
$ pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
