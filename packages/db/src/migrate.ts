import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
await client`CREATE EXTENSION IF NOT EXISTS vector`;
await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log("✓ migraciones aplicadas");
await client.end();
