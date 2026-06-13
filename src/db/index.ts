import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

// // Local postgres DB testing mode
// import { config } from "dotenv";
// import { drizzle } from "drizzle-orm/node-postgres";
// import { Pool } from "pg";
// import * as schema from "./schema";

// config({ path: ".env" });

// const client = new Pool({ connectionString: process.env.DATABASE_URL });

// export const db = drizzle({ client, schema });
