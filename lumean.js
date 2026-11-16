// Lumean TTS client. The API key is read from LUMEAN_API_KEY (process env or HKCU\Environment) and never printed.
// Usage:
//   node lumean.js key                         — key info and permissions
//   node lumean.js usage                       — remaining quota
//   node lumean.js templates                   — my TTS templates
//   node lumean.js voices <service> [search]   — voice catalogue: elevenlabs | cartesia | fishaudio | lumvoice
//   node lumean.js options <service>           — template config options
//   node lumean.js template <service> <voice_id> <name> [model] [lang]   — create a TTS template
//   node lumean.js say <template_id> "<text>" <out.mp3> [voice_id | override_json_file]  — voice text into a file (PAID)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const BASE = 'https://api.lumean.app/api/public';

// Lumean is unreachable through the Happ VPN tunnel, so requests go through curl.exe bound to the physical
// network card (curl --interface), which bypasses the tunnel. Falls back to the default route if no such card.
function physicalIp() {
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/happ|xray|tun|tap|vpn|wintun|loopback/i.test(name)) continue;
    const a = (addrs || []).find(x => x.family === 'IPv4' && !x.internal && !x.address.startsWith('169.254.'));
    if (a) return a.address;
  }
  return null;
}
const IFACE = process.env.LUMEAN_IFACE || physicalIp();
async function fetch(url, opt = {}) {
  const tmp = path.join(os.tmpdir(), `lumean_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const args = ['-s', '-S', '--max-time', '120', '-X', opt.method || 'GET', '-o', tmp, '-D', tmp + '.h', '-w', '%{http_code}'];
  if (IFACE) args.push('--interface', IFACE);
  for (const [k, v] of Object.entries(opt.headers || {})) args.push('-H', `${k}: ${v}`);
  if (opt.body) args.push('--data-binary', '@-');
  args.push(url);
  const status = parseInt(execFileSync('curl.exe', args, { input: opt.body || undefined, encoding: 'utf8', maxBuffer: 1 << 20 }).trim(), 10);
  const buf = fs.existsSync(tmp) ? fs.readFileSync(tmp) : Buffer.alloc(0);
  const head = fs.existsSync(tmp + '.h') ? fs.readFileSync(tmp + '.h', 'utf8') : '';
  for (const f of [tmp, tmp + '.h']) try { fs.unlinkSync(f); } catch {}
  return {
    ok: status >= 200 && status < 300, status,
    text: async () => buf.toString('utf8'), arrayBuffer: async () => buf,
    headers: { get: n => ((head.match(new RegExp(`^${n}:\\s*(.+)$`, 'im')) || [])[1] || null) },
  };
}

function apiKey() {
  if (process.env.LUMEAN_API_KEY) return process.env.LUMEAN_API_KEY.trim();
  try {
    const out = execSync('reg query HKCU\\Environment /v LUMEAN_API_KEY', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/LUMEAN_API_KEY\s+REG_\w+\s+(\S+)/);
    if (m) return m[1].trim();
  } catch {}
  throw new Error('LUMEAN_API_KEY is not set');
}

async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'X-API-KEY': apiKey(), 'Accept': 'application/json', 'X-Timezone': 'Europe/Moscow', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const err = new Error(`${method} ${p} -> HTTP ${res.status}: ${json.message || ''} ${json.reason ? '(' + json.reason + ')' : ''}`);
    err.status = res.status; err.body = json; err.retryAfter = res.headers.get('retry-after');
    throw err;
  }
  return json.data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const FINAL = ['completed', 'result_delivered', 'failed', 'cancelled', 'compensated'];

async function say(templateId, text, out, voiceId) {
  const body = { template_id: templateId, input_text: text };
  if (voiceId && voiceId.trim().startsWith('{')) body.config_override = JSON.parse(voiceId);
  else if (voiceId) body.config_override = { tts_settings: { voice_id: voiceId } };
  const order = await api('POST', '/orders', body);
  console.log('order', order.id, order.status);
  let o = order;
  for (let i = 0; i < 180; i++) {
    await sleep(i < 5 ? 2000 : 4000);
    o = await api('GET', `/orders/${order.id}`);
    process.stdout.write(`\r${o.status}        `);
    if (FINAL.includes(o.status) || o.status === 'partially_completed') break;
  }
  console.log();
  if (!['completed', 'result_delivered'].includes(o.status)) {
    console.log('order not completed:', o.status, o.result && o.result.user_message);
    process.exitCode = 1; return;
  }
  const files = (o.result && o.result.files) || [];
  if (!files.length) throw new Error('no result files');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const { url } = await api('POST', '/storage/url', { path: files[0] });
  const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(out, bin);
  console.log('saved', out, bin.length, 'bytes');
  for (const sp of (o.result.service_files || [])) {
    if (!/\.srt$/i.test(sp)) continue;
    const r = await api('POST', '/storage/url', { path: sp });
    const srt = out.replace(/\.\w+$/, '.srt');
    fs.writeFileSync(srt, Buffer.from(await (await fetch(r.url)).arrayBuffer()));
    console.log('saved', srt);
  }
}

function brief(v) {
  return {
    voice_id: v.voice_id || v.id, name: v.name || v.display_name || v.voice_name || v.nickname,
    gender: v.gender || (v.labels && v.labels.gender), lang: v.language || v.language_code || (v.labels && v.labels.language),
    desc: (v.description || '').slice(0, 80),
  };
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'key') {
    const d = await api('GET', '/key');
    console.log(JSON.stringify({ name: d.name, permissions: d.permissions, expires_at: d.expires_at, limits: d.limits || d.rate_limit }, null, 1));
  } else if (cmd === 'usage') {
    console.log(JSON.stringify(await api('GET', '/usage'), null, 1).slice(0, 3000));
  } else if (cmd === 'templates') {
    const d = await api('GET', '/templates?page=1&per_page=30');
    for (const t of d.items) console.log(t.id, '|', t.name, '|', t.service_key || (t.service && t.service.code), '|', t.config && t.config.tts_settings && t.config.tts_settings.voice_id);
    console.log('total', d.total);
  } else if (cmd === 'voices') {
    const [svc, search = ''] = a, q = encodeURIComponent(search);
    let list;
    if (svc === 'elevenlabs') list = (await api('GET', `/voices/elevenlabs/library?page=0&page_size=25&search=${q}`)).voices;
    else if (svc === 'cartesia') list = (await api('GET', `/voices/cartesia?language=ru&per_page=40&search=${q}`)).items;
    else if (svc === 'fishaudio') list = (await api('GET', `/voices/fishaudio?language=ru&per_page=40&search=${q}`)).items;
    else list = (await api('GET', `/voices/public?language_code=ru&per_page=40&search=${q}`)).items;
    for (const v of list) console.log(JSON.stringify(brief(v)));
  } else if (cmd === 'options') {
    console.log(JSON.stringify(await api('GET', `/templates/config-options?service=${a[0]}`), null, 1).slice(0, 6000));
  } else if (cmd === 'template') {
    const [svc, voiceId, name, model, lang = 'ru'] = a;
    let config;
    if (svc === 'cartesia') config = { tts_settings: { voice_id: voiceId, model_id: model || 'sonic-3', language_code: lang } };
    else config = { tts_settings: { mode: 'mode_v1', model_id: model || 'eleven_multilingual_v2', voice_id: voiceId, language_code: lang, advanced_voice_settings: true, voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true, speed: 1.0 } } };
    const d = await api('POST', '/templates', { service_key: svc, name, config });
    console.log('template', d.id, d.name);
  } else if (cmd === 'say') {
    const ov = a[3] && fs.existsSync(a[3]) ? fs.readFileSync(a[3], 'utf8') : a[3];
    await say(a[0], a[1], a[2], ov);
  } else {
    console.log('commands: key | usage | templates | voices <service> [search] | options <service> | template ... | say ...');
  }
}
main().catch(e => { console.error(e.message); if (e.body && e.body.errors) console.error(JSON.stringify(e.body.errors)); process.exitCode = 1; });
