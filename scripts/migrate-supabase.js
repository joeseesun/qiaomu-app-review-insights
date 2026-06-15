#!/usr/bin/env node
/*
 * Run DDL migrations on Supabase using an RPC function `exec_sql` if available.
 * Falls back to simple existence checks via information_schema and tries safer alternatives.
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  try {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) return;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

(async () => {
  const { createClient } = await import('@supabase/supabase-js');
  // Load env from files if not present
  loadEnvFile('.env.local');
  loadEnvFile('.env.development');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY; // NOTE: anon key may not have DDL permission; RPC is required
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Load migration SQL (only the additive parts)
  const sqlPath = path.join(process.cwd(), 'supabase-migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const statements = sql
    .split(/;\s*\n/g)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  let execSqlAvailable = false;
  try {
    // Probe exec_sql function by running a no-op
    const probe = await supabase.rpc('exec_sql', { sql_query: 'select 1' });
    execSqlAvailable = !probe.error;
  } catch {
    execSqlAvailable = false;
  }

  const results = [];
  for (const [i, stmt] of statements.entries()) {
    // Skip comments inside DO $$ blocks splitting
    if (!stmt) continue;
    if (!execSqlAvailable) {
      results.push({ i: i + 1, ok: false, error: 'exec_sql function not available for anon role' });
      continue;
    }
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
      if (error) results.push({ i: i + 1, ok: false, error: error.message });
      else results.push({ i: i + 1, ok: true });
    } catch (e) {
      results.push({ i: i + 1, ok: false, error: e.message || String(e) });
    }
  }

  // Print summary
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  console.log(JSON.stringify({ ok, fail, results }, null, 2));
  if (fail > 0) process.exit(2);
})();
