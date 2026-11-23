// 데이터 저장소: config.js에 Supabase 주소가 있으면 실제 DB, 없으면 시안(데모) 모드
(function () {
  const cfg = window.TSC_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // 사진 줄이기: 긴 변 1600px, JPEG
  function shrink(file, max = 1600, q = 0.8) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? res(b) : rej(new Error('사진 변환 실패'))), 'image/jpeg', q);
      };
      img.onerror = () => rej(new Error('사진을 열 수 없어요'));
      img.src = url;
    });
  }
  const blobToDataUrl = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

  // ───────── 시안(데모) 모드: 이 브라우저에만 저장 ─────────
  function demoStore() {
    const KEY = 'tsc-demo-v1', SKEY = 'tsc-demo-secrets';
    let db, secrets = {}, pass = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); secrets = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { db = null; }
    if (!db) db = clone(window.SEED || { sites: [] });
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); localStorage.setItem(SKEY, JSON.stringify(secrets)); } catch (e) {} };
    const site = (id) => db.sites.find((s) => s.id === id);
    const DEMO_PASS = cfg.DEMO_PASS || null;
    const need = () => { if (!DEMO_PASS || pass !== DEMO_PASS) throw new Error('수정 모드가 아니에요'); };
    return {
      mode: 'demo', uid,
      async load() { return { ...clone(db), activity: [] }; },
      apply: null,
      async deleteActivity() {},
      async unlock(p) { if (!DEMO_PASS || p !== DEMO_PASS) return null; pass = p; return clone(secrets); },
      lock() { pass = null; },
      async saveSite(s) { need(); const cur = site(s.id); if (cur) Object.assign(cur, s, { logs: cur.logs, docs: cur.docs }); else db.sites.push({ ...s, logs: [], docs: [] }); persist(); },
      async deleteSite(id) { need(); db.sites = db.sites.filter((s) => s.id !== id); persist(); },
      async saveLog(siteId, l) { need(); const s = site(siteId); const i = s.logs.findIndex((x) => x.id === l.id); i >= 0 ? (s.logs[i] = l) : s.logs.push(l); persist(); },
      async deleteLog(siteId, id) { need(); const s = site(siteId); s.logs = s.logs.filter((x) => x.id !== id); persist(); },
      async saveDoc(siteId, d) { need(); const s = site(siteId); const i = s.docs.findIndex((x) => x.id === d.id); i >= 0 ? (s.docs[i] = d) : s.docs.push(d); persist(); },
      async deleteDoc(siteId, id) { need(); const s = site(siteId); s.docs = s.docs.filter((x) => x.id !== id); persist(); },
      async saveSecret(siteId, v) { need(); secrets[siteId] = v; persist(); },
      async uploadPhoto(file) { need(); return blobToDataUrl(await shrink(file, 1200, 0.75)); },
      reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); } catch (e) {} },
    };
  }

  // ───────── 실제 모드: Supabase ─────────
  function liveStore() {
    let sb = null, pass = null;
    const client = async () => {
      if (sb) return sb;
      if (!window.supabase) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload = res; s.onerror = () => rej(new Error('서버 연결 프로그램을 못 불러왔어요')); document.head.appendChild(s); });
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      return sb;
    };
    const ok = ({ data, error }) => { if (error) throw new Error(error.message.includes('wrong passcode') ? '비밀번호가 맞지 않아요' : error.message); return data; };
    const rpc = async (fn, args) => ok(await (await client()).rpc(fn, { p_pass: pass, ...args }));
    return {
      mode: 'live', uid,
      async load() {
        const c = await client();
        const [s, l, d, a] = await Promise.all([c.from('sites').select('*').order('sort'), c.from('logs').select('*'), c.from('docs').select('*'), c.from('activity').select('*').order('id', { ascending: false }).limit(40)]);
        const sites = ok(s).map((x) => ({ ...x, logs: [], docs: [] }));
        const by = Object.fromEntries(sites.map((x) => [x.id, x]));
        ok(l).forEach((x) => by[x.site_id] && by[x.site_id].logs.push(x));
        ok(d).forEach((x) => by[x.site_id] && by[x.site_id].docs.push(x));
        return { sites, activity: a.error ? [] : a.data };
      },
      async apply(changes, who) { return ok(await (await client()).rpc('tsc_apply', { p_pass: pass || '', p_changes: { changes }, p_who: who || '사람' })); },
      async deleteActivity(id) { await rpc('tsc_activity_edit', { p_id: id, p_summary: '', p_delete: true }); },
      async unlock(p) {
        const c = await client();
        const { data, error } = await c.rpc('tsc_secrets', { p_pass: p });
        if (error) return null;
        pass = p;
        return Object.fromEntries((data || []).map((r) => [r.site_id, { amounts: r.amounts || {}, contact: r.contact || '' }]));
      },
      lock() { pass = null; },
      async saveSite(s) { const { logs, docs, ...row } = s; await rpc('tsc_save_site', { p_row: row }); },
      async deleteSite(id) { await rpc('tsc_delete', { p_table: 'sites', p_id: id }); },
      async saveLog(siteId, l) { await rpc('tsc_save_log', { p_row: { ...l, site_id: siteId } }); },
      async deleteLog(siteId, id) { await rpc('tsc_delete', { p_table: 'logs', p_id: id }); },
      async saveDoc(siteId, d) { await rpc('tsc_save_doc', { p_row: { ...d, site_id: siteId } }); },
      async deleteDoc(siteId, id) { await rpc('tsc_delete', { p_table: 'docs', p_id: id }); },
      async saveSecret(siteId, v) { await rpc('tsc_save_secret', { p_site: siteId, p_amounts: v.amounts || {}, p_contact: v.contact || '' }); },
      async uploadPhoto(file) {
        const c = await client();
        const blob = await shrink(file);
        const path = new Date().toISOString().slice(0, 7) + '/' + uid() + '.jpg';
        ok(await c.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' }));
        return c.storage.from('photos').getPublicUrl(path).data.publicUrl;
      },
      reset() {},
    };
  }

  window.TSC_STORE = LIVE ? liveStore() : demoStore();
})();
