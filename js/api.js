/* ตัวเชื่อมฐานข้อมูล: คุยกับ Google Apps Script (ดู apps-script/Code.gs)
 * มีรูปแบบการเรียกใช้เหมือนฐานข้อมูลเอกสาร: db.collection("tasks").where(...).onSnapshot(...), db.doc("tasks/x").update(...) */
(function () {
  const CFG = window.APP_CONFIG || {};
  const API_URL = String(CFG.API_URL || "").trim();
  const POLL_MS = (CFG.REFRESH_SECONDS || 30) * 1000;
  const LS = {
    get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} }
  };
  const Store = { data: {}, loaded: false, listeners: new Set(), error: null };
  let pending = [], waiters = [], flushTimer = null, flushing = false;

  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  function merge(t, p) { const out = isObj(t) ? clone(t) : {}; Object.keys(p).forEach(k => { out[k] = (isObj(p[k]) && isObj(out[k])) ? merge(out[k], p[k]) : clone(p[k]); }); return out; }
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

  async function post(body) {
    const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" });
    return r.json();
  }
  function notify() { Store.listeners.forEach(l => { try { l.fire(); } catch (e) { console.error(e); } }); }
  function snapDoc(coll, id) { const d = (Store.data[coll] || {})[id]; return { id, exists: !!d, data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } }; }
  function querySnap(coll, filters) {
    const docs = Object.keys(Store.data[coll] || {}).filter(id => { const d = Store.data[coll][id]; return filters.every(([f, v]) => d[f] === v); }).map(id => snapDoc(coll, id));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function applyLocal(o) {
    const c = Store.data[o.coll] = Store.data[o.coll] || {};
    if (o.op === "delete") delete c[o.id];
    else c[o.id] = o.op === "update" ? merge(c[o.id], o.data) : clone(o.data);
  }

  async function pull() {
    if (!API_URL || flushing || pending.length) return;
    const view = LS.get("nfe_view") || LS.get("nfe_admin");
    const r = await fetch(API_URL + "?action=all" + (view ? "&view=" + encodeURIComponent(view) : ""), { redirect: "follow" });
    const j = await r.json();
    if (!j.ok) { Store.error = j; notify(); throw j; }
    if (flushing || pending.length) return;
    Store.error = null; Store.data = j.data || {}; Store.loaded = true; notify();
  }
  function queue(op) {
    applyLocal(op); notify();
    return new Promise((res, rej) => { pending.push(op); waiters.push({ res, rej }); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 300); });
  }
  async function flush() {
    if (flushing) { flushTimer = setTimeout(flush, 300); return; }
    const ops = pending, ws = waiters; pending = []; waiters = [];
    if (!ops.length) return;
    flushing = true;
    try {
      const j = await post({ action: "batch", pass: LS.get("nfe_admin"), ops });
      if (!j.ok) throw { code: j.code === "auth" ? "invalid_argument" : "unavailable", message: j.message || "บันทึกไม่สำเร็จ" };
      ws.forEach(w => w.res());
    } catch (e) {
      const err = e && e.code ? e : { code: "unavailable", message: String(e) };
      ws.forEach(w => w.rej(err));
      if (window.onDbWriteError) window.onDbWriteError(err);
    } finally {
      flushing = false;
      if (!pending.length) setTimeout(() => pull().catch(() => {}), 500);
    }
  }

  function docRef(coll, id) {
    return {
      id, path: coll + "/" + id,
      async get() { if (!Store.loaded) await pull(); return snapDoc(coll, id); },
      set(data) { return queue({ op: "set", coll, id, data: clone(data) }); },
      update(data) { if (!(Store.data[coll] || {})[id]) return Promise.reject({ code: "invalid_argument", message: "ไม่พบรายการ" }); return queue({ op: "update", coll, id, data: clone(data) }); },
      delete() { return queue({ op: "delete", coll, id }); },
      onSnapshot(cb) { const l = { fire: () => { if (Store.loaded) cb(snapDoc(coll, id)); } }; Store.listeners.add(l); l.fire(); return () => Store.listeners.delete(l); },
      collection() { throw new Error("not supported"); }
    };
  }
  function collRef(coll, filters) {
    filters = filters || [];
    return {
      path: coll,
      where(f, op, v) { return collRef(coll, filters.concat([[f, v]])); },
      orderBy() { return this; }, limit() { return this; },
      async get() { if (!Store.loaded) await pull(); return querySnap(coll, filters); },
      onSnapshot(cb) { const l = { fire: () => { if (Store.loaded) cb(querySnap(coll, filters)); } }; Store.listeners.add(l); l.fire(); return () => Store.listeners.delete(l); },
      doc(id) { return docRef(coll, id || newId()); },
      add(data) { const r = docRef(coll, newId()); r.set(data).catch(() => {}); return Promise.resolve(r); }
    };
  }

  function fileToBase64(f) { return new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] || ""); fr.onerror = no; fr.readAsDataURL(f); }); }

  window.NFE = {
    configured: !!API_URL,
    store: Store,
    db: { doc(p) { const [c, i] = p.split("/"); return docRef(c, i); }, collection(c) { return collRef(c); } },
    start() { const go = () => pull().catch(e => console.warn(e)); go(); setInterval(() => { if (document.visibilityState === "visible") go(); }, POLL_MS);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") go(); }); },
    refresh: () => pull(),
    adminPass: () => LS.get("nfe_admin"),
    async login(pass) { const j = await post({ action: "verify", pass }); if (j.ok && j.admin) { LS.set("nfe_admin", pass); return true; } return false; },
    logout() { LS.set("nfe_admin", ""); },
    async checkAdmin() { const p = LS.get("nfe_admin"); if (!p) return false; try { const j = await post({ action: "verify", pass: p }); if (j.ok && j.admin) return true; } catch (e) { return false; } LS.set("nfe_admin", ""); return false; },
    setViewPass(v) { LS.set("nfe_view", v); },
    async upload(file) {
      if (file.size > 20e6) throw { code: "too_large", message: "ไฟล์ใหญ่เกิน 20 MB" };
      const j = await post({ action: "upload", pass: LS.get("nfe_admin"), name: file.name, type: file.type || "application/octet-stream", data: await fileToBase64(file) });
      if (!j.ok) throw { code: j.code || "unavailable", message: j.message };
      return { id: j.id, url: j.url, sizeBytes: j.size, contentType: j.type };
    }
  };
})();
