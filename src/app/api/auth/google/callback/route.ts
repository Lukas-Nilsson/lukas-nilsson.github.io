import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/google-calendar';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/auth/google/callback?code=...&state=personal|business
 * Handles OAuth2 callback from Google, stores tokens in Supabase.
 */
export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    const account = req.nextUrl.searchParams.get('state') as 'personal' | 'business';
    const error = req.nextUrl.searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/dashboard/calendar?error=${error}`, req.url));
    }

    if (!code || !account) {
        return NextResponse.redirect(new URL('/dashboard/calendar?error=missing_params', req.url));
    }

    try {
        // Exchange the authorization code for tokens
        const tokens = await exchangeCode(code);

        if (!tokens.refresh_token) {
            return NextResponse.redirect(new URL('/dashboard/calendar?error=no_refresh_token', req.url));
        }

        // Get user email from the id_token or userinfo endpoint
        let email = '';
        try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            const userInfo = await userInfoRes.json();
            email = userInfo.email ?? '';
        } catch {
            email = account === 'personal' ? 'lukaspnilsson@gmail.com' : 'lukasnilssonbusiness@gmail.com';
        }

        // Store in Supabase
        const supabase = createAdminClient();
        const { error: dbError } = await supabase.from('calendar_tokens').upsert({
            account,
            email,
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
            token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'account' });

        if (dbError) {
            console.error('[google/callback] DB error:', dbError);
            return NextResponse.redirect(new URL('/dashboard/calendar?error=db_error', req.url));
        }

        return NextResponse.redirect(new URL(`/dashboard/calendar?connected=${account}`, req.url));
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[google/callback] Error:', msg);
        return NextResponse.redirect(new URL(`/dashboard/calendar?error=exchange_failed&detail=${encodeURIComponent(msg)}`, req.url));
    }
}
