#!/usr/bin/env node
// Local MCP stdio client. Never print raw responses, arguments, stderr or exceptions.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
const ROOT = process.env.SURGE_MCP_ROOT || fileURLToPath(new URL('../../../.local/surge-mcp-server/', import.meta.url));
const ENTRY = process.env.SURGE_MCP_ENTRY || path.join(ROOT, 'dist/index.js');
const features = ['mitm', 'capture', 'rewrite', 'scripting'];
// ! = required; remaining strings enumerate values. Empty rule = nonempty string.
const catalog = {
  surge_get_feature_status: ['read', { 'feature!': features }],
  surge_toggle_feature: ['write', { 'feature!': features, 'enabled!': 'boolean' }],
  surge_get_outbound_mode: ['read', {}],
  surge_set_outbound_mode: ['write', { 'mode!': ['direct', 'proxy', 'rule'] }],
  surge_list_policies: ['read', {}],
  surge_get_policy_group: ['read', { 'group_name!': '' }],
  surge_test_policy: ['write', { 'url!': '' }],
  surge_set_policy_group: ['write', { 'group_name!': '', 'policy!': '' }],
  surge_list_requests: ['read', { type: ['recent', 'active'] }],
  surge_kill_request: ['write', { 'request_id!': '' }],
  surge_get_profile: ['read', {}],
  surge_reload_profile: ['write', {}],
  surge_flush_dns: ['write', {}],
  surge_list_modules: ['read', {}],
  surge_toggle_module: ['write', { 'module_name!': '', 'enabled!': 'boolean' }],
  surge_list_scripts: ['read', {}],
  surge_evaluate_script: ['write', { 'script_name!': '', 'type!': ['http-request', 'http-response', 'cron', 'event', 'rule', 'dns'], timeout: 'number' }],
  surge_list_devices: ['read', {}],
  surge_modify_device: ['write', { 'physical_address!': '', name: '', address: '', should_handled_by_surge: 'boolean' }]
};
const output = value => console.log(JSON.stringify(value, null, 2));
const fail = code => { const e = new Error(code); e.safeCode = code; throw e; };
let phase = 'preflight', sentWrite = false, deadlineExpired = false, client, transport, deadline;
function localValidate(name, args) {
  const spec = catalog[name];
  if (!spec) fail('UNKNOWN_TOOL');
  if (!args || Array.isArray(args) || typeof args !== 'object') fail('INVALID_ARGUMENTS');
  const allowed = new Set();
  for (const [field, rule] of Object.entries(spec[1])) {
    const key = field.replace(/!$/, ''); allowed.add(key);
    if (!(key in args)) { if (field.endsWith('!')) fail('MISSING_ARGUMENT'); else continue; }
    const v = args[key];
    if (Array.isArray(rule) ? !rule.includes(v) : rule === 'boolean' ? typeof v !== 'boolean' : rule === 'number' ? typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 20 : typeof v !== 'string' || !v.trim() || v.length > 4096 || /[\x00-\x1f]/.test(v)) fail('INVALID_ARGUMENT');
  }
  if (Object.keys(args).some(k => !allowed.has(k))) fail('UNKNOWN_ARGUMENT');
  // Upstream interpolates these fields into URL paths/queries without encoding.
  for (const k of ['group_name', 'module_name', 'request_id']) {
    if (k in args && /[/?#%\\&=]/.test(args[k])) fail('UNSAFE_PATH_ARGUMENT');
  }
  if (name === 'surge_test_policy') {
    let u; try { u = new URL(args.url); } catch { fail('INVALID_URL'); }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) fail('UNSAFE_TEST_URL');
  }
  if (name === 'surge_modify_device') {
    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(args.physical_address)) fail('INVALID_MAC');
    if ('address' in args && !net.isIP(args.address)) fail('INVALID_IP');
    if (Object.keys(args).length < 2) fail('NO_DEVICE_CHANGE');
  }
}
function summarize(name, result) {
  if (result.isError) fail('TOOL_FAILED');
  let data;
  try { data = JSON.parse(result.content?.find(x => x.type === 'text')?.text); } catch {}
  if (name === 'surge_get_outbound_mode') return { mode: ['direct', 'proxy', 'rule'].includes(data?.mode) ? data.mode : 'unrecognized' };
  if (name === 'surge_get_feature_status') return { enabled: typeof data?.enabled === 'boolean' ? data.enabled : 'unrecognized' };
  if (name === 'surge_get_profile') return { received: true, profileContent: '[withheld: configuration/subscriptions/secrets]' };
  // Fail-closed summary: never traverse/print strings or dynamic keys. This
  // intentionally withholds names, URLs (including query/userinfo), headers,
  // cookies, credentials, device identifiers and nested configuration.
  const summary = { received: true, details: '[withheld: privacy-safe summary only]' };
  if (Array.isArray(data)) summary.count = data.length;
  else if (data && typeof data === 'object') {
    for (const k of ['modules', 'policies', 'requests', 'scripts', 'devices']) {
      if (Array.isArray(data[k])) summary[k + 'Count'] = data[k].length;
    }
    if (name === 'surge_list_modules') {
      const items = Array.isArray(data) ? data : data.modules;
      if (Array.isArray(items)) summary.enabledCount = items.filter(x => x?.enabled === true).length;
    }
  }
  return summary;
}
function killChild(signal) { try { if (transport?.pid) process.kill(transport.pid, signal); } catch {} }
try {
  const argv = process.argv.slice(2);
  const command = argv.shift();
  if (command === '--help' || command === 'help') {
    output({ usage: 'surge.mjs tools | status | call TOOL [--args JSON | --args-file FILE] [--allow-write] [--timeout-ms 1000..60000]', privacy: 'Summary only; no raw output or raw result files.' });
  } else {
    if (!['tools', 'status', 'call'].includes(command)) fail('INVALID_COMMAND');
    const name = command === 'call' ? argv.shift() : undefined;
    let args = {}, allowWrite = false, timeout = 15000, source;
    const seen = new Set();
    while (argv.length) {
      const flag = argv.shift();
      if (seen.has(flag)) fail('DUPLICATE_OPTION'); seen.add(flag);
      if (flag === '--allow-write') { allowWrite = true; continue; }
      if (!['--args', '--args-file', '--timeout-ms'].includes(flag) || !argv.length) fail('INVALID_OPTION');
      const value = argv.shift();
      if (flag === '--timeout-ms') { timeout = Number(value); if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) fail('INVALID_TIMEOUT'); }
      else { if (source) fail('CONFLICTING_ARGUMENT_SOURCES'); source = [flag, value]; }
    }
    if (command !== 'call' && (source || allowWrite)) fail('INVALID_OPTION_FOR_COMMAND');
    if (source) {
      let text = source[1];
      if (source[0] === '--args-file') text = await readFile(text, 'utf8');
      if (Buffer.byteLength(text) > 65536) fail('ARGUMENTS_TOO_LARGE');
      try { args = JSON.parse(text); } catch { fail('INVALID_JSON'); }
    }
    if (command === 'call') {
      localValidate(name, args);
      if (catalog[name][0] !== 'read' && !allowWrite) fail('WRITE_REQUIRES_ALLOW_WRITE');
    }
    if (!process.env.SURGE_API_KEY?.trim()) fail('MISSING_SURGE_API_KEY');
    if (!path.isAbsolute(ROOT) || !path.isAbsolute(ENTRY)) fail('ABSOLUTE_DEPLOYMENT_PATH_REQUIRED');
    try { await access(ENTRY); await access(path.join(ROOT, 'package.json')); } catch { fail('DEPLOYMENT_MISSING_REBUILD_REQUIRED'); }
    const host = process.env.SURGE_HOST || '127.0.0.1';
    const port = process.env.SURGE_PORT || '6171';
    if (!/^[a-zA-Z0-9.-]+$/.test(host) || !/^\d+$/.test(port) || +port < 1 || +port > 65535) fail('INVALID_SURGE_ENDPOINT');
    let Client, StdioClientTransport, Ajv;
    try {
      const require = createRequire(path.join(ROOT, 'package.json'));
      ({ Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href));
      ({ StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href));
      Ajv = require('ajv');
    } catch { fail('SDK_OR_AJV_MISSING_REBUILD_REQUIRED'); }
    const env = { SURGE_API_KEY: process.env.SURGE_API_KEY, SURGE_HOST: host, SURGE_PORT: port };
    for (const k of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT']) if (process.env[k]) env[k] = process.env[k];
    client = new Client({ name: 'minis-surge-safe-cli', version: '1.0.0' });
    transport = new StdioClientTransport({ command: process.execPath, args: [ENTRY], cwd: ROOT, env, stderr: 'ignore' });
    phase = 'connecting';
    deadline = setTimeout(() => {
      deadlineExpired = true; process.exitCode = 1;
      killChild('SIGTERM');
      output({ ok: false, error: 'DEADLINE_EXCEEDED', writeMayHaveApplied: sentWrite, action: sentWrite ? 'Read state before any retry; never retry blindly.' : 'No automatic retry.' });
      setTimeout(() => { killChild('SIGKILL'); process.exit(1); }, 250);
    }, timeout);
    await client.connect(transport);
    const tools = []; let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, { timeout });
      tools.push(...page.tools); cursor = page.nextCursor;
      if (tools.length > 100) fail('TOOL_CATALOG_TOO_LARGE');
    } while (cursor);
    const ajv = new Ajv({ allErrors: false, strict: false });
    async function call(tool, values) {
      localValidate(tool, values);
      const found = tools.find(t => t.name === tool);
      if (!found) fail('SERVER_TOOL_MISSING');
      let validate; try { validate = ajv.compile(found.inputSchema); } catch { fail('UNSUPPORTED_TOOL_SCHEMA'); }
      if (!validate(values)) fail('SERVER_SCHEMA_REJECTED');
      phase = 'calling';
      if (catalog[tool][0] !== 'read') sentWrite = true;
      return summarize(tool, await client.callTool({ name: tool, arguments: values }, undefined, { timeout }));
    }
    if (command === 'tools') output({ ok: true, transport: 'stdio', count: tools.length, tools: tools.map(t => catalog[t.name] ? { name: t.name, access: catalog[t.name][0], parameters: Object.entries(catalog[t.name][1]).map(([field, rule]) => ({ name: field.replace(/!$/, ''), required: field.endsWith('!'), ...(Array.isArray(rule) ? { enum: rule } : { type: rule || 'string' }) })) } : { name: '[unrecognized tool blocked]', access: 'blocked' }) });
    else if (command === 'status') {
      const mode = await call('surge_get_outbound_mode', {}), switches = {};
      for (const feature of features) switches[feature] = await call('surge_get_feature_status', { feature });
      output({ ok: true, transport: 'stdio', ...mode, features: switches });
    } else output({ ok: true, transport: 'stdio', tool: name, summary: await call(name, args), ...(sentWrite ? { verificationRequired: true } : {}) });
  }
} catch (e) {
  const safe = e?.safeCode || 'MCP_OR_LOCAL_FAILURE';
  if (!deadlineExpired) output({ ok: false, error: safe, phase, writeMayHaveApplied: sentWrite, action: sentWrite ? 'Do not retry blindly. Read affected state; verify or seek manual recovery.' : 'No automatic retry; raw error suppressed.' });
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  if (transport) {
    const fallback = setTimeout(() => { killChild('SIGKILL'); process.exit(process.exitCode || 0); }, 1000);
    await client?.close().catch(() => {});
    await transport.close().catch(() => {});
    clearTimeout(fallback);
  }
}
