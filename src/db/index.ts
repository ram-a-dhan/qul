import { config } from "dotenv";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

config({ path: ".env" });

// Determine driver by environment: dev → node-postgres, prod → neon
const isProduction = process.env.NODE_ENV === "production";

export const db = isProduction
  ? neonDrizzle(neon(process.env.DATABASE_URL!), { schema })
  : pgDrizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
