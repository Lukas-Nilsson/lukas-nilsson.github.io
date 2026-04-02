/**
 * iMessage Triage v3 — Direct chat.db reader
 *
 * Reads ~/Library/Messages/chat.db directly via better-sqlite3 to surface
 * unread/recent threads with full context, ranked by priority contacts.
 *
 * Requirements:
 *   - macOS Full Disk Access granted to the running terminal
 *   - npm install better-sqlite3 (or use npx tsx which bundles it)
 *
 * Usage:
 *   npx tsx scripts/imessage-triage.ts              # list top threads
 *   npx tsx scripts/imessage-triage.ts --json        # JSON output
 *   npx tsx scripts/imessage-triage.ts --hours 48    # look back 48 hours
 *   npx tsx scripts/imessage-triage.ts --limit 10    # show top 10 threads
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MessageRow {
    rowid: number;
    guid: string;
    text: string | null;
    handle_id: number;
    date: number;             // Core Data timestamp (ns since 2001-01-01)
    is_from_me: number;
    cache_roomnames: string | null;
    service: string;
    destination_caller_id: string | null;
}

export interface ThreadSummary {
    chat_id: string;
    display_name: string | null;
    handles: string[];
    is_group: boolean;
    priority: 'high' | 'medium' | 'low' | 'normal';
    unread_count: number;
    total_recent: number;
    last_message: string | null;
    last_message_time: string;     // ISO
    you_last_sender: boolean;
    messages: {
        text: string | null;
        from_me: boolean;
        time: string;
        sender: string | null;
    }[];
}

interface PriorityContact {
    name: string;
    handle: string;
}

interface PriorityConfig {
    high: PriorityContact[];
    medium: PriorityContact[];
    low_keywords: string[];
    mute: { handle: string }[];
}

// ─── Core Data timestamp conversion ──────────────────────────────────────────

// macOS Messages uses Core Data timestamps: nanoseconds since 2001-01-01 00:00:00 UTC
const CORE_DATA_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();

function coreDataToDate(timestamp: number): Date {
    // Some older databases use seconds, newer use nanoseconds
    // If timestamp > 1e15, it's nanoseconds; otherwise seconds
    const ms = timestamp > 1e15
        ? timestamp / 1e6    // nanoseconds → milliseconds
        : timestamp * 1000;  // seconds → milliseconds
    return new Date(CORE_DATA_EPOCH + ms);
}

// ─── Priority Config Loader ─────────────────────────────────────────────────

function loadPriorityConfig(): PriorityConfig {
    const configPath = join(dirname(__dirname), 'scripts', 'config', 'priority-contacts.yaml');

    const defaults: PriorityConfig = {
        high: [],
        medium: [],
        low_keywords: [],
        mute: [],
    };

    if (!existsSync(configPath)) return defaults;

    try {
        const raw = readFileSync(configPath, 'utf-8');
        // Simple YAML parser for our flat structure (avoids js-yaml dependency)
        const config: PriorityConfig = { ...defaults };
        let currentSection = '';

        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || !trimmed) continue;

            // Section headers
            if (trimmed.match(/^(high|medium|low_keywords|mute):/)) {
                currentSection = trimmed.replace(':', '').trim();
                // Handle inline empty array
                if (trimmed.endsWith('[]')) {
                    (config as unknown as Record<string, unknown>)[currentSection] = [];
                }
                continue;
            }

            // List items
            if (trimmed.startsWith('- ') || trimmed.startsWith('- "')) {
                if (currentSection === 'low_keywords') {
                    const value = trimmed.replace(/^-\s*/, '').replace(/^["']|["']$/g, '');
                    config.low_keywords.push(value);
                } else if (currentSection === 'high' || currentSection === 'medium') {
                    // Handle multi-line name/handle entries
                    if (trimmed.includes('name:')) {
                        const name = trimmed.match(/name:\s*["']?([^"']+)["']?/)?.[1] ?? '';
                        (config[currentSection] as PriorityContact[]).push({
                            name,
                            handle: '',
                        });
                    } else if (trimmed.includes('handle:')) {
                        const handle = trimmed.match(/handle:\s*["']?([^"']+)["']?/)?.[1] ?? '';
                        const arr = config[currentSection] as PriorityContact[];
                        if (arr.length > 0) {
                            arr[arr.length - 1].handle = handle;
                        }
                    }
                } else if (currentSection === 'mute') {
                    if (trimmed.includes('handle:')) {
                        const handle = trimmed.match(/handle:\s*["']?([^"']+)["']?/)?.[1] ?? '';
                        config.mute.push({ handle });
                    }
                }
            }
        }

        return config;
    } catch {
        return defaults;
    }
}

// ─── chat.db Query Engine ────────────────────────────────────────────────────

export async function queryMessages(options: {
    hoursBack?: number;
    limit?: number;
}): Promise<ThreadSummary[]> {
    const { hoursBack = 24, limit = 20 } = options;
    const chatDbPath = join(homedir(), 'Library', 'Messages', 'chat.db');

    if (!existsSync(chatDbPath)) {
        throw new Error(`chat.db not found at ${chatDbPath}`);
    }

    // Dynamic import better-sqlite3 (it's a native module)
    let Database: typeof import('better-sqlite3');
    try {
        Database = (await import('better-sqlite3')).default;
    } catch {
        throw new Error(
            'better-sqlite3 not installed. Run: npm install better-sqlite3 @types/better-sqlite3'
        );
    }

    const db = new (Database as unknown as new (path: string, opts?: Record<string, unknown>) => import('better-sqlite3').Database)(chatDbPath, { readonly: true });

    try {
        // Calculate cutoff timestamp in Core Data format (nanoseconds since 2001-01-01)
        const cutoffMs = Date.now() - hoursBack * 3600 * 1000;
        const cutoffCoreData = ((cutoffMs - CORE_DATA_EPOCH) * 1e6); // ms → Core Data ns

        // Query recent messages with their chat and handle info
        const rows = db.prepare(`
            SELECT
                m.ROWID as rowid,
                m.guid,
                m.text,
                m.handle_id,
                m.date,
                m.is_from_me,
                m.cache_roomnames,
                m.service,
                m.destination_caller_id,
                h.id as handle_identifier,
                cmj.chat_id,
                c.chat_identifier,
                c.display_name as chat_display_name,
                c.style as chat_style
            FROM message m
            LEFT JOIN handle h ON m.handle_id = h.ROWID
            LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
            LEFT JOIN chat c ON cmj.chat_id = c.ROWID
            WHERE m.date > ?
            ORDER BY m.date DESC
        `).all(cutoffCoreData) as Array<{
            rowid: number;
            guid: string;
            text: string | null;
            handle_id: number;
            date: number;
            is_from_me: number;
            cache_roomnames: string | null;
            service: string;
            destination_caller_id: string | null;
            handle_identifier: string | null;
            chat_id: number | null;
            chat_identifier: string | null;
            chat_display_name: string | null;
            chat_style: number;
        }>;

        // Load priority config
        const priorityConfig = loadPriorityConfig();

        // Group messages by chat
        const chatMap = new Map<string, {
            chat_id: string;
            display_name: string | null;
            handles: Set<string>;
            is_group: boolean;
            messages: Array<{
                text: string | null;
                from_me: boolean;
                time: string;
                sender: string | null;
                date_raw: number;
            }>;
        }>();

        for (const row of rows) {
            const chatKey = row.chat_identifier ?? `handle:${row.handle_identifier ?? 'unknown'}`;

            if (!chatMap.has(chatKey)) {
                chatMap.set(chatKey, {
                    chat_id: chatKey,
                    display_name: row.chat_display_name || row.handle_identifier || chatKey,
                    handles: new Set(),
                    is_group: row.chat_style === 43, // 43 = group chat in chat.db
                    messages: [],
                });
            }

            const thread = chatMap.get(chatKey)!;
            if (row.handle_identifier) thread.handles.add(row.handle_identifier);

            thread.messages.push({
                text: row.text,
                from_me: row.is_from_me === 1,
                time: coreDataToDate(row.date).toISOString(),
                sender: row.is_from_me ? 'me' : (row.handle_identifier ?? null),
                date_raw: row.date,
            });
        }

        // Build thread summaries
        const mutedHandles = new Set(priorityConfig.mute.map(m => m.handle));
        const highHandles = new Set(priorityConfig.high.map(c => c.handle));
        const mediumHandles = new Set(priorityConfig.medium.map(c => c.handle));
        const lowKeywords = priorityConfig.low_keywords.map(k => k.toLowerCase());

        const threads: ThreadSummary[] = [];

        for (const [, thread] of chatMap) {
            // Skip muted
            const handleList = Array.from(thread.handles);
            if (handleList.some(h => mutedHandles.has(h))) continue;

            // Sort messages chronologically (oldest first)
            thread.messages.sort((a, b) => a.date_raw - b.date_raw);

            // Determine priority
            let priority: 'high' | 'medium' | 'low' | 'normal' = 'normal';
            if (handleList.some(h => highHandles.has(h))) {
                priority = 'high';
            } else if (handleList.some(h => mediumHandles.has(h))) {
                priority = 'medium';
            } else {
                const displayLower = (thread.display_name ?? '').toLowerCase();
                if (lowKeywords.some(kw => displayLower.includes(kw))) {
                    priority = 'low';
                }
            }

            const lastMsg = thread.messages[thread.messages.length - 1];
            const unreadCount = thread.messages.filter(m => !m.from_me).length;

            threads.push({
                chat_id: thread.chat_id,
                display_name: thread.display_name,
                handles: handleList,
                is_group: thread.is_group,
                priority,
                unread_count: unreadCount,
                total_recent: thread.messages.length,
                last_message: lastMsg?.text ?? null,
                last_message_time: lastMsg?.time ?? new Date().toISOString(),
                you_last_sender: lastMsg?.from_me ?? false,
                messages: thread.messages.slice(-10).map(m => ({
                    text: m.text,
                    from_me: m.from_me,
                    time: m.time,
                    sender: m.sender,
                })),
            });
        }

        // Sort: priority tier → you_last_sender (false first) → recency
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, normal: 2, low: 3 };
        threads.sort((a, b) => {
            const pa = priorityOrder[a.priority] ?? 2;
            const pb = priorityOrder[b.priority] ?? 2;
            if (pa !== pb) return pa - pb;
            // Deprioritize threads where you were the last sender
            if (a.you_last_sender !== b.you_last_sender) return a.you_last_sender ? 1 : -1;
            // Then by recency
            return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        });

        return threads.slice(0, limit);

    } finally {
        db.close();
    }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function formatThread(thread: ThreadSummary, index: number): string {
    const priorityBadge: Record<string, string> = {
        high: '🔴',
        medium: '🟡',
        normal: '⚪',
        low: '⬜',
    };

    const badge = priorityBadge[thread.priority] ?? '⚪';
    const youTag = thread.you_last_sender ? ' (you replied)' : '';
    const groupTag = thread.is_group ? ' [group]' : '';
    const time = new Date(thread.last_message_time).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Australia/Melbourne',
    });

    const lines = [
        `${badge} #${index + 1}  ${thread.display_name ?? thread.handles[0]}${groupTag}${youTag}`,
        `   ${thread.total_recent} messages (${thread.unread_count} from others) • last: ${time}`,
    ];

    // Show last 3 messages as preview
    const preview = thread.messages.slice(-3);
    for (const msg of preview) {
        const sender = msg.from_me ? 'You' : (msg.sender ?? '?');
        const text = msg.text
            ? (msg.text.length > 80 ? msg.text.slice(0, 77) + '...' : msg.text)
            : '[attachment]';
        lines.push(`   ${sender}: ${text}`);
    }

    return lines.join('\n');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');

    let hoursBack = 24;
    const hoursIdx = args.indexOf('--hours');
    if (hoursIdx !== -1 && args[hoursIdx + 1]) {
        hoursBack = parseInt(args[hoursIdx + 1], 10) || 24;
    }

    let limit = 10;
    const limitIdx = args.indexOf('--limit');
    if (limitIdx !== -1 && args[limitIdx + 1]) {
        limit = parseInt(args[limitIdx + 1], 10) || 10;
    }

    console.log(`📱 Reading iMessage threads (last ${hoursBack}h)...\n`);

    const threads = await queryMessages({ hoursBack, limit });

    if (jsonOutput) {
        console.log(JSON.stringify(threads, null, 2));
        return;
    }

    if (threads.length === 0) {
        console.log('No recent messages found.');
        return;
    }

    for (let i = 0; i < threads.length; i++) {
        console.log(formatThread(threads[i], i));
        if (i < threads.length - 1) console.log('');
    }

    console.log(`\n${threads.length} threads shown.`);
}

main().catch(err => {
    console.error('❌ Error:', err.message ?? err);
    process.exit(1);
});
