// Load server secrets first, then optional repository-root OpenCode defaults.
// This module must be imported before the DB and route modules so DATABASE_URL
// and provider fallbacks are available during their initialization.
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(dir, "../.env") });
config({ path: path.resolve(dir, "../../.env") });
