import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    process.env[key] = value;
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase
        .from('calendar_tokens')
        .select('refresh_token')
        .eq('account', 'personal')
        .single();

    if (error || !data) throw new Error(`Failed to get refresh token: ${error?.message}`);

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: data.refresh_token,
            grant_type: 'refresh_token',
        }),
    });

    const json = await res.json();
    if (!json.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
    return json.access_token;
}

async function createEvent(accessToken: string, event: any) {
    const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        }
    );

    const json = await res.json();
    if (json.error) throw new Error(`Create event failed: ${JSON.stringify(json.error)}`);
    return json;
}

async function main() {
    const accessToken = await getAccessToken();
    console.log('Got access token');

    const events = [
        {
            summary: 'OpenClaw Dashboard Development',
            description: 'Calendar integration, dark/light mode, brand color, ClickUp sync',
            start: { dateTime: '2026-03-10T11:00:00+11:00', timeZone: 'Australia/Melbourne' },
            end: { dateTime: '2026-03-10T12:00:00+11:00', timeZone: 'Australia/Melbourne' },
        },
        {
            summary: 'Archive 009 - Memory',
            description: 'Working on THA Archive 009',
            start: { dateTime: '2026-03-10T12:30:00+11:00', timeZone: 'Australia/Melbourne' },
            end: { dateTime: '2026-03-10T14:00:00+11:00', timeZone: 'Australia/Melbourne' },
        },
        {
            summary: 'Archive 009 - Memory (continued)',
            description: 'Continued work on THA Archive 009',
            start: { dateTime: '2026-03-10T14:30:00+11:00', timeZone: 'Australia/Melbourne' },
            end: { dateTime: '2026-03-10T17:00:00+11:00', timeZone: 'Australia/Melbourne' },
        },
    ];

    for (const event of events) {
        const result = await createEvent(accessToken, event);
        console.log(`✅ Created: "${result.summary}" (${result.start.dateTime} → ${result.end.dateTime})`);
    }

    console.log('\nAll 3 events created successfully!');
}

main().catch(console.error);
