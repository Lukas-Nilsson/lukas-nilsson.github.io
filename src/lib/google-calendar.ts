/**
 * Google Calendar API v3 wrapper.
 * Handles token refresh, event CRUD, and incremental sync.
 */

const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleEvent {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    status: string;
    colorId?: string;
    recurrence?: string[];
    etag: string;
    recurringEventId?: string;
    updated: string;
}

export interface CalendarToken {
    account: string;
    email: string;
    refresh_token: string;
    access_token: string | null;
    token_expiry: string | null;
    sync_token: string | null;
}

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

// ─── Token Management ────────────────────────────────────────────────────────

/**
 * Refresh the access token using the stored refresh token.
 * Returns the new access token and expiry.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: Date }> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Token refresh failed (${res.status}): ${err}`);
    }

    const data: TokenResponse = await res.json();
    return {
        access_token: data.access_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
    };
}

/**
 * Get a valid access token for an account.
 * Refreshes if expired or missing.
 */
export async function getAccessToken(token: CalendarToken): Promise<{ access_token: string; expires_at: Date }> {
    // Check if current token is still valid (with 5-min buffer)
    if (token.access_token && token.token_expiry) {
        const expiry = new Date(token.token_expiry);
        if (expiry.getTime() - Date.now() > 5 * 60 * 1000) {
            return { access_token: token.access_token, expires_at: expiry };
        }
    }
    return refreshAccessToken(token.refresh_token);
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function gcalFetch(accessToken: string, path: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${GOOGLE_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    return res;
}

// ─── Calendar Operations ─────────────────────────────────────────────────────

/**
 * List events from a Google Calendar.
 * Uses syncToken for incremental sync if available.
 */
export async function listEvents(
    accessToken: string,
    calendarId: string = 'primary',
    options: {
        timeMin?: string;
        timeMax?: string;
        syncToken?: string;
        maxResults?: number;
    } = {},
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
    const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: String(options.maxResults ?? 250),
    });

    if (options.syncToken) {
        params.set('syncToken', options.syncToken);
    } else {
        if (options.timeMin) params.set('timeMin', options.timeMin);
        if (options.timeMax) params.set('timeMax', options.timeMax);
    }

    const res = await gcalFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);

    if (res.status === 410) {
        // Sync token expired — need full sync
        return { events: [], nextSyncToken: null };
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`listEvents failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
        events: data.items ?? [],
        nextSyncToken: data.nextSyncToken ?? null,
    };
}

/**
 * Create an event on Google Calendar.
 */
export async function createEvent(
    accessToken: string,
    calendarId: string = 'primary',
    event: {
        summary: string;
        description?: string;
        location?: string;
        start: { dateTime?: string; date?: string; timeZone?: string };
        end: { dateTime?: string; date?: string; timeZone?: string };
        colorId?: string;
        recurrence?: string[];
    },
): Promise<GoogleEvent> {
    const res = await gcalFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        body: JSON.stringify(event),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`createEvent failed (${res.status}): ${err}`);
    }

    return res.json();
}

/**
 * Update an event on Google Calendar.
 */
export async function updateEvent(
    accessToken: string,
    calendarId: string = 'primary',
    eventId: string,
    updates: Partial<{
        summary: string;
        description: string;
        location: string;
        start: { dateTime?: string; date?: string; timeZone?: string };
        end: { dateTime?: string; date?: string; timeZone?: string };
        colorId: string;
        status: string;
    }>,
): Promise<GoogleEvent> {
    const res = await gcalFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`updateEvent failed (${res.status}): ${err}`);
    }

    return res.json();
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteEvent(
    accessToken: string,
    calendarId: string = 'primary',
    eventId: string,
): Promise<void> {
    const res = await gcalFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: 'DELETE',
    });

    if (!res.ok && res.status !== 410) {
        const err = await res.text();
        throw new Error(`deleteEvent failed (${res.status}): ${err}`);
    }
}

// ─── OAuth URL Generator ────────────────────────────────────────────────────

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
    ?? (process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`
        : 'http://localhost:3000/api/auth/google/callback');

export function getOAuthUrl(account: 'personal' | 'business', loginHint?: string): string {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly',
        access_type: 'offline',
        prompt: 'consent',
        state: account,
    });
    if (loginHint) params.set('login_hint', loginHint);
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    id_token?: string;
}> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Code exchange failed (${res.status}): ${err}`);
    }

    return res.json();
}
