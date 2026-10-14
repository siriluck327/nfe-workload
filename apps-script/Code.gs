/**
 * ระบบติดตามภาระงานและการส่งงานบุคลากร สกร.ระดับอำเภอเมืองหนองบัวลำภู
 * ส่วนหลังบ้าน (Google Apps Script) — เก็บข้อมูลใน Google Sheet นี้ และไฟล์แนบใน Google Drive
 *
 * วิธีติดตั้ง (ทำครั้งเดียว)
 * 1) เปิด Google Sheet ใหม่ → ส่วนขยาย → Apps Script → วางโค้ดนี้ทั้งหมดแทนของเดิม → บันทึก
 * 2) เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" → อนุญาตสิทธิ์ (รหัสผู้ดูแลเริ่มต้นคือ admin0)
 * 3) การทำให้ใช้งานได้ → การทำให้ใช้งานได้รายการใหม่ → ประเภท "เว็บแอป"
 *      ดำเนินการในฐานะ: ฉัน   |   ผู้มีสิทธิ์เข้าถึง: ทุกคน
 *    → คัดลอก URL ที่ลงท้ายด้วย /exec ไปใส่ในไฟล์ config.js ของเว็บไซต์
 *
 * เปลี่ยนรหัส: การตั้งค่าโปรเจ็กต์ (รูปเฟือง) → คุณสมบัติของสคริปต์
 *   ADMIN_PASSWORD = รหัสผู้ดูแลระบบ (เพิ่ม/แก้ไขงาน ให้คะแนน)
 *   VIEW_PASSWORD  = (ไม่บังคับ) รหัสสำหรับเปิดดู ถ้าไม่ตั้ง ทุกคนที่มีลิงก์ดูได้
 */

const DEFAULT_ADMIN_PASSWORD = "admin0"; // รหัสผู้ดูแลเริ่มต้น ใช้ตอนกด setup ครั้งแรก (เปลี่ยนภายหลังได้ที่คุณสมบัติของสคริปต์)
const DATA_SHEET = "_data";
const COLLECTIONS = ["staff", "years", "indicators", "tasks", "settings"];
const STATUS_LABEL = { on: "ส่งครบ ตรงเวลา", partial: "ส่งไม่ครบ/ไม่ตามกำหนด", late: "ส่งล่าช้า", none: "ละเลย/ไม่ส่ง" };

const STAFF = [
  ["นายชยาวิชญ์ ธาตุชัย", "ผอ.สกร.อ.เมืองฯ"], ["นางสาวศิริลักษณ์ ผาเนตร์", "ครู"],
  ["นางสาวรัชนี ศรีเชียงสา", "ครู ศูนย์การเรียนรู้"], ["นางยุวเรศ วิบูลย์กุล", "ครู ศูนย์การเรียนรู้"],
  ["นางชนิดา เครือภักดี", "ครู ศูนย์การเรียนรู้"], ["นางเตือนใจ สุวรรณโค", "ครู ศูนย์การเรียนรู้"],
  ["นางพิมพ์มาดา พรมเป", "ครู ศูนย์การเรียนรู้"], ["นางสาวสุขสรร รัชชุศิริ", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวเนตรนภา สุนทวงษ์", "ครู ศูนย์การเรียนรู้"], ["นางสาววิลาวัณย์ แสนเมือง", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวดารุณี จักโนวรรณ", "ครู ศูนย์การเรียนรู้"], ["นางสาวสุพิชญา ชื่นอก", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวภัควลัญชญ์ สุวะศรี", "ครู ศูนย์การเรียนรู้"], ["นางสาวจิตติมา สงวนศิลป์", "ครู ศูนย์การเรียนรู้"],
  ["นางสาววิลาวัลย์ ราชูโส", "ครู ศูนย์การเรียนรู้"], ["นางพัทรภรณ์ ทองประทับ", "ครู ศูนย์การเรียนรู้"],
  ["นายอานนทวัฒน์ ปัดโรคา", "ครู ศูนย์การเรียนรู้"], ["นางพารัศม์ชญา ปัดโรคา", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวพรรณวดี ชัยมงคล", "ครู ศูนย์การเรียนรู้"], ["นายประพันธ์ ศรีสวัสดิ์", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวสุภาพร ศรีนามเอ็ม", "ครู ศูนย์การเรียนรู้"], ["นางสาวธิติยา น่าบัณฑิต", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวสุพรรษา คำพันธ์", "ครู ศูนย์การเรียนรู้"], ["นางสาวสาวิตรี ปิไชยญาณ", "ครู ศูนย์การเรียนรู้"],
  ["นางนพรัตน์ บัวศรี", "ครู ศูนย์การเรียนรู้"], ["นางสาวจิราภา วรรณพฤกษ์", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวณฐมน นิธิโกมลกุล", "ครู ศูนย์การเรียนรู้"], ["นางสาวฉวีวรรณ คำฆ้อง", "ครู ศูนย์การเรียนรู้"],
  ["นายธีรศานต์ สัตนันท์", "ครู ศูนย์การเรียนรู้"], ["นางอุมาพร ภูนายา", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวกมลมาศ บุญจันทร์", "ครู ศูนย์การเรียนรู้"], ["นายชลธิศ ศิลปกูลวิวัฒน์", "ครู ศูนย์การเรียนรู้"],
  ["นางสาวเบญจมาศ โคตรเพชร", "บรรณารักษ์"], ["นางสาวกชกร ถามูลเลศ", "นักจัดการงานทั่วไป"],
  ["นายอิษฎา การะพันธ์", "นักวิชาการศึกษา"], ["นางสาวสุณิสา ทุมชะ", "ครูศูนย์การเรียนชุมชน"],
  ["นายจตุรภัทร ใจเปรียว", "ครูศูนย์การเรียนชุมชน"], ["นายวรากร โสโท", "ครูศูนย์การเรียนชุมชน"],
  ["นางสาวพิรญาณ์ ศรีภูธร", "ครูศูนย์การเรียนชุมชน"], ["นางสาวศุภาพิชญ์ วงศ์ปัญญา", "ครูศูนย์การเรียนชุมชน"],
  ["นางสาววไลลักษ์ อุ่นบุรมย์", "ครูศูนย์การเรียนชุมชน"], ["นางสาววรินทร์สุดา โชคบัณฑิต", "ครูผู้สอนคนพิการ"],
  ["นางสาวอาภากร ฮองอุ้น", "ครูผู้สอนคนพิการ"], ["นางสาวรุ่งอรุณ บูระพันธ์", "ครูผู้สอนคนพิการ"],
  ["นางสาวทิพวารี จันทะวงค์", "ครูผู้สอนคนพิการ"], ["นางบุญเพ็ง นาเจิมพลอย", "พนักงานบริการ"],
  ["นายวิชัย มานันที", "คนสวน"]
];

const UNITS = ["หนองบัว", "หนองภัยศูนย์", "โพธิ์ชัย", "หนองสวรรค์", "หัวนา", "บ้านขาม", "นามะเฟือง", "บ้านพร้าว", "โนนขมิ้น", "ลำภู", "กุดจิก", "โนนทัน", "นาคำไฮ", "ป่าไม้งาม", "หนองหว้า"];

/* ---------------- ติดตั้งครั้งแรก ---------------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_PASSWORD")) props.setProperty("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD);
  const all = loadAll_().data;
  const ops = [];
  if (!Object.keys(all.staff || {}).length) {
    STAFF.forEach(function (r, i) {
      ops.push({ op: "set", coll: "staff", id: "s" + ("0" + (i + 1)).slice(-2), data: { order: i + 1, name: r[0], position: r[1], active: true } });
    });
  }
  UNITS.forEach(function (n, i) {
    const id = "u" + ("0" + (i + 1)).slice(-2);
    if (!(all.staff || {})[id]) ops.push({ op: "set", coll: "staff", id: id, data: { order: 101 + i, name: "ศกร.ระดับตำบล" + n, position: "ศกร.ระดับตำบล", kind: "unit", active: true } });
  });
  if (!(all.settings || {}).scoring) ops.push({ op: "set", coll: "settings", id: "scoring", data: { on: 1, partial: 0.5, late: 0, none: -1 } });
  const d = new Date();
  const fy = String((d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear()) + 543);
  if (!(all.years || {})[fy]) ops.push({ op: "set", coll: "years", id: fy, data: { label: fy } });
  if (ops.length) applyOps_(ops);
  refreshReadable_();
  Logger.log("ติดตั้งเสร็จแล้ว เพิ่มข้อมูล " + ops.length + " รายการ");
  Logger.log("รหัสผู้ดูแลระบบ (ADMIN_PASSWORD): " + props.getProperty("ADMIN_PASSWORD"));
}

/* ---------------- API ---------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === "all") {
      if (!canView_(p.view)) return json_({ ok: false, code: "view", message: "ต้องใส่รหัสเข้าดู" });
      const r = loadAll_();
      return json_({ ok: true, data: r.data, ts: Date.now() });
    }
    return json_({ ok: true, message: "ระบบภาระงานบุคลากร: API พร้อมใช้งาน" });
  } catch (err) {
    return json_({ ok: false, code: "error", message: String(err) });
  }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, code: "bad", message: "ข้อมูลไม่ถูกต้อง" }); }
  try {
    if (body.action === "verify") return json_({ ok: true, admin: isAdmin_(body.pass), view: canView_(body.view) });
    const admin = isAdmin_(body.pass);
    if (body.action === "batch") {
      let ops = (body.ops || []).filter(function (o) { return o && COLLECTIONS.indexOf(o.coll) >= 0 && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(String(o.id)); });
      if (!admin) {
        const chk = publicAssignOps_(ops);
        if (!chk.ok) return json_(chk);
        ops = chk.ops;
      }
      applyOps_(ops);
      try { refreshReadable_(); } catch (err) { console.error(err); }
      return json_({ ok: true, n: ops.length });
    }
    if (body.action === "upload") { if (!admin) return json_({ ok: false, code: "auth", message: "รหัสผู้ดูแลไม่ถูกต้อง" }); return json_(upload_(body)); }
    return json_({ ok: false, code: "bad", message: "ไม่รู้จักคำสั่ง" });
  } catch (err) {
    return json_({ ok: false, code: "error", message: String(err) });
  }
}

/* ผู้ใช้ทั่วไป (ไม่ใส่รหัส) แก้ได้อย่างเดียว: รายชื่อผู้รับผิดชอบของงาน และยกเลิกได้เฉพาะคนที่ยังไม่มีคะแนน
 * ปิดความสามารถนี้ได้โดยตั้งคุณสมบัติของสคริปต์ PUBLIC_ASSIGN = false */
function publicAssignOps_(ops) {
  const deny = { ok: false, code: "auth", message: "ต้องเข้าสู่ระบบผู้ดูแลจึงจะแก้ไขส่วนนี้ได้" };
  if (PropertiesService.getScriptProperties().getProperty("PUBLIC_ASSIGN") === "false") return deny;
  const all = loadAll_().data; const out = [];
  for (let n = 0; n < ops.length; n++) {
    const o = ops[n];
    if (o.coll !== "tasks" || o.op !== "update" || !o.data || !Array.isArray(o.data.assignees)) return deny;
    const extra = Object.keys(o.data).filter(function (k) { return k !== "assignees" && k !== "updated"; });
    if (extra.length) return deny;
    const cur = all.tasks[o.id]; if (!cur) return { ok: false, code: "bad", message: "ไม่พบงาน" };
    const next = o.data.assignees.map(String).filter(function (x, i, a) { return all.staff[x] && a.indexOf(x) === i; });
    const removed = (cur.assignees || []).filter(function (x) { return next.indexOf(x) < 0; });
    if (removed.some(function (x) { return ((cur.results || {})[x] || {}).status; }))
      return { ok: false, code: "scored", message: "คนที่ให้คะแนนแล้ว ยกเลิกได้เฉพาะผู้ดูแลระบบ" };
    out.push({ op: "update", coll: "tasks", id: o.id, data: { assignees: next, updated: Date.now() } });
  }
  return { ok: true, ops: out };
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function isAdmin_(pass) { const a = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD"); return !!a && String(pass || "") === a; }
function canView_(v) {
  const vp = PropertiesService.getScriptProperties().getProperty("VIEW_PASSWORD");
  return !vp || String(v || "") === vp || isAdmin_(v);
}

/* ---------------- storage ---------------- */
function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) { sh = ss.insertSheet(DATA_SHEET); sh.appendRow(["collection", "id", "json", "updatedAt"]); sh.setFrozenRows(1); }
  return sh;
}
function loadAll_() {
  const sh = sheet_();
  const n = sh.getLastRow();
  const data = {}; const rows = {};
  COLLECTIONS.forEach(function (c) { data[c] = {}; });
  if (n > 1) {
    sh.getRange(2, 1, n - 1, 3).getValues().forEach(function (r, i) {
      if (!r[0] || !data[r[0]]) return;
      try { data[r[0]][r[1]] = JSON.parse(r[2]); rows[r[0] + "/" + r[1]] = i + 2; } catch (err) {}
    });
  }
  return { data: data, rows: rows, sh: sh };
}
function isObj_(v) { return v && typeof v === "object" && !Array.isArray(v); }
function merge_(t, p) {
  const out = isObj_(t) ? JSON.parse(JSON.stringify(t)) : {};
  Object.keys(p).forEach(function (k) { out[k] = (isObj_(p[k]) && isObj_(out[k])) ? merge_(out[k], p[k]) : p[k]; });
  return out;
}
function applyOps_(ops) {
  if (!ops.length) return;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const st = loadAll_(); const sh = st.sh; const now = new Date();
    const appends = []; const appendAt = {}; const deletes = [];
    ops.forEach(function (o) {
      const key = o.coll + "/" + o.id; const row = st.rows[key];
      if (o.op === "delete") {
        if (row) deletes.push(row);
        if (appendAt[key] != null) { appends[appendAt[key]] = null; delete appendAt[key]; }
        delete st.data[o.coll][o.id]; delete st.rows[key]; return;
      }
      const doc = o.op === "update" ? merge_(st.data[o.coll][o.id] || {}, o.data || {}) : (o.data || {});
      st.data[o.coll][o.id] = doc;
      const text = JSON.stringify(doc);
      if (text.length > 49000) throw new Error("ข้อมูลรายการ " + key + " ใหญ่เกินไป");
      if (row) sh.getRange(row, 3, 1, 2).setValues([[text, now]]);
      else if (appendAt[key] != null) appends[appendAt[key]] = [o.coll, o.id, text, now];
      else { appendAt[key] = appends.length; appends.push([o.coll, o.id, text, now]); }
    });
    const add = appends.filter(function (r) { return r; });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add);
    deletes.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  } finally { lock.releaseLock(); }
}

/* ---------------- ไฟล์แนบ → Google Drive ---------------- */
function upload_(b) {
  if (!b.data || !b.name) return { ok: false, code: "bad", message: "ไม่มีไฟล์" };
  const props = PropertiesService.getScriptProperties();
  let folder;
  const fid = props.getProperty("FOLDER_ID");
  try { if (fid) folder = DriveApp.getFolderById(fid); } catch (err) {}
  if (!folder) { folder = DriveApp.createFolder("เอกสารต้นเรื่อง - ระบบภาระงานบุคลากร"); props.setProperty("FOLDER_ID", folder.getId()); }
  const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.type || "application/octet-stream", String(b.name).slice(0, 200));
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
  return { ok: true, id: file.getId(), url: file.getUrl(), size: file.getSize(), type: blob.getContentType() };
}

/* ---------------- ชีตสรุปที่อ่านง่าย (สร้างใหม่ทุกครั้งที่มีการบันทึก) ---------------- */
function refreshReadable_() {
  const d = loadAll_().data;
  const ss = SpreadsheetApp.getActive();
  const sc = d.settings.scoring || { on: 1, partial: 0.5, late: 0, none: -1 };
  const staff = d.staff, inds = d.indicators;
  const write = function (name, header, rows) {
    let sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name);
    sh.clearContents();
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
    if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
    sh.setFrozenRows(1);
  };
  const staffRows = Object.keys(staff).map(function (k) { return staff[k]; })
    .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
    .map(function (s) { return [s.order || "", s.name || "", s.position || "", s.kind === "unit" ? "ศกร.ระดับตำบล" : "บุคลากร", s.active === false ? "ไม่ใช้งาน" : "ใช้งาน"]; });
  write("บุคลากร", ["ลำดับ", "ชื่อ", "ตำแหน่ง", "ประเภท", "สถานะ"], staffRows);

  const taskCount = {};
  Object.keys(d.tasks).forEach(function (k) { const t = d.tasks[k]; taskCount[t.indicatorId] = (taskCount[t.indicatorId] || 0) + 1; });
  const indRows = Object.keys(inds).map(function (k) { const i = inds[k]; const doc = (i.docs || []).slice(-1)[0] || {};
    return [i.fy || "", i.group || "", i.code || "", i.name || "", taskCount[k] || 0, doc.source || "", doc.refNo || "", doc.date || "", doc.subject || ""]; })
    .sort(function (a, b) { return String(a[0] + a[1] + a[2]).localeCompare(String(b[0] + b[1] + b[2])); });
  write("ตัวชี้วัด", ["ปีงบประมาณ", "กลุ่มงาน", "รหัส", "ตัวชี้วัดย่อย", "จำนวนงาน", "ต้นเรื่องจาก", "เลขที่หนังสือ", "ลงวันที่", "เรื่อง"], indRows);

  const rows = [];
  Object.keys(d.tasks).forEach(function (k) {
    const t = d.tasks[k]; const i = inds[t.indicatorId] || {};
    const as = t.assignees || [];
    if (!as.length) rows.push([t.fy || "", i.group || "", i.code || "", i.name || "", t.name || "", t.due || "", "(ยังไม่ระบุ)", "", "", "", ""]);
    as.forEach(function (sid) {
      const r = (t.results || {})[sid] || {}; const s = staff[sid] || {};
      rows.push([t.fy || "", i.group || "", i.code || "", i.name || "", t.name || "", t.due || "", s.name || sid,
        r.status ? STATUS_LABEL[r.status] : "รอประเมิน", r.status ? sc[r.status] : "", r.date || "", r.note || ""]);
    });
  });
  rows.sort(function (a, b) { return String(a[0] + a[1] + a[2] + a[4]).localeCompare(String(b[0] + b[1] + b[2] + b[4])); });
  write("งานและผู้รับผิดชอบ", ["ปีงบประมาณ", "กลุ่มงาน", "รหัสตัวชี้วัด", "ตัวชี้วัดย่อย", "งาน", "กำหนดส่ง", "ผู้รับผิดชอบ", "ผลการส่งงาน", "คะแนน", "วันที่ส่ง", "หมายเหตุ"], rows);
}
