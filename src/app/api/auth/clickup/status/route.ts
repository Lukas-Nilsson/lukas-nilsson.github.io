import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth-guard';
import { getAccessToken, getLists, getAllTasks, mapAllTasks, ensureCategoryLists } from '@/lib/clickup';

/**
 * GET /api/auth/clickup/status
 * Returns the current ClickUp connection status, lists, and task summary.
 *
 * Query params:
 *   ?setup=true  — also ensures category lists exist in ClickUp
 */
export async function GET(req: Request) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    try {
        // Test if we have a valid token
        await getAccessToken();
    } catch {
        return NextResponse.json({
            connected: false,
            message: 'ClickUp not connected. Visit /api/auth/clickup/connect to authorize.',
        });
    }

    try {
        const url = new URL(req.url);
        const doSetup = url.searchParams.get('setup') === 'true';

        if (doSetup) {
            // Ensure all category lists exist
            const listMap = await ensureCategoryLists();
            const listsObj: Record<string, string> = {};
            listMap.forEach((id, name) => { listsObj[name] = id; });

            return NextResponse.json({
                connected: true,
                setup: true,
                lists: listsObj,
            });
        }

        // Normal status check
        const lists = await getLists();
        const { tasks } = await getAllTasks();
        const mapped = mapAllTasks(tasks);

        return NextResponse.json({
            connected: true,
            lists: lists.map(l => ({ id: l.id, name: l.name, task_count: l.task_count })),
            task_count: mapped.length,
            open_count: mapped.filter(t => t.status === 'open').length,
            done_count: mapped.filter(t => t.status === 'done').length,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ connected: true, error: msg }, { status: 500 });
    }
}
