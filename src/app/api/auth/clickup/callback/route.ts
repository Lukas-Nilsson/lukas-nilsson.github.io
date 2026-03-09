import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/auth/clickup/callback?code=...
 * Handles OAuth2 callback from ClickUp, exchanges code for access token,
 * and stores the token in Supabase.
 */
export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    const error = req.nextUrl.searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/dashboard/tasks?error=${error}`, req.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/tasks?error=missing_code', req.url));
    }

    const clientId = process.env.CLICKUP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('[clickup/callback] Missing CLICKUP_CLIENT_ID or CLICKUP_CLIENT_SECRET');
        return NextResponse.redirect(new URL('/dashboard/tasks?error=missing_config', req.url));
    }

    try {
        // Exchange authorization code for access token
        const tokenRes = await fetch('https://api.clickup.com/api/v2/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
            }),
        });

        if (!tokenRes.ok) {
            const text = await tokenRes.text();
            console.error('[clickup/callback] Token exchange failed:', tokenRes.status, text);
            return NextResponse.redirect(new URL('/dashboard/tasks?error=token_exchange_failed', req.url));
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error('[clickup/callback] No access_token in response:', tokenData);
            return NextResponse.redirect(new URL('/dashboard/tasks?error=no_access_token', req.url));
        }

        // Store the token in Supabase
        const supabase = createAdminClient();
        const { error: dbError } = await supabase.from('integration_tokens').upsert({
            service: 'clickup',
            access_token: accessToken,
            token_data: tokenData,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'service' });

        if (dbError) {
            console.error('[clickup/callback] DB error:', dbError);
            return NextResponse.redirect(new URL('/dashboard/tasks?error=db_error', req.url));
        }

        return NextResponse.redirect(new URL('/dashboard/tasks?connected=clickup', req.url));
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[clickup/callback] Error:', msg);
        return NextResponse.redirect(new URL(`/dashboard/tasks?error=exchange_failed&detail=${encodeURIComponent(msg)}`, req.url));
    }
}
