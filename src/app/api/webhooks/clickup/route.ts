import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/clickup
 *
 * Receives ClickUp webhook events for real-time task updates.
 * Events: taskCreated, taskUpdated, taskDeleted, taskStatusUpdated,
 *         taskPriorityUpdated, taskDueDateUpdated, taskMoved
 *
 * No auth needed on inbound webhooks — ClickUp signs them.
 * We just invalidate the cache so the next GET is fresh.
 */

// In-memory timestamp of last ClickUp change. The GET endpoint checks this
// to decide whether to re-fetch from ClickUp or serve a cached response.
let lastClickUpChange = Date.now();

export function getLastChangeTimestamp(): number {
    return lastClickUpChange;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // ClickUp webhook health check
        if (body.event === 'ping') {
            return NextResponse.json({ ok: true });
        }

        const event = body.event;
        const taskId = body.task_id;

        console.log(`[ClickUp Webhook] ${event} — task ${taskId}`);

        // Bump the change timestamp — signals to the frontend that data is stale
        lastClickUpChange = Date.now();

        return NextResponse.json({ ok: true, event, task_id: taskId });
    } catch (e) {
        console.error('[ClickUp Webhook] Error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
