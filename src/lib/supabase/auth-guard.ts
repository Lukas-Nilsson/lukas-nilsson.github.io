import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Verify that the request comes from an authenticated user.
 * Returns the user if authenticated, or a 401 NextResponse if not.
 */
export async function requireAuth(): Promise<
    { user: { id: string; email?: string }; error?: never } |
    { user?: never; error: NextResponse }
> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    return { user };
}
