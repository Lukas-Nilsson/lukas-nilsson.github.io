import { NextResponse } from 'next/server';
import { getConnectUrl } from '@/lib/clickup';

/**
 * GET /api/auth/clickup/connect
 * Redirects the user to ClickUp's OAuth authorization page.
 * No auth guard — this initiates the OAuth flow.
 */
export async function GET() {
    try {
        const url = getConnectUrl();
        return NextResponse.redirect(url);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
