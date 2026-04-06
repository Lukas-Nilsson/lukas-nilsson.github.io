// Cleaned Demo V2 uses its own Supabase instance, separate from the main site.

function require(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const cleanedEnv = {
  supabaseUrl: require(
    "NEXT_PUBLIC_CLEANED_SUPABASE_URL",
    process.env.NEXT_PUBLIC_CLEANED_SUPABASE_URL
  ),
  supabaseAnonKey: require(
    "NEXT_PUBLIC_CLEANED_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_CLEANED_SUPABASE_ANON_KEY
  ),
};
