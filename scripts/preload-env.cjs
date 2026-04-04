/* eslint-disable @typescript-eslint/no-require-imports */
// Preload .env.local before any TS modules execute
const { config } = require('dotenv');
const { join } = require('path');

const envPath = join(process.cwd(), '.env.local');
config({ path: envPath, override: false });
