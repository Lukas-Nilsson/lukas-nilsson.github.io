"use client";

import { createBrowserClient } from "@supabase/ssr";
import { cleanedEnv } from "./env";

export function createCleanedClient() {
  return createBrowserClient(cleanedEnv.supabaseUrl, cleanedEnv.supabaseAnonKey);
}
