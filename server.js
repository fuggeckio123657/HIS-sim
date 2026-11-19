#!/usr/bin/env node
/* 診所版區網同步伺服器（零相依，只需 Node 16+）。
 *   node server.js [埠號=8080]   然後同網路的裝置開啟 http://<本機區網IP>:埠號/
 * 作法：各端的業務規則仍在瀏覽器內執行，伺服器負責「保存資料 + 轉送變更」。
 * 資料存於 ./data/<版本>.json。沒有登入驗證，僅供教學／區網展示，請勿放上公開網路。 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10), DIR = __dirname, DATA = path.join(DIR, 'data');
fs.mkdirSync(DATA, { recursive: true });
const EDS = ['clinic', 'hospital'], MAXLOG = 20000, state = {}, clients = {};
const fileOf = ed => path.join(DATA, ed + '.json');
EDS.forEach(ed => { state[ed] = { snap: null, seq: 0, log: [], timer: null }; try { const j = JSON.parse(fs.readFileSync(fileOf(ed), 'utf8')); state[ed].snap = j.snap; state[ed].seq = j.seq || 0; } catch (e) { /* 尚無資料 */ } });
const save = ed => { const s = state[ed]; if (s.timer) return; s.timer = setTimeout(() => { s.timer = null; const tmp = fileOf(ed) + '.tmp'; fs.writeFile(tmp, JSON.stringify({ snap: s.snap, seq: s.seq }), err => { if (!err) fs.rename(tmp, fileOf(ed), () => { }); }); }, 400); };
const apply = (s, op) => { const tb = s.snap[op.t] || (s.snap[op.t] = []); if (op.o === 'i') { if (!tb.some(r => r.id === op.row.id)) tb.push(op.row); } else { const r = tb.find(x => x.id === op.id); if (r) Object.assign(r, op.patch); } };
const send = (res, code, obj) => { const b = typeof obj === 'string' ? obj : JSON.stringify(obj); res.writeHead(code, { 'Content-Type': typeof obj === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(b); };
const body = req => new Promise((ok, no) => { let n = 0; const c = []; req.on('data', d => { n += d.length; if (n > 200e6) { no(new Error('too big')); req.destroy(); } else c.push(d); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch (e) { no(e); } }); req.on('error', no); });
const touch = (ed, c) => { if (c) clients[ed + ':' + c] = Date.now(); };
const online = ed => Object.keys(clients).filter(k => k.startsWith(ed + ':') && Date.now() - clients[k] < 8000).length;

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname, ed = u.searchParams.get('ed') || 'clinic', c = u.searchParams.get('c') || '';
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST' }); return res.end(); }
    if (p === '/' || p === '/his.html' || p === '/index.html') return fs.readFile(path.join(DIR, 'his.html'), (e, d) => e ? send(res, 500, '找不到 his.html（請與 server.js 放在同一資料夾）') : (res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }), res.end(d)));
    if (!p.startsWith('/api/')) return send(res, 404, { error: 'not found' });
    if (!state[ed]) return send(res, 400, { error: 'bad edition' }); const s = state[ed];
    if (p === '/api/ping') { touch(ed, c); return send(res, 200, { ok: true, server: 'his-sync', ready: !!s.snap, seq: s.seq, online: online(ed) }); }
    if (p === '/api/state' && req.method === 'GET') { touch(ed, c); return send(res, 200, { ready: !!s.snap, snap: s.snap, seq: s.seq }); }
    if (p === '/api/state' && req.method === 'POST') { const b = await body(req); if (s.snap) return send(res, 409, { error: 'already initialised', seq: s.seq }); if (!b.snap || !b.snap.patients) return send(res, 400, { error: 'bad snapshot' }); s.snap = b.snap; s.seq = 1; s.log = []; save(ed); return send(res, 200, { ok: true, seq: s.seq }); }
    if (p === '/api/reset' && req.method === 'POST') { s.snap = null; s.seq = s.seq + 1; s.log = []; save(ed); try { fs.unlinkSync(fileOf(ed)); } catch (e) { } return send(res, 200, { ok: true }); }
    if (p === '/api/ops' && req.method === 'POST') { if (!s.snap) return send(res, 409, { error: 'not initialised' }); touch(ed, c); const b = await body(req); (b.ops || []).forEach(op => { apply(s, op); s.seq++; s.log.push({ seq: s.seq, c, op }); }); if (s.log.length > MAXLOG) s.log.splice(0, s.log.length - MAXLOG); save(ed); return send(res, 200, { ok: true, seq: s.seq }); }
    if (p === '/api/ops' && req.method === 'GET') { touch(ed, c); const since = parseInt(u.searchParams.get('since') || '0', 10); if (!s.snap) return send(res, 200, { reset: true, seq: s.seq, ops: [] }); if (since > s.seq || (s.log.length ? since < s.log[0].seq - 1 : since !== s.seq)) return send(res, 200, { resync: true, seq: s.seq, ops: [] }); return send(res, 200, { seq: s.seq, online: online(ed), ops: s.log.filter(e => e.seq > since && e.c !== c).map(e => e.op) }); }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n診所版同步伺服器已啟動（資料資料夾：' + DATA + '）\n  本機：      http://localhost:' + PORT + '/');
  Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).forEach(i => console.log('  同網路裝置： http://' + i.address + ':' + PORT + '/'));
  console.log('\n（教學用：無登入驗證，請勿暴露於公開網路。Ctrl+C 結束）\n');
});
