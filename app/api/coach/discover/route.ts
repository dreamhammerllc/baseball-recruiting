export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { apiError } from '@/lib/apiError';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function n(v: string | null): number | null {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

const THROWS_MAP: Record<string, string> = { RHT: 'R', LHT: 'L' };
const BATS_MAP:   Record<string, string> = { RH: 'R', LH: 'L', Switch: 'S' };

// athlete_metrics-backed filters: every filter here triggers an "athletes whose
// personal-best for this metric_key satisfies a comparator" subquery, then JS
// intersection across all metric filters. Keeps zero SQL JOINs (PGRST125-safe).
type Cmp = 'gte' | 'lte';
interface MetricFilter { metricKey: string; cmp: Cmp; value: number; }

export async function GET(req: NextRequest) {
  try {
    const { userId: coachClerkId } = await auth();
    if (!coachClerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();

    const { data: coachRow, error: coachErr } = await db
      .from('coaches')
      .select('id')
      .eq('clerk_user_id', coachClerkId)
      .maybeSingle();
    if (coachErr) throw coachErr;

    const sp = req.nextUrl.searchParams;

    // ── Filters mapped to athletes columns ───────────────────────────────────
    const colFilters = {
      position:        sp.get('position')?.trim() || null,
      gradYearMin:     n(sp.get('gradYearMin')),
      gradYearMax:     n(sp.get('gradYearMax')),
      state:           sp.get('state')?.trim().toUpperCase() || null,
      throws:          sp.get('throws')?.trim() || null,
      bats:            sp.get('bats')?.trim()   || null,
      gpaMin:          n(sp.get('gpaMin')),
      gpaMax:          n(sp.get('gpaMax')),
      sixtyMax:        n(sp.get('sixtyMax')),
      armStrengthMin:  n(sp.get('armStrengthMin')),
      exitVeloMin:     n(sp.get('exitVeloMin')),
      battingAvgMin:   n(sp.get('battingAvgMin')),
      fbVeloMin:       n(sp.get('fbVeloMin')),
      eraMax:          n(sp.get('eraMax')),
      inningsMin:      n(sp.get('inningsMin')),
      popTimeMax:      n(sp.get('popTimeMax')),
      satMin:          n(sp.get('satMin')),
      actMin:          n(sp.get('actMin')),
    };

    // ── Filters that route through athlete_metrics (no athletes column) ──────
    const metricFilters: MetricFilter[] = [
      ['vertJumpMin',     'vertical_jump',      'gte'],
      ['batSpeedMin',     'bat_speed',          'gte'],
      ['launchAngleMin',  'launch_angle',       'gte'],
      ['launchAngleMax',  'launch_angle',       'lte'],
      ['distanceMin',     'distance',           'gte'],
      ['curveVeloMin',    'curveball_velocity', 'gte'],
      ['sliderVeloMin',   'slider_velocity',    'gte'],
    ].flatMap(([param, metricKey, cmp]) => {
      const v = n(sp.get(param as string));
      return v == null ? [] : [{ metricKey: metricKey as string, cmp: cmp as Cmp, value: v }];
    });

    const sort   = sp.get('sort')   ?? 'newest';
    const offset = Math.max(0, n(sp.get('offset')) ?? 0);
    const limit  = Math.min(MAX_LIMIT, Math.max(1, n(sp.get('limit')) ?? DEFAULT_LIMIT));

    // ── Q1: athletes already connected to this coach (exclude) ───────────────
    const { data: conns, error: connErr } = await db
      .from('coach_athlete_connections')
      .select('athlete_id')
      .eq('coach_id', coachClerkId);
    if (connErr) throw connErr;
    const excludedIds = (conns ?? []).map(c => c.athlete_id as string);

    // ── Q2: resolve metric_filters → intersection of allowed clerk_user_ids ──
    let metricAllowedIds: Set<string> | null = null;
    for (const f of metricFilters) {
      let mq = db
        .from('athlete_metrics')
        .select('athlete_clerk_id')
        .eq('metric_key', f.metricKey)
        .eq('is_personal_best', true);
      mq = f.cmp === 'gte' ? mq.gte('value', f.value) : mq.lte('value', f.value);
      const { data, error } = await mq;
      if (error) throw error;
      const ids: Set<string> = new Set((data ?? []).map(r => r.athlete_clerk_id as string));
      if (metricAllowedIds === null) {
        metricAllowedIds = ids;
      } else {
        const intersect = new Set<string>();
        for (const x of metricAllowedIds) if (ids.has(x)) intersect.add(x);
        metricAllowedIds = intersect;
      }
      if (metricAllowedIds.size === 0) {
        return NextResponse.json({ results: [], total: 0, hasMore: false });
      }
    }

    // ── Q3: athletes with all column filters + exclusions + metric scope ─────
    let q = db
      .from('athletes')
      .select(
        'clerk_user_id, username, first_name, last_name, photo_url, position, secondary_position, grad_year, home_state, bats, throws, gpa_unweighted, sixty_yard_dash_seconds, fastball_velocity_mph, exit_velocity_mph, verification_tier, created_at',
        { count: 'exact' },
      );

    if (excludedIds.length) q = q.not('clerk_user_id', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`);
    if (metricAllowedIds)   q = q.in('clerk_user_id', [...metricAllowedIds]);

    if (colFilters.position)       q = q.eq('position', colFilters.position);
    if (colFilters.gradYearMin != null) q = q.gte('grad_year', colFilters.gradYearMin);
    if (colFilters.gradYearMax != null) q = q.lte('grad_year', colFilters.gradYearMax);
    if (colFilters.state)          q = q.eq('home_state', colFilters.state);
    if (colFilters.throws && THROWS_MAP[colFilters.throws]) q = q.eq('throws', THROWS_MAP[colFilters.throws]);
    if (colFilters.bats   && BATS_MAP[colFilters.bats])     q = q.eq('bats',   BATS_MAP[colFilters.bats]);
    if (colFilters.gpaMin    != null) q = q.gte('gpa_unweighted',           colFilters.gpaMin);
    if (colFilters.gpaMax    != null) q = q.lte('gpa_unweighted',           colFilters.gpaMax);
    if (colFilters.sixtyMax  != null) q = q.lte('sixty_yard_dash_seconds',  colFilters.sixtyMax);
    if (colFilters.armStrengthMin != null) q = q.gte('arm_strength',         colFilters.armStrengthMin);
    if (colFilters.exitVeloMin    != null) q = q.gte('exit_velocity_mph',    colFilters.exitVeloMin);
    if (colFilters.battingAvgMin  != null) q = q.gte('batting_avg',          colFilters.battingAvgMin);
    if (colFilters.fbVeloMin      != null) q = q.gte('fastball_velocity_mph',colFilters.fbVeloMin);
    if (colFilters.eraMax         != null) q = q.lte('era',                  colFilters.eraMax);
    if (colFilters.inningsMin     != null) q = q.gte('innings_pitched',      colFilters.inningsMin);
    if (colFilters.popTimeMax     != null) q = q.lte('pop_time',             colFilters.popTimeMax);
    if (colFilters.satMin         != null) q = q.gte('sat_score',            colFilters.satMin);
    if (colFilters.actMin         != null) q = q.gte('act_score',            colFilters.actMin);

    if (sort === 'gradYearAsc') {
      q = q.order('grad_year',      { ascending: true,  nullsFirst: false });
    } else if (sort === 'gpaDesc') {
      q = q.order('gpa_unweighted', { ascending: false, nullsFirst: false });
    } else {
      q = q.order('created_at',     { ascending: false, nullsFirst: false });
    }

    q = q.range(offset, offset + limit - 1);

    const { data: athletes, count, error: athErr } = await q;
    if (athErr) throw athErr;
    const rows = athletes ?? [];

    // ── Q4: which of these are already saved? ────────────────────────────────
    let savedSet = new Set<string>();
    if (coachRow?.id && rows.length) {
      const ids = rows.map(r => r.clerk_user_id as string);
      const { data: saved, error: savedErr } = await db
        .from('saved_athletes')
        .select('athlete_clerk_id')
        .eq('coach_id', coachRow.id)
        .in('athlete_clerk_id', ids);
      if (savedErr) throw savedErr;
      savedSet = new Set((saved ?? []).map(s => s.athlete_clerk_id as string));
    }

    const results = rows.map(r => ({
      clerk_user_id:      r.clerk_user_id,
      username:           r.username,
      first_name:         r.first_name,
      last_name:          r.last_name,
      photo_url:          r.photo_url,
      position:           r.position,
      secondary_position: r.secondary_position,
      graduationYear:     r.grad_year,
      state:              r.home_state,
      bats:               r.bats,
      throws:             r.throws,
      gpa:                r.gpa_unweighted,
      sixty_yard:         r.sixty_yard_dash_seconds,
      fb_velo:            r.fastball_velocity_mph,
      exit_velo:          r.exit_velocity_mph,
      verification_tier:  r.verification_tier,
      is_saved:           savedSet.has(r.clerk_user_id as string),
    }));

    return NextResponse.json({
      results,
      total:   count ?? results.length,
      hasMore: (offset + results.length) < (count ?? 0),
    });
  } catch (e) {
    console.error('[GET /api/coach/discover]', e);
    return apiError('Failed to discover athletes.', e);
  }
}
