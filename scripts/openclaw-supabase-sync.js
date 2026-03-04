#!/usr/bin/env node
/**
 * scripts/openclaw-supabase-sync.js
 *
 * Run from OpenClaw after data refresh, or via CLI:
 *   node scripts/openclaw-supabase-sync.js data.json
 *
 * Or from OpenClaw internals:
 *   const { sync } = require('/path/to/openclaw-supabase-sync.js');
 *   await sync(clawData);
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://awecwbmcfjlmaykupjyu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY env var is required.');
    console.error('   Set it in your shell or in a .env file next to this script.');
    process.exit(1);
}

const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
};

async function upsert(table, rows) {
    if (!rows) return;
    const body = Array.isArray(rows) ? rows : [rows];
    if (body.length === 0) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`[${table}] ${res.status}: ${text}`);
    }
}

async function sync(data) {
    const today = new Date().toISOString().split('T')[0];
    const log = [];

    // 1. WHOOP daily snapshot + sleep history
    if (data.whoopData) {
        const { today: t, sleep, fetchedAt } = data.whoopData;
        if (t) {
            await upsert('whoop_daily', {
                date: today,
                recovery: t.recovery ?? null,
                hrv: t.hrv ?? null,
                rhr: t.rhr ?? null,
                strain: t.strain ?? null,
                sleep_hours: t.sleepHours ?? null,
                sleep_performance: t.sleepPerf ?? null,
                fetched_at: fetchedAt ?? new Date().toISOString(),
            });
            log.push(`✓ whoop_daily → ${today}`);
        }
        if (sleep?.length) {
            const rows = sleep.map(s => ({
                date: s.date,
                performance: s.performance ?? null,
                efficiency: s.efficiency ?? null,
                hours_in_bed: s.bed ?? null,
                deep: s.deep ?? null,
                rem: s.rem ?? null,
                light: s.light ?? null,
            }));
            await upsert('sleep_log', rows);
            log.push(`✓ sleep_log → ${rows.length} rows`);
        }
    }

    // 2. 75 Hard
    if (data.hardData) {
        const h = data.hardData;
        await upsert('hard75', {
            date: today,
            day: h.day ?? null,
            days_completed: h.daysCompleted ?? null,
            today_complete: h.todayComplete ?? null,
            checks: h.todayChecks ?? null,
            finish_confidence: h.finishConfidence ?? null,
        });
        log.push(`✓ hard75 → day ${h.day}`);

        if (h.disciplineHistory?.length) {
            const rows = h.disciplineHistory.map(d => ({
                date: d.date,
                discipline_score: d.score ?? null,
                today_complete: d.completed ?? null,
            }));
            await upsert('hard75', rows);
            log.push(`✓ hard75 history → ${rows.length} rows`);
        }
    }

    // 3. Tasks / Pile — fresh snapshot each time (history preserved by timestamps)
    if (data.totalOpen !== undefined) {
        await upsert('tasks_pile', {
            updated_at: data.generatedAt ?? new Date().toISOString(),
            total_open: data.totalOpen,
            total_done: data.totalDone ?? 0,
            categories: data.categories ?? null,
            overdue_tasks: data.overdueTasks ?? null,
            history: data.history ?? null,
        });
        log.push(`✓ tasks_pile → ${data.totalOpen} open, ${data.totalDone ?? 0} done`);
    }

    console.log('\n🟢 OpenClaw → Supabase sync complete:');
    log.forEach(l => console.log('  ', l));
    console.log(`  Synced at: ${new Date().toISOString()}\n`);
    return log;
}

// CLI runner
if (require.main === module) {
    const file = process.argv[2];
    if (!file) {
        console.error('Usage: node scripts/openclaw-supabase-sync.js <data.json>');
        process.exit(1);
    }
    const data = JSON.parse(require('fs').readFileSync(file, 'utf-8'));
    sync(data).catch(e => { console.error('❌', e.message); process.exit(1); });
}

module.exports = { sync };
