/**
 * GET /api/dashboard/messages
 *   Returns prioritized iMessage thread list.
 *   Query params:
 *     ?hours=24    — look-back window (default: 24)
 *     ?limit=10    — max threads to return (default: 10)
 *
 * POST /api/dashboard/messages
 *   Send a reply via osascript.
 *   Body: { handle: string, text: string, isGroup?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Core Data timestamp conversion ──────────────────────────────────────────

const CORE_DATA_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();

function coreDataToDate(timestamp: number): Date {
    const ms = timestamp > 1e15 ? timestamp / 1e6 : timestamp * 1000;
    return new Date(CORE_DATA_EPOCH + ms);
}

// ─── Priority Config ─────────────────────────────────────────────────────────

interface PriorityContact { name: string; handle: string }
interface PriorityConfig {
    high: PriorityContact[];
    medium: PriorityContact[];
    low_keywords: string[];
    mute: { handle: string }[];
}

function loadPriorityConfig(): PriorityConfig {
    const configPath = join(process.cwd(), 'scripts', 'config', 'priority-contacts.yaml');
    const defaults: PriorityConfig = { high: [], medium: [], low_keywords: [], mute: [] };

    if (!existsSync(configPath)) return defaults;

    try {
        const raw = readFileSync(configPath, 'utf-8');
        const config: PriorityConfig = { ...defaults };
        let currentSection = '';

        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || !trimmed) continue;
            if (trimmed.match(/^(high|medium|low_keywords|mute):/)) {
                currentSection = trimmed.replace(':', '').trim();
                if (trimmed.endsWith('[]')) {
                    (config as unknown as Record<string, unknown>)[currentSection] = [];
                }
                continue;
            }
            if (trimmed.startsWith('- ')) {
                if (currentSection === 'low_keywords') {
                    config.low_keywords.push(trimmed.replace(/^-\s*/, '').replace(/^["']|["']$/g, ''));
                } else if (currentSection === 'high' || currentSection === 'medium') {
                    if (trimmed.includes('name:')) {
                        const name = trimmed.match(/name:\s*["']?([^"']+)["']?/)?.[1] ?? '';
                        (config[currentSection as 'high' | 'medium'] as PriorityContact[]).push({ name, handle: '' });
                    } else if (trimmed.includes('handle:')) {
                        const handle = trimmed.match(/handle:\s*["']?([^"']+)["']?/)?.[1] ?? '';
                        const arr = config[currentSection as 'high' | 'medium'] as PriorityContact[];
                        if (arr.length > 0) arr[arr.length - 1].handle = handle;
                    }
                } else if (currentSection === 'mute' && trimmed.includes('handle:')) {
                    const handle = trimmed.match(/handle:\s*["']?([^"']+)["']?/)?.[1] ?? '';
                    config.mute.push({ handle });
                }
            }
        }
        return config;
    } catch {
        return defaults;
    }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const url = new URL(req.url);
    const hoursBack = parseInt(url.searchParams.get('hours') ?? '24', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);

    try {
        const chatDbPath = join(homedir(), 'Library', 'Messages', 'chat.db');

        if (!existsSync(chatDbPath)) {
            return NextResponse.json(
                { error: 'chat.db not found', detail: 'iMessage database not available' },
                { status: 404 },
            );
        }

        // Dynamic import better-sqlite3
        let Database: typeof import('better-sqlite3');
        try {
            Database = (await import('better-sqlite3')).default;
        } catch {
            return NextResponse.json(
                { error: 'better-sqlite3 not installed', detail: 'Run: npm install better-sqlite3' },
                { status: 500 },
            );
        }

        const db = new (Database as unknown as new (path: string, opts?: Record<string, unknown>) => import('better-sqlite3').Database)(chatDbPath, { readonly: true });

        try {
            const cutoffMs = Date.now() - hoursBack * 3600 * 1000;
            const cutoffCoreData = (cutoffMs - CORE_DATA_EPOCH) * 1e6;
            const priorityConfig = loadPriorityConfig();

            const rows = db.prepare(`
                SELECT
                    m.text,
                    m.date,
                    m.is_from_me,
                    h.id as handle_identifier,
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
                text: string | null;
                date: number;
                is_from_me: number;
                handle_identifier: string | null;
                chat_identifier: string | null;
                chat_display_name: string | null;
                chat_style: number;
            }>;

            // Group by chat
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
                        is_group: row.chat_style === 43,
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

            // Build & sort thread summaries
            const mutedHandles = new Set(priorityConfig.mute.map(m => m.handle));
            const highHandles = new Set(priorityConfig.high.map(c => c.handle));
            const mediumHandles = new Set(priorityConfig.medium.map(c => c.handle));
            const lowKeywords = priorityConfig.low_keywords.map(k => k.toLowerCase());
            const priorityOrder: Record<string, number> = { high: 0, medium: 1, normal: 2, low: 3 };

            const threads = [];

            for (const [, thread] of chatMap) {
                const handleList = Array.from(thread.handles);
                if (handleList.some(h => mutedHandles.has(h))) continue;

                thread.messages.sort((a, b) => a.date_raw - b.date_raw);

                let priority: 'high' | 'medium' | 'low' | 'normal' = 'normal';
                if (handleList.some(h => highHandles.has(h))) priority = 'high';
                else if (handleList.some(h => mediumHandles.has(h))) priority = 'medium';
                else if (lowKeywords.some(kw => (thread.display_name ?? '').toLowerCase().includes(kw))) priority = 'low';

                const lastMsg = thread.messages[thread.messages.length - 1];

                threads.push({
                    chat_id: thread.chat_id,
                    display_name: thread.display_name,
                    handles: handleList,
                    is_group: thread.is_group,
                    priority,
                    unread_count: thread.messages.filter(m => !m.from_me).length,
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

            threads.sort((a, b) => {
                const pa = priorityOrder[a.priority] ?? 2;
                const pb = priorityOrder[b.priority] ?? 2;
                if (pa !== pb) return pa - pb;
                if (a.you_last_sender !== b.you_last_sender) return a.you_last_sender ? 1 : -1;
                return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
            });

            return NextResponse.json({
                threads: threads.slice(0, limit),
                total: chatMap.size,
                hoursBack,
            });
        } finally {
            db.close();
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        // Common macOS error — permissions
        if (errorMsg.includes('SQLITE_CANTOPEN') || errorMsg.includes('not permitted')) {
            return NextResponse.json(
                {
                    error: 'Permission denied',
                    detail: 'Grant Full Disk Access to your terminal/Node process via System Settings → Privacy & Security → Full Disk Access',
                },
                { status: 403 },
            );
        }
        console.error('[messages] Error:', err);
        return NextResponse.json({ error: 'Failed to read messages', detail: errorMsg }, { status: 500 });
    }
}

// ─── POST Handler (Send Reply) ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        const body = await req.json();
        const { handle, text, isGroup } = body as {
            handle: string;
            text: string;
            isGroup?: boolean;
        };

        if (!handle || !text) {
            return NextResponse.json(
                { error: 'Missing handle or text' },
                { status: 400 },
            );
        }

        const { execSync } = await import('child_process');

        const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedHandle = handle.replace(/"/g, '\\"');

        let script: string;
        if (isGroup) {
            script = `tell application "Messages" to send "${escapedText}" to chat "${escapedHandle}"`;
        } else {
            script = `tell application "Messages" to send "${escapedText}" to buddy "${escapedHandle}" of (1st account whose service type = iMessage)`;
        }

        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            stdio: 'pipe',
            timeout: 10000,
        });

        return NextResponse.json({ sent: true, handle, text });
    } catch (err) {
        console.error('[messages/reply] Error:', err);
        return NextResponse.json(
            { error: 'Failed to send message', detail: String(err) },
            { status: 500 },
        );
    }
}
