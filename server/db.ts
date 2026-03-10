import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Use Supabase connection from environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set. The application cannot connect to the database. Please ensure DATABASE_URL is configured in your Replit Secrets or environment.");
  process.exit(1); // Exit the process with an error code
}

console.log("Connecting to PostgreSQL database...");
console.log("Connection string (masked):", connectionString?.replace(/:([^:@]+)@/, ':***@'));

// Create the database connection with SSL configuration for local development
const sql = postgres(connectionString as string, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false, // Only require SSL in production
  max: 20,              // Maximum number of connections in pool
  idle_timeout: 30,     // Close idle connections after 30 seconds
  connect_timeout: 30,  // Connection timeout in seconds (increased from 10)
  max_lifetime: 60 * 30 // Max connection lifetime: 30 minutes
});
export const db = drizzle(sql, { schema });

// Export sql client for raw queries and transactions
export { sql };