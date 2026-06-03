import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Vercel functions are stateless — no persistent pool needed
// postgres-js handles this correctly with max: 1
const client = postgres(process.env.DATABASE_URL!, { max: 1 });

export const db = drizzle(client, { schema });
