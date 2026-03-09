import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextResponse } from 'next/server';
import {
    getAllTasks,
    updateTask as clickupUpdateTask,
    deleteTask as clickupDeleteTask,
} from '@/lib/clickup';
import type { ClickUpTask } from '@/lib/clickup';

/**
 * POST /api/dashboard/tasks/cleanup
 * 
 * One-shot batch cleanup: abandon, complete, delete, update status, set parent, add notes.
 * This is meant to be called once to execute the audit recommendations.
 */
export async function POST() {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const results: { action: string; task: string; ok: boolean; error?: string }[] = [];

    try {
        // Fetch all tasks to build name→ID map
        const { tasks: allTasks } = await getAllTasks();
        const nameToTask = new Map<string, ClickUpTask>();
        for (const t of allTasks) {
            nameToTask.set(t.name, t);
        }

        const findId = (name: string): string | null => nameToTask.get(name)?.id ?? null;

        // Helper to safely execute an action
        const exec = async (action: string, taskName: string, fn: () => Promise<void>) => {
            try {
                await fn();
                results.push({ action, task: taskName, ok: true });
            } catch (err) {
                results.push({ action, task: taskName, ok: false, error: String(err) });
            }
        };

        // ─── ABANDON: Stale 75 Hard ──────────────────────────────────────
        const toAbandon = [
            'Complete 75 Hard',
            'Read 10 pages (non-fiction / self-improvement)',
            'Whole foods diet — no cheat meals, no alcohol',
            'Drink 1 gallon (3.8L) water',
            'Workout 2 — 45+ min (can be indoor)',
            'Workout 1 — 45+ min (OUTDOOR)',
        ];

        for (const name of toAbandon) {
            const id = findId(name);
            if (id) await exec('abandon', name, () => clickupUpdateTask(id, { status: 'abandoned' }).then(() => { }));
        }

        // ─── COMPLETE: Already done ──────────────────────────────────────
        const toComplete = [
            'Replace 75 Hard with a General Habits Framework',
            'MMA intro PT session',
            'Investigate Anthropic API (Opus/Sonnet) request bug',
        ];

        for (const name of toComplete) {
            const id = findId(name);
            if (id) await exec('complete', name, () => clickupUpdateTask(id, { status: 'complete' }).then(() => { }));
        }

        // ─── DELETE: Duplicates ──────────────────────────────────────────
        const toDelete = [
            'Find/Buy Dresser on marketplace',
            'Book flights',
            'Go to Vicroads over Licence photo',
            'Bitcoin price tracking',  // duplicate of Monitor Bitcoin
        ];

        for (const name of toDelete) {
            const id = findId(name);
            if (id) await exec('delete', name, () => clickupDeleteTask(id));
        }

        // ─── STATUS UPDATE: Set to "in progress" ────────────────────────
        const toInProgress = [
            'Keep developing Clukas',
            'Get apartment sorted',
            'Set up outdoor space',
            'Build content pipeline',
            'Set up WhatsApp channel for OpenClaw',
            'Implement true bi-directional content sync for tasks (website ↔ local)',
            'Lock in bucks trip to Mexico',
            'Launch Archive 009 - Memory',
            'Send THA newsletter',
        ];

        for (const name of toInProgress) {
            const id = findId(name);
            if (id) await exec('in-progress', name, () => clickupUpdateTask(id, { status: 'in progress' }).then(() => { }));
        }

        // ─── SUBTASK LINKING: Set parent for sub-items ───────────────────
        const subtaskMap: Record<string, string[]> = {
            // Bucks Trip
            'Lock in bucks trip to Mexico': [
                'Book bucks flights (Mexico, TBD)',
                'Confirm bucks dates with Jasper',
                'Create WhatsApp group',
                'Collect phone numbers for all bucks attendees',
                'Finalise & communicate dress code',
            ],
            // Wedding Soundtrack
            'Wedding soundtrack': [
                'Pick first dance song with Yari',
                'Shortlist reception songs',
                'Shortlist ceremony songs',
            ],
            // Vegas Trip
            'Plan Vegas trip for older family crew': [
                'Figure out logistics',
                'Figure out timing',
                'Define who\'s in (Yari\'s dad, grandpa, uncles?)',
            ],
            // THA Newsletter
            'Send THA newsletter': [
                'Review + send',
                'Draft copy',
                'Decide angle (009 focused or broader?)',
            ],
            // Archive 009
            'Launch Archive 009 - Memory': [
                'Publish + announce',
                'QA — mobile + desktop',
                'Build/update archive page',
                'Source/create visuals + assets',
                'Write archive narrative/copy',
                'Research — historical context, human story angle',
                'Decide on theme/topic',
            ],
            // THA Pitch
            'Pitch THA to Mal\'s business contact': [
                'Get meeting in the calendar',
                'Practice the pitch',
                'Build the pitch deck / one-pager',
                'Ask Mal to make the introduction',
            ],
            // Apartment
            'Get apartment sorted': [
                'Keep it clean — help Yari',
                'Storage sorted',
                'Kitchen fully stocked',
                'Wall art + decorating',
                'Remaining furniture (see apartment.md)',
                'Buy self-cleaning cat litter',
            ],
            // Outdoor Space
            'Set up outdoor space': [
                'Make it yoga-ready (flat surface, calm feel)',
                'Add plants',
                'Source furniture (outdoor rug, chairs/cushions, small table)',
                'Define the vibe — zen, plants, seating',
            ],
            // Learner's Licence
            'Get learner\'s licence': [
                'Book VicRoads appointment (learners test)',
                'Study road rules / practice test',
                'Attend appointment + sit test',
            ],
            // FireProtect
            'Build FireProtect platform': [
                'Plan next steps with Dave',
                'Design alert system (e.g., SMS, push notification, email)',
                'Write proof-of-concept sensor script',
                'Set up initial Raspberry Pi OS',
                'Research hardware (Raspberry Pi model, smoke/heat sensors)',
                'Define scope & features (e.g., sensor types, alert methods)',
            ],
            // WhatsApp
            'Set up WhatsApp channel for OpenClaw': [
                'Test sending + receiving',
                'Configure WhatsApp in openclaw.json',
                'Set up WhatsApp channel for Wedding with OpenClaw',
            ],
            // THA Content Pipeline
            'Build content pipeline': [
                'Define content types (social, newsletter, YouTube, blog)',
                'Set cadence per channel',
                'Build content calendar template',
                'Create repeatable templates per type',
                'Build backlog of content ideas',
            ],
            // THA Museum
            'Develop museum/simbox': [
                'Define scope + experience',
                'List artifacts to include',
                'Design navigation/UX',
                'Build 3D scan integration',
                'Build AI chatbot per artifact (historical figure style)',
                'Build fractal/animation layer',
                'QA + soft launch',
            ],
        };

        for (const [parentName, childNames] of Object.entries(subtaskMap)) {
            const parentId = findId(parentName);
            if (!parentId) {
                results.push({ action: 'parent-not-found', task: parentName, ok: false, error: 'Parent task not found' });
                continue;
            }

            for (const childName of childNames) {
                const childId = findId(childName);
                if (childId) {
                    await exec('set-parent', `${childName} → ${parentName}`, () =>
                        clickupUpdateTask(childId, { parent: parentId }).then(() => { })
                    );
                }
            }
        }

        // ─── ADD NOTES: Enriched context from transcripts ────────────────
        const notesToAdd: Record<string, string> = {
            'Lock in bucks trip to Mexico': 'Jun 3-6, Mexico City. Confirmed: Jasper, Toni, Mario, Cadan, Kai, Ricky, Roble, James, Marcos, Griffin, Yue, Duh. Thomas Patterson not yet asked. Need remaining phone numbers for: Jasper, James, Marcos, Yue, Griffin, Duh, Mario.',
            'Book wedding flights (depart May 18, Puerto Vallarta, return TBD)': 'Depart May 18 to Puerto Vallarta. Set up Qantas Frequent Flyer for Yari + ensure Lukas\'s is active.',
            'Fulfill THA order for Theo Attill': 'Theo\'s hoodie first, then order. Theo invited to see heat press setup — done.',
            'Create and order THA gang sheet (PrintFactory)': 'DTF supplier: printfactory.com.au. Due Mar 12. Include Satwick order.',
            'Build FireProtect platform': 'Collaborating with Dave (Jane\'s brother). Raspberry Pi fire detection platform.',
            'Decide on inviting Horng': 'On futsal team, not yet invited to wedding. Decision: wedding first, then bucks.',
        };

        for (const [taskName, notes] of Object.entries(notesToAdd)) {
            const task = nameToTask.get(taskName);
            if (task) {
                const existing = task.description?.trim() ?? '';
                const newDesc = existing
                    ? `${existing}\n\n---\n**Notes:** ${notes}`
                    : `---\n**Notes:** ${notes}`;
                await exec('add-notes', taskName, () =>
                    clickupUpdateTask(task.id, { description: newDesc }).then(() => { })
                );
            }
        }

        // ─── ALSO COMPLETE "Confirm bucks dates with Jasper" (done — locked Jun 3-6) ──
        const confirmBucks = findId('Confirm bucks dates with Jasper');
        if (confirmBucks) {
            await exec('complete', 'Confirm bucks dates with Jasper', () =>
                clickupUpdateTask(confirmBucks, { status: 'complete' }).then(() => { })
            );
        }

        return NextResponse.json({
            ok: true,
            total: results.length,
            succeeded: results.filter(r => r.ok).length,
            failed: results.filter(r => !r.ok).length,
            results,
        });

    } catch (err) {
        console.error('[cleanup] Error:', err);
        return NextResponse.json({ error: String(err), results }, { status: 500 });
    }
}
