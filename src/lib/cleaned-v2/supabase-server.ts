import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cleanedEnv } from "./env";

export async function createCleanedServerClient() {
  const cookieStore = await cookies();
  return createServerClient(cleanedEnv.supabaseUrl, cleanedEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore errors from Server Components
        }
      },
    },
  });
}
