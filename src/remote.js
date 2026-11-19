/* 區網同步用戶端：瀏覽器仍在本機執行所有規則；變更（ops）經由 server.js 轉送給同網路的其他裝置。
 * 若頁面不是由 server.js 提供（例如直接雙擊 his.html），自動維持單機模式。 */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, R = HIS.remote = { active: false, status: '單機', online: 0, tag: null, seq: 0, ed: null, onstatus: null };
const set = (st, extra) => { R.status = st; if (extra && extra.online != null) R.online = extra.online; if (R.onstatus) try { R.onstatus(R); } catch (e) { } };
const j = async (url, opt) => { const r = await fetch(url, Object.assign({ cache: 'no-store' }, opt || {})); let b = null; try { b = await r.json(); } catch (e) { } return { status: r.status, ok: r.ok, body: b }; };
const post = (url, obj) => j(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
let q = [], timer = null, busy = false;

R.probe = async () => {
  if (!/^https?:$/.test(location.protocol)) return false;
  try { const r = await Promise.race([j('/api/ping'), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); return !!(r.ok && r.body && r.body.server === 'his-sync'); } catch (e) { return false; }
};
R.attach = async ed => {
  R.detach(); R.ed = ed; R.tag = Math.random().toString(36).slice(2, 5); q = [];
  const qs = () => `?ed=${ed}&c=${R.tag}`;
  HIS.setEdition(ed, { remote: true, tag: R.tag });
  let st = (await j('/api/state' + qs())).body;
  if (!st.ready) {
    if (ed === 'clinic') HIS.CL.seed(); else HIS.seed();
    const up = await post('/api/state' + qs(), { snap: DB.snapshot() });
    if (up.status === 409) st = (await j('/api/state' + qs())).body, DB.loadSnapshot(st.snap), R.seq = st.seq; else R.seq = up.body.seq;
  } else { DB.loadSnapshot(st.snap); R.seq = st.seq; }
  DB.sink = op => { q.push(op); };
  R.active = true; set('已連線'); loop(); return true;
};
const flush = async () => { if (!q.length) return true; const ops = q.splice(0, q.length); const r = await post(`/api/ops?ed=${R.ed}&c=${R.tag}`, { ops }); if (!r.ok) { q = ops.concat(q); return false; } return true; };
const loop = async () => {
  if (!R.active) return; if (busy) return; busy = true;
  try {
    const okf = await flush(); const r = await j(`/api/ops?ed=${R.ed}&since=${R.seq}&c=${R.tag}`);
    if (r.ok && r.body) {
      if (r.body.resync || r.body.reset) { const s = (await j(`/api/state?ed=${R.ed}&c=${R.tag}`)).body; if (s.ready) { q = []; DB.loadSnapshot(s.snap); R.seq = s.seq; } else { set('伺服器已重設，請重新整理頁面'); R.active = false; busy = false; return; } }
      else { if (r.body.ops.length) DB.applyRemote(r.body.ops); R.seq = r.body.seq; }
      set(okf ? '已連線' : '同步中…', r.body); 
    } else set('連線中斷（重試中）');
  } catch (e) { set('連線中斷（重試中）'); }
  busy = false; timer = setTimeout(loop, 1200);
};
R.detach = () => { R.active = false; DB.sink = null; if (timer) clearTimeout(timer); timer = null; q = []; set('單機'); };
R.resetServer = async () => { if (!R.ed) return; await post(`/api/reset?ed=${R.ed}`, {}); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
