#!/usr/bin/env node
// Regression checks never invoke a write-capable tool with --allow-write.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('./surge.mjs', import.meta.url));
const cases = [
  ['unauthorized_write', ['call', 'surge_toggle_feature', '--args', '{"feature":"capture","enabled":false}'], 'WRITE_REQUIRES_ALLOW_WRITE'],
  ['invalid_enum', ['call', 'surge_get_feature_status', '--args', '{"feature":"bad"}'], 'INVALID_ARGUMENT'],
  ['invalid_boolean', ['call', 'surge_toggle_feature', '--args', '{"feature":"capture","enabled":"false"}', '--allow-write'], 'INVALID_ARGUMENT'],
  ['extra_field', ['call', 'surge_get_outbound_mode', '--args', '{"extra":true}'], 'UNKNOWN_ARGUMENT'],
  ['missing_required', ['call', 'surge_get_feature_status'], 'MISSING_ARGUMENT'],
  ['unknown_tool', ['call', 'unknown_tool'], 'UNKNOWN_TOOL'],
  ['evaluate_is_write', ['call', 'surge_evaluate_script', '--args', '{"script_name":"test","type":"cron"}'], 'WRITE_REQUIRES_ALLOW_WRITE'],
  ['probe_is_write', ['call', 'surge_test_policy', '--args', '{"url":"https://example.com/"}'], 'WRITE_REQUIRES_ALLOW_WRITE'],
  ['path_injection', ['call', 'surge_get_policy_group', '--args', '{"group_name":"x?y"}'], 'UNSAFE_PATH_ARGUMENT'],
  ['bad_json', ['call', 'surge_get_outbound_mode', '--args', '{'], 'INVALID_JSON']
];
let passed = 0;
for (const [name, args, error] of cases) {
  // Impossible deployment and absent credential prove validation precedes any
  // MCP connection/server launch, even when caller supplies --allow-write.
  const r = spawnSync(process.execPath, [cli, ...args], {
    env: { PATH: process.env.PATH, SURGE_MCP_ROOT: '/nonexistent/surge-preflight-test' },
    encoding: 'utf8', timeout: 5000
  });
  let body; try { body = JSON.parse(r.stdout); } catch {}
  const ok = r.status === 1 && body?.error === error && body.phase === 'preflight' && body.writeMayHaveApplied === false;
  console.log(JSON.stringify({ test: name, passed: ok }));
  if (ok) passed++;
}
console.log(JSON.stringify({ passed, total: cases.length, realWriteCalls: 0 }));
if (passed !== cases.length) process.exitCode = 1;
