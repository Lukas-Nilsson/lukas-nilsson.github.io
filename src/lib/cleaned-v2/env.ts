// Cleaned Demo V2 uses its own Supabase instance, separate from the main site.
// Lazy getters so module evaluation doesn't throw during Next.js build-time page collection.

function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const cleanedEnv = {
  get supabaseUrl() {
    return req("NEXT_PUBLIC_CLEANED_SUPABASE_URL", process.env.NEXT_PUBLIC_CLEANED_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return req("NEXT_PUBLIC_CLEANED_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_CLEANED_SUPABASE_ANON_KEY);
  },
};
