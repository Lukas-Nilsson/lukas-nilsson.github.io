import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role admin client — bypasses RLS.
 * Only use in server-side API routes, never in client components.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
