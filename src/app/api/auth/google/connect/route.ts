import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/google-calendar';

/**
 * GET /api/auth/google/connect?account=personal|business
 * Redirects to Google OAuth consent screen.
 */
export async function GET(req: NextRequest) {
    const account = req.nextUrl.searchParams.get('account') as 'personal' | 'business';
    if (!account || !['personal', 'business'].includes(account)) {
        return NextResponse.json({ error: 'account must be "personal" or "business"' }, { status: 400 });
    }

    const loginHints: Record<string, string> = {
        personal: 'lukaspnilsson@gmail.com',
        business: 'lukasnilssonbusiness@gmail.com',
    };

    const url = getOAuthUrl(account, loginHints[account]);
    return NextResponse.redirect(url);
}
