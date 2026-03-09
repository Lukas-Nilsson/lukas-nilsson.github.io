import { NextRequest, NextResponse } from 'next/server';
import {
    getAccessToken,
    createTask as clickupCreateTask,
    getListIdForCategory,
    composeDescription,
    REVERSE_PRIORITY_MAP,
} from '@/lib/clickup';

/**
 * POST /api/openclaw/tasks
 *
 * OpenClaw → ClickUp task creation endpoint.
 * Used by the OpenClaw agent to create tasks directly in ClickUp.
 *
 * Auth: Bearer token via OPENCLAW_API_KEY env var (shared secret).
 *
 * Body:
 *   { name: string, category?: string, priority?: string,
 *     due_date?: string, context?: string, notes?: string,
 *     waiting_on?: string, location?: string }
 */
export async function POST(req: NextRequest) {
    // Authenticate via shared secret
    const authHeader = req.headers.get('Authorization');
    const apiKey = process.env.OPENCLAW_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'OPENCLAW_API_KEY not configured' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${apiKey}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await getAccessToken();
        const body = await req.json();
        const {
            name, category = 'Personal', priority,
            due_date, context, notes, waiting_on, location,
        } = body as {
            name: string;
            category?: string;
            priority?: string;
            due_date?: string;
            context?: string;
            notes?: string;
            waiting_on?: string;
            location?: string;
        };

        if (!name?.trim()) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const listId = await getListIdForCategory(category);
        if (!listId) {
            return NextResponse.json({ error: `No ClickUp list found for category "${category}"` }, { status: 404 });
        }

        // Build the task
        const description = composeDescription({ context, notes, waiting_on, location });

        const newTask = await clickupCreateTask(listId, {
            name: name.trim(),
            description: description || undefined,
            priority: priority ? (REVERSE_PRIORITY_MAP[priority] ?? undefined) : undefined,
            due_date: due_date ? new Date(due_date + 'T23:59:59+11:00').getTime() : undefined,
        });

        return NextResponse.json({
            ok: true,
            task: {
                id: newTask.id,
                name: newTask.name,
                url: newTask.url,
                category,
            },
        });
    } catch (e) {
        console.error('[OpenClaw Tasks] Error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
