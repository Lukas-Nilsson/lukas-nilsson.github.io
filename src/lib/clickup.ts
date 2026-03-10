/**
 * ClickUp API v2 Client
 *
 * Handles all interactions with the ClickUp API for task management.
 * Uses OAuth access token stored in Supabase `integration_tokens`.
 *
 * ClickUp hierarchy: Workspace → Space → Folder → List → Task
 * Our mapping: Category = List, Task = Task, Subtask = Subtask
 */

import { createAdminClient } from '@/lib/supabase/admin';

const CLICKUP_API = 'https://api.clickup.com/api/v2';
const TEAM_ID = process.env.CLICKUP_TEAM_ID ?? '';
const SPACE_ID = process.env.CLICKUP_SPACE_ID ?? '';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClickUpTask {
    id: string;
    name: string;
    description: string;
    status: {
        status: string;     // e.g. 'open', 'in progress', 'complete', 'closed'
        type: string;       // 'open', 'closed', 'custom'
        color: string;
    };
    date_created: string;   // Unix ms
    date_updated: string;   // Unix ms
    date_closed: string | null;
    due_date: string | null; // Unix ms
    start_date: string | null;
    priority: {
        id: string;
        priority: string;   // 'urgent', 'high', 'normal', 'low'
        color: string;
    } | null;
    parent: string | null;  // parent task ID for subtasks
    tags: { name: string; tag_fg: string; tag_bg: string }[];
    list: { id: string; name: string };
    folder: { id: string; name: string };
    space: { id: string };
    custom_fields: ClickUpCustomField[];
    subtasks?: ClickUpTask[];
    url: string;
}

export interface ClickUpCustomField {
    id: string;
    name: string;
    type: string;
    value: unknown;
}

export interface ClickUpList {
    id: string;
    name: string;
    content: string;
    status: { status: string; type: string; color: string }[];
    task_count: string;
    folder: { id: string; name: string };
    space: { id: string; name: string };
}

// Our internal task model mapped from ClickUp
export interface MappedTask {
    clickup_id: string;
    name: string;
    category: string;       // list name
    status: 'open' | 'done' | 'abandoned';
    clickup_status: string; // raw ClickUp status: 'to do', 'in progress', 'complete', etc.
    priority: string | null;
    due_date: string | null; // YYYY-MM-DD
    waiting_on: string | null;
    notes: string | null;
    context: string | null;
    location: string | null;
    parent_task: string | null;
    tags: string[];
    progress: number;
    created_at: string;     // ISO
    completed_at: string | null;
    url: string;
}

// ─── Token Management ────────────────────────────────────────────────────────

let cachedToken: string | null = null;

/**
 * Get the ClickUp access token.
 * Priority: CLICKUP_TOKEN env var (personal token) → OAuth token from Supabase.
 */
export async function getAccessToken(): Promise<string> {
    if (cachedToken) return cachedToken;

    // 1. Personal API token (preferred — full workspace access, no OAuth scope issues)
    const personalToken = process.env.CLICKUP_TOKEN;
    if (personalToken) {
        cachedToken = personalToken;
        return personalToken;
    }

    // 2. Fall back to OAuth token from Supabase
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('integration_tokens')
        .select('access_token')
        .eq('service', 'clickup')
        .single();

    if (error || !data?.access_token) {
        throw new Error('ClickUp not connected — set CLICKUP_TOKEN env var or authorize via /api/auth/clickup/connect');
    }

    cachedToken = data.access_token;
    return data.access_token;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function clickupFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const url = path.startsWith('http') ? path : `${CLICKUP_API}${path}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClickUp API error [${res.status}]: ${text}`);
    }

    return res.json() as Promise<T>;
}

// ─── Space & List Operations ─────────────────────────────────────────────────

/**
 * Get all lists in the space (includes folderless lists and lists within folders).
 */
export async function getLists(): Promise<ClickUpList[]> {
    // Get folderless lists
    const folderless = await clickupFetch<{ lists: ClickUpList[] }>(
        `/space/${SPACE_ID}/list?archived=false`
    );

    // Get folders and their lists
    const folders = await clickupFetch<{ folders: { id: string; name: string; lists: ClickUpList[] }[] }>(
        `/space/${SPACE_ID}/folder?archived=false`
    );

    const allLists = [...folderless.lists];
    for (const folder of folders.folders) {
        allLists.push(...folder.lists);
    }

    return allLists;
}

/**
 * Create a new list in the space (folderless).
 */
export async function createList(name: string): Promise<ClickUpList> {
    return clickupFetch<ClickUpList>(`/space/${SPACE_ID}/list`, {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}

// ─── Task Operations ─────────────────────────────────────────────────────────

/**
 * Get all tasks from a specific list, including closed tasks.
 */
export async function getTasksFromList(listId: string, includeSubtasks = true): Promise<ClickUpTask[]> {
    const tasks: ClickUpTask[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({
            page: String(page),
            include_closed: 'true',
            subtasks: String(includeSubtasks),
        });

        const res = await clickupFetch<{ tasks: ClickUpTask[]; last_page: boolean }>(
            `/list/${listId}/task?${params}`
        );

        tasks.push(...res.tasks);
        hasMore = !res.last_page;
        page++;
    }

    return tasks;
}

// ─── In-memory cache for getAllTasks (60s TTL) ──────────────────────────────
let _taskCache: { tasks: ClickUpTask[]; lists: ClickUpList[]; fetchedAt: number } | null = null;
const TASK_CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Get all tasks across all lists in the space.
 * Results are cached in-memory for 60s to avoid redundant ClickUp API calls
 * when multiple API routes (dashboard, calendar, tasks) load simultaneously.
 */
export async function getAllTasks(opts?: { bustCache?: boolean }): Promise<{ tasks: ClickUpTask[]; lists: ClickUpList[] }> {
    // Return cached data if fresh
    if (!opts?.bustCache && _taskCache && (Date.now() - _taskCache.fetchedAt) < TASK_CACHE_TTL_MS) {
        return { tasks: _taskCache.tasks, lists: _taskCache.lists };
    }

    const lists = await getLists();
    const allTasks: ClickUpTask[] = [];

    for (const list of lists) {
        const tasks = await getTasksFromList(list.id);
        allTasks.push(...tasks);
    }

    // Store in cache
    _taskCache = { tasks: allTasks, lists, fetchedAt: Date.now() };

    return { tasks: allTasks, lists };
}

/**
 * Get a single task by ID.
 */
export async function getTask(taskId: string): Promise<ClickUpTask> {
    return clickupFetch<ClickUpTask>(`/task/${taskId}?include_subtasks=true`);
}

/**
 * Create a new task in a list.
 */
export async function createTask(listId: string, data: {
    name: string;
    description?: string;
    priority?: number;   // 1=urgent, 2=high, 3=normal, 4=low
    due_date?: number;   // Unix ms
    tags?: string[];
    parent?: string;     // parent task ID for subtasks
    status?: string;
}): Promise<ClickUpTask> {
    return clickupFetch<ClickUpTask>(`/list/${listId}/task`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Update an existing task.
 */
export async function updateTask(taskId: string, data: {
    name?: string;
    description?: string;
    priority?: number | null;
    due_date?: number | null;
    status?: string;
    parent?: string;
}): Promise<ClickUpTask> {
    return clickupFetch<ClickUpTask>(`/task/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/**
 * Delete a task.
 */
export async function deleteTask(taskId: string): Promise<void> {
    const token = await getAccessToken();
    const res = await fetch(`${CLICKUP_API}/task/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClickUp DELETE error [${res.status}]: ${text}`);
    }
}

/**
 * Set a custom field value on a task.
 */
export async function setCustomField(taskId: string, fieldId: string, value: unknown): Promise<void> {
    const token = await getAccessToken();
    const res = await fetch(`${CLICKUP_API}/task/${taskId}/field/${fieldId}`, {
        method: 'POST',
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClickUp custom field error [${res.status}]: ${text}`);
    }
}

// ─── Time Tracking ───────────────────────────────────────────────────────────

export interface ClickUpTimeEntry {
    id: string;
    task: { id: string; name: string; status: { status: string } } | null;
    wid: string; // workspace ID
    start: string; // Unix ms (string)
    end: string;   // Unix ms (string)
    duration: string; // ms (string, negative = timer running)
    description: string;
    at: string; // created timestamp
}

function getTeamId(): string {
    const id = process.env.CLICKUP_TEAM_ID;
    if (!id) throw new Error('Missing CLICKUP_TEAM_ID in environment');
    return id;
}

/**
 * Create a time entry (work session) for a task.
 * This is what shows up in ClickUp's time tracking and represents
 * a scheduled block of work on the calendar.
 */
export async function createTimeEntry(taskId: string, startMs: number, endMs: number, description?: string): Promise<ClickUpTimeEntry> {
    const teamId = getTeamId();
    return clickupFetch<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries`, {
        method: 'POST',
        body: JSON.stringify({
            tid: taskId,
            start: startMs,
            end: endMs,
            duration: endMs - startMs,
            description: description ?? '',
        }),
    }).then(r => r.data);
}

/**
 * Get time entries for a date range. Used to populate the calendar
 * with scheduled work sessions.
 */
export async function getTimeEntries(startMs: number, endMs: number): Promise<ClickUpTimeEntry[]> {
    const teamId = getTeamId();
    return clickupFetch<{ data: ClickUpTimeEntry[] }>(
        `/team/${teamId}/time_entries?start_date=${startMs}&end_date=${endMs}`
    ).then(r => r.data ?? []);
}

/**
 * Update a time entry (e.g. when moving an event on the calendar).
 */
export async function updateTimeEntry(entryId: string, data: { start?: number; end?: number; duration?: number; description?: string }): Promise<ClickUpTimeEntry> {
    const teamId = getTeamId();
    return clickupFetch<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries/${entryId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }).then(r => r.data);
}

/**
 * Delete a time entry.
 */
export async function deleteTimeEntry(entryId: string): Promise<void> {
    const teamId = getTeamId();
    const token = await getAccessToken();
    const res = await fetch(`${CLICKUP_API}/team/${teamId}/time_entries/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClickUp DELETE time entry error [${res.status}]: ${text}`);
    }
}

// ─── OAuth Connect URL ───────────────────────────────────────────────────────

/**
 * Generate the ClickUp OAuth authorization URL.
 */
export function getConnectUrl(): string {
    const clientId = process.env.CLICKUP_CLIENT_ID;
    const redirectUri = process.env.CLICKUP_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        throw new Error('Missing CLICKUP_CLIENT_ID or CLICKUP_REDIRECT_URI');
    }

    return `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

// ─── Data Mapping ────────────────────────────────────────────────────────────

// Map ClickUp priority IDs to our internal priority names (ClickUp-native)
const PRIORITY_MAP: Record<string, string> = {
    '1': 'urgent',
    '2': 'high',
    '3': 'normal',
    '4': 'low',
};

const REVERSE_PRIORITY_MAP: Record<string, number> = {
    'urgent': 1,
    'high': 2,
    'normal': 3,
    'low': 4,
    // Legacy mappings for backward compat
    'this_week': 2,
    'this_month': 3,
    'ongoing': 3,
    'someday': 4,
};

// ─── Structured Description ──────────────────────────────────────────────────

/**
 * Compose a structured ClickUp description from metadata fields.
 * Format:
 *   Free-form context text...
 *
 *   ---
 *   **Notes:** quick notes
 *   **Waiting On:** person/thing
 *   **Location:** place
 */
export function composeDescription(fields: {
    context?: string | null;
    notes?: string | null;
    waiting_on?: string | null;
    location?: string | null;
}): string {
    const parts: string[] = [];

    if (fields.context?.trim()) {
        parts.push(fields.context.trim());
    }

    const meta: string[] = [];
    if (fields.notes?.trim()) meta.push(`**Notes:** ${fields.notes.trim()}`);
    if (fields.waiting_on?.trim()) meta.push(`**Waiting On:** ${fields.waiting_on.trim()}`);
    if (fields.location?.trim()) meta.push(`**Location:** ${fields.location.trim()}`);

    if (meta.length) {
        if (parts.length) parts.push('');
        parts.push('---');
        parts.push(...meta);
    }

    return parts.join('\n');
}

/**
 * Parse a structured ClickUp description back into metadata fields.
 */
export function parseDescription(description: string | null | undefined): {
    context: string | null;
    notes: string | null;
    waiting_on: string | null;
    location: string | null;
} {
    if (!description?.trim()) {
        return { context: null, notes: null, waiting_on: null, location: null };
    }

    const text = description.trim();
    const separatorIdx = text.indexOf('\n---\n');

    let contextPart = text;
    let metaPart = '';

    if (separatorIdx >= 0) {
        contextPart = text.slice(0, separatorIdx).trim();
        metaPart = text.slice(separatorIdx + 5).trim();
    } else if (text.startsWith('---\n') || text === '---') {
        contextPart = '';
        metaPart = text.replace(/^---\n?/, '').trim();
    }

    const extract = (label: string): string | null => {
        const regex = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, 'i');
        const match = metaPart.match(regex);
        return match?.[1]?.trim() || null;
    };

    return {
        context: contextPart || null,
        notes: extract('Notes'),
        waiting_on: extract('Waiting On'),
        location: extract('Location'),
    };
}

/**
 * Get a custom field value by name from a ClickUp task.
 */
function getCustomFieldValue(task: ClickUpTask, fieldName: string): string | null {
    const field = task.custom_fields?.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
    if (!field || field.value === null || field.value === undefined) return null;
    return String(field.value);
}

/**
 * Map a ClickUp task to our internal task model.
 */
export function mapClickUpTask(task: ClickUpTask): MappedTask {
    const isClosed = task.status.type === 'closed' || task.date_closed != null;
    const isAbandoned = task.status.status.toLowerCase() === 'abandoned';

    let status: 'open' | 'done' | 'abandoned' = 'open';
    if (isAbandoned) status = 'abandoned';
    else if (isClosed) status = 'done';

    // Parse structured description into separate fields
    const descFields = parseDescription(task.description);

    return {
        clickup_id: task.id,
        name: task.name,
        category: task.list?.name ?? 'Uncategorized',
        status,
        clickup_status: task.status?.status?.toLowerCase() ?? 'to do',
        priority: task.priority ? (PRIORITY_MAP[task.priority.id] ?? null) : null,
        due_date: task.due_date ? new Date(Number(task.due_date)).toISOString().slice(0, 10) : null,
        waiting_on: getCustomFieldValue(task, 'waiting_on') ?? descFields.waiting_on,
        notes: getCustomFieldValue(task, 'notes') ?? descFields.notes,
        context: descFields.context,
        location: getCustomFieldValue(task, 'location') ?? descFields.location,
        parent_task: task.parent ?? null,
        tags: task.tags?.map(t => t.name) ?? [],
        progress: 0,
        created_at: new Date(Number(task.date_created)).toISOString(),
        completed_at: task.date_closed ? new Date(Number(task.date_closed)).toISOString() : null,
        url: task.url,
    };
}

/**
 * Map all tasks from ClickUp to our internal model.
 */
export function mapAllTasks(tasks: ClickUpTask[]): MappedTask[] {
    return tasks.map(mapClickUpTask);
}

// ─── List ↔ Category Mapping ─────────────────────────────────────────────────

// Categories to create as ClickUp lists (matching current catColors in tasks page)
export const CATEGORY_LIST_NAMES = [
    'Wedding',
    'THA',
    'Home',
    'Fitness',
    'Finance',
    'Personal',
    'Dev',
];

/**
 * Ensure all category lists exist in the ClickUp space.
 * Returns a map of category name → list ID.
 */
export async function ensureCategoryLists(): Promise<Map<string, string>> {
    const existingLists = await getLists();
    const listMap = new Map<string, string>();

    for (const list of existingLists) {
        listMap.set(list.name, list.id);
    }

    for (const category of CATEGORY_LIST_NAMES) {
        if (!listMap.has(category)) {
            const newList = await createList(category);
            listMap.set(category, newList.id);
        }
    }

    return listMap;
}

/**
 * Find the list ID for a given category name.
 * Returns null if the category doesn't exist as a list.
 */
export async function getListIdForCategory(category: string): Promise<string | null> {
    const lists = await getLists();
    const match = lists.find(l => l.name.toLowerCase() === category.toLowerCase());
    return match?.id ?? null;
}

// ─── Convenience Exports ─────────────────────────────────────────────────────

export { TEAM_ID, SPACE_ID, REVERSE_PRIORITY_MAP, PRIORITY_MAP };
