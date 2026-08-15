import { getDb } from "./client.js";

// Opening the client runs the idempotent bootstrap migration.
getDb();
console.log("JARVIS database migrated/bootstrapped successfully.");
