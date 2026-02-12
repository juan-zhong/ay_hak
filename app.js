/* Dialect Dict Pro (static) — search + import/export + record audio per entry (IndexedDB) */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const els = {
  q: $("#q"),
  btnSearch: $("#btnSearch"),
  results: $("#results"),
  entry: $("#entry"),
  resultMeta: $("#resultMeta"),
  toggleIPA: $("#toggleIPA"),
  toggleAudio: $("#toggleAudio"),
  btnStar: $("#btnStar"),
  btnCopy: $("#btnCopy"),

  fileImport: $("#fileImport"),
  btnImport: $("#btnImport"),
  importStatus: $("#importStatus"),
  btnExport: $("#btnExport"),
  exportStatus: $("#exportStatus"),
  btnReset: $("#btnReset"),
  resetStatus: $("#resetStatus"),
  btnClearAudio: $("#btnClearAudio"),

  csvExample: $("#csvExample"),
  jsonExample: $("#jsonExample"),
};

const STORE_KEYS = {
  entries: "dialect_dict_entries_v1",
  stars: "dialect_dict_starred_v1",
};

// ---------- IndexedDB (audio blobs) ----------
const AudioDB = (() => {
  const DB_NAME = "dialect_dict_audio_db_v1";
  const STORE = "audio";
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  async function get(key) {
    if (!db) await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function set(key, blob) {
    if (!db) await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function del(key) {
    if (!db) await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function clear() {
    if (!db) await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  return { open, get, set, del, clear };
})();

// ---------- data/state ----------
let baseEntries = [];     // from data/entries.json
let entries = [];         // current (base or imported)
let state = {
  dialect: "all",
  pos: "all",
  showIPA: true,
  showAudio: true,
  query: "",
  selectedId: null,
  starred: new Set(JSON.parse(localStorage.getItem(STORE_KEYS.stars) || "[]")),
};

function saveStars() {
  localStorage.setItem(STORE_KEYS.stars, JSON.stringify([...state.starred]));
}
function saveEntriesLocal(list) { localStorage.setItem(STORE_KEYS.entries, JSON.stringify(list)); }
function loadEntriesLocal() {
  const raw = localStorage.getItem(STORE_KEYS.entries);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function norm(s) { return (s || "").toLowerCase().trim(); }

function matches(entry) {
  if (state.dialect !== "all" && entry.dialect !== state.dialect) return false;
  if (state.pos !== "all" && entry.pos !== state.pos) return false;

  const q = norm(state.query);
  if (!q) return true;

  const hay = [
    entry.headword,
    entry.romanization,
    entry.ipa,
    entry.gloss,
    ...(entry.senses || []),
    ...(entry.tags || []),
    ...(entry.examples || []).map(x => `${x.zh} ${x.note || ""}`)
  ].join(" ").toLowerCase();

  return hay.includes(q);
}

// ---------- UI render ----------
function renderResults() {
  const items = entries.filter(matches);
  els.resultMeta.textContent = `${items.length} 条`;

  els.results.innerHTML = items.map(e => {
    const badge = `${e.dialectLabel || e.dialect || "—"} · ${e.posLabel || e.pos || "—"}`;
    const starred = state.starred.has(e.id) ? "★" : "☆";
    return `
      <div class="result-item" data-id="${escapeHtml(e.id)}">
        <div class="result-top">
          <div class="word">${escapeHtml(e.headword || "—")}</div>
          <div class="badge">${starred} ${escapeHtml(badge)}</div>
        </div>
        <p class="gloss">${escapeHtml(e.gloss || "")}</p>
      </div>
    `;
  }).join("");

  $$(".result-item").forEach(el => {
    el.addEventListener("click", () => selectEntry(el.dataset.id));
  });

  if (!state.selectedId && items[0]) selectEntry(items[0].id);

  if (items.length === 0) {
    state.selectedId = null;
    els.entry.classList.add("empty");
    els.entry.innerHTML = `<p>没有结果。换个关键词试试，或者切换筛选条件。</p>`;
    els.btnStar.disabled = true;
    els.btnCopy.disabled = true;
  }
}

async function renderEntry(entry) {
  const isStarred = state.starred.has(entry.id);

  const metaBits = [
    entry.dialectLabel ? `<span class="kv">${escapeHtml(entry.dialectLabel)}</span>` : "",
    entry.posLabel ? `<span class="kv">${escapeHtml(entry.posLabel)}</span>` : (entry.pos ? `<span class="kv">${escapeHtml(entry.pos)}</span>` : ""),
    entry.romanization ? `<span class="kv">${escapeHtml(entry.romanization)}</span>` : "",
    (state.showIPA && entry.ipa) ? `<span class="kv">IPA ${escapeHtml(entry.ipa)}</span>` : "",
    (entry.tags || []).map(t => `<span class="kv">${escapeHtml(t)}</span>`).join("")
  ].filter(Boolean).join("");

  const senses = (entry.senses || []).map((s, i) => `<p class="example">${i + 1}. ${escapeHtml(s)}</p>`).join("");
  const examples = (entry.examples || []).map(ex => `
    <div class="example">
      <div>${escapeHtml(ex.zh || "")}</div>
      <div style="color:#999;margin-top:6px;">${escapeHtml(ex.note || "")}</div>
    </div>
  `).join("");

  // audio from IndexedDB
  const audioKey = `entry:${entry.id}`;
  const blob = state.showAudio ? await AudioDB.get(audioKey) : null;
  const hasBlob = !!blob;
  const blobUrl = hasBlob ? URL.createObjectURL(blob) : null;

  els.entry.classList.remove("empty");
  els.entry.innerHTML = `
    <h3>${escapeHtml(entry.headword || "—")}</h3>
    <div class="meta">${metaBits || ""}</div>

    <div class="section">
      <h3>释义</h3>
      <p style="margin-bottom:14px;">${escapeHtml(entry.gloss || "")}</p>
      ${senses || `<p class="muted">暂无更细分义项。</p>`}
    </div>

    <div class="section">
      <h3>例句</h3>
      ${examples || `<p class="muted">暂无例句。</p>`}
    </div>

    ${state.showAudio ? `
      <div class="section">
        <h3>发音</h3>
        <p class="muted" style="margin-bottom:14px;">
          录音会保存到你的浏览器本机（IndexedDB）。想“上传到云盘”，需要接后端/OAuth。
        </p>
        <div class="controls">
          <button id="btnMic" class="btn">开启麦克风</button>
          <button id="btnRec" class="btn" disabled>开始录音</button>
          <button id="btnStop" class="btn" disabled>停止录音</button>
          <button id="btnSaveAudio" class="btn" disabled>保存录音</button>
          <button id="btnDelAudio" class="btn btn-ghost" ${hasBlob ? "" : "disabled"}>删除录音</button>
          <button id="btnDownloadAudio" class="btn btn-ghost" ${hasBlob ? "" : "disabled"}>下载录音</button>
        </div>
        <p class="small" id="audioStatus">${hasBlob ? "已保存录音 ✅" : "暂无录音"}</p>
        <audio id="audioPlayer" controls style="width:100%; display:${hasBlob ? "block" : "none"}" src="${hasBlob ? blobUrl : ""}"></audio>
      </div>
    ` : ""}
  `;

  els.btnStar.disabled = false;
  els.btnStar.textContent = isStarred ? "★" : "☆";
  els.btnCopy.disabled = false;

  if (state.showAudio) wireRecorder(audioKey, entry.headword || "audio");
}

function selectEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  state.selectedId = id;
  renderEntry(entry);
}

// ---------- recorder ----------
function pickSupportedMimeType() {
  const candidates = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function wireRecorder(audioKey, nameBase) {
  const btnMic = $("#btnMic");
  const btnRec = $("#btnRec");
  const btnStop = $("#btnStop");
  const btnSave = $("#btnSaveAudio");
  const btnDel = $("#btnDelAudio");
  const btnDl = $("#btnDownloadAudio");
  const audioStatus = $("#audioStatus");
  const audioPlayer = $("#audioPlayer");

  let stream = null;
  let recorder = null;
  let chunks = [];
  let blob = null;
  let url = null;

  function setA(msg){ if (audioStatus) audioStatus.textContent = msg; }

  btnMic?.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("浏览器不支持录音（需要 HTTPS + 现代浏览器）。");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      btnMic.disabled = true;
      btnRec.disabled = false;
      setA("麦克风已开启");
    } catch (e) {
      console.error(e);
      alert("麦克风权限获取失败。");
    }
  });

  btnRec?.addEventListener("click", () => {
    if (!stream) return;
    chunks = [];
    blob = null;
    btnSave.disabled = true;

    const mt = pickSupportedMimeType();
    recorder = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined);

    recorder.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };
    recorder.onstart = () => {
      btnRec.disabled = true;
      btnStop.disabled = false;
      setA("录音中…");
    };
    recorder.onstop = () => {
      btnRec.disabled = false;
      btnStop.disabled = true;
      const type = recorder.mimeType || (chunks[0] && chunks[0].type) || "audio/webm";
      blob = new Blob(chunks, { type });
      btnSave.disabled = false;
      setA(`已停止（${Math.round(blob.size/1024)} KB），可保存`);
    };

    recorder.start();
  });

  btnStop?.addEventListener("click", () => {
    if (recorder && recorder.state === "recording") recorder.stop();
  });

  btnSave?.addEventListener("click", async () => {
    if (!blob) return;
    await AudioDB.set(audioKey, blob);
    setA("已保存录音 ✅");
    btnDel.disabled = false;
    btnDl.disabled = false;

    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    if (audioPlayer) {
      audioPlayer.src = url;
      audioPlayer.style.display = "block";
    }
  });

  btnDel?.addEventListener("click", async () => {
    await AudioDB.del(audioKey);
    setA("已删除录音");
    btnDel.disabled = true;
    btnDl.disabled = true;
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.removeAttribute("src");
      audioPlayer.style.display = "none";
    }
    if (url) URL.revokeObjectURL(url);
    url = null;
  });

  btnDl?.addEventListener("click", async () => {
    const saved = await AudioDB.get(audioKey);
    if (!saved) return;
    const type = saved.type || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : (type.includes("webm") ? "webm" : "dat");
    const fn = `${safeFilename(nameBase)}_${new Date().toISOString().replace(/[:.]/g,"-")}.${ext}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(saved);
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  });
}

// ---------- manage (import/export/reset) ----------
function csvToEntries(csvText) {
  const lines = csvText.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim().length);
  if (lines.length < 2) throw new Error("CSV 太短");
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const out = [];

  for (let i=1;i<lines.length;i++){
    const row = splitCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (row[idx] ?? "").trim());

    obj.senses = obj.senses ? obj.senses.split("||").map(s=>s.trim()).filter(Boolean) : [];
    obj.tags = obj.tags ? obj.tags.split("||").map(s=>s.trim()).filter(Boolean) : [];
    obj.examples = obj.examples ? obj.examples.split("||").map(pair => {
      const [zh, note] = pair.split("::");
      return { zh: (zh||"").trim(), note: (note||"").trim() };
    }).filter(x => x.zh) : [];

    if (!obj.id) obj.id = `${obj.dialect || "x"}_${obj.headword || "entry"}_${i}`;
    if (!obj.headword) obj.headword = obj.word || "";
    out.push(obj);
  }
  return out;
}

function splitCsvLine(line) {
  const res = [];
  let cur = "";
  let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      res.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

function downloadText(filename, text, mime="application/json") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

async function importFile() {
  const f = els.fileImport.files?.[0];
  if (!f) { els.importStatus.textContent = "请选择文件"; return; }
  const text = await f.text();
  try {
    let list = null;
    if (f.name.toLowerCase().endsWith(".csv")) list = csvToEntries(text);
    else list = JSON.parse(text);

    if (!Array.isArray(list)) throw new Error("JSON 必须是数组");
    list.forEach((e, idx) => {
      if (!e.id) e.id = `entry_${idx}`;
      if (!e.headword) e.headword = e.word || "";
    });

    entries = list;
    saveEntriesLocal(entries);
    els.importStatus.textContent = `导入成功 ✅（${entries.length} 条）`;
    state.selectedId = null;
    renderResults();
  } catch (e) {
    console.error(e);
    els.importStatus.textContent = "导入失败";
    alert("导入失败：请检查格式（CSV/JSON）。");
  }
}

function exportJson() {
  const text = JSON.stringify(entries, null, 2);
  const fn = `dialect_dict_entries_${new Date().toISOString().slice(0,10)}.json`;
  downloadText(fn, text);
  els.exportStatus.textContent = `已导出：${fn}`;
}

async function resetData() {
  localStorage.removeItem(STORE_KEYS.entries);
  entries = [...baseEntries];
  state.selectedId = null;
  renderResults();
  els.resetStatus.textContent = "已重置 ✅";
}

async function clearAllAudio() {
  await AudioDB.clear();
  alert("已清空所有录音。");
  if (state.selectedId) selectEntry(state.selectedId);
}

// ---------- top actions ----------
function wireChips() {
  $$(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const isDialect = btn.dataset.dialect !== undefined;
      const isPos = btn.dataset.pos !== undefined;

      if (isDialect) {
        state.dialect = btn.dataset.dialect;
        $$(".chip[data-dialect]").forEach(b => b.classList.toggle("is-active", b === btn));
      }
      if (isPos) {
        state.pos = btn.dataset.pos;
        $$(".chip[data-pos]").forEach(b => b.classList.toggle("is-active", b === btn));
      }

      state.selectedId = null;
      renderResults();
    });
  });
}

function wireTopActions() {
  els.btnStar.addEventListener("click", () => {
    if (!state.selectedId) return;
    if (state.starred.has(state.selectedId)) state.starred.delete(state.selectedId);
    else state.starred.add(state.selectedId);
    saveStars();
    renderResults();
    selectEntry(state.selectedId);
  });

  els.btnCopy.addEventListener("click", async () => {
    const entry = entries.find(e => e.id === state.selectedId);
    if (!entry) return;

    const text = [
      `词：${entry.headword || ""}`,
      `方言：${entry.dialectLabel || entry.dialect || ""}`,
      `词性：${entry.posLabel || entry.pos || ""}`,
      entry.romanization ? `转写：${entry.romanization}` : "",
      entry.ipa ? `IPA：${entry.ipa}` : "",
      `释义：${entry.gloss || ""}`,
      (entry.examples && entry.examples[0]) ? `例句：${entry.examples[0].zh}${entry.examples[0].note ? "（" + entry.examples[0].note + "）" : ""}` : ""
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(text);
      els.btnCopy.textContent = "✓";
      setTimeout(() => (els.btnCopy.textContent = "⎘"), 900);
    } catch {
      alert("复制失败（可能是浏览器权限限制）。");
    }
  });
}

function doSearch() {
  state.query = els.q.value || "";
  state.selectedId = null;
  renderResults();
}

// ---------- helpers ----------
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function safeFilename(s) {
  return String(s || "audio").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
}

// ---------- init ----------
async function loadBaseEntries() {
  const resp = await fetch("./data/entries.json", { cache: "no-store" });
  if (!resp.ok) throw new Error("无法读取 data/entries.json");
  return await resp.json();
}

function fillExamples() {
  els.csvExample.textContent =
`id,headword,dialect,dialectLabel,pos,posLabel,romanization,ipa,gloss,senses,examples,tags
fuzhou_nong,侬,fuzhou,福州话,part,语气词,nòng,[nɔŋ˨˩],你（第二人称）,"你（第二人称）||亲昵用法","侬来伓？::你来吗？||侬真会讲。::你真会说（亲昵/调侃）","常用||口语"`;

  els.jsonExample.textContent =
`[
  {
    "id": "fuzhou_nong",
    "headword": "侬",
    "dialect": "fuzhou",
    "dialectLabel": "福州话",
    "pos": "part",
    "posLabel": "语气词",
    "romanization": "nòng",
    "ipa": "[nɔŋ˨˩]",
    "gloss": "你（第二人称）/ 也可作亲昵称呼",
    "senses": ["你（第二人称代词）", "亲昵：类似“你呀/你这个”"],
    "examples": [{"zh": "侬来伓？", "note": "你来吗？"}],
    "tags": ["常用", "口语"]
  }
]`;
}

async function init() {
  fillExamples();
  await AudioDB.open();

  baseEntries = await loadBaseEntries();
  const local = loadEntriesLocal();
  entries = Array.isArray(local) && local.length ? local : [...baseEntries];

  wireChips();
  wireTopActions();

  els.btnSearch.addEventListener("click", doSearch);
  els.q.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  els.toggleIPA.addEventListener("change", () => {
    state.showIPA = !!els.toggleIPA.checked;
    if (state.selectedId) selectEntry(state.selectedId);
  });

  els.toggleAudio.addEventListener("change", () => {
    state.showAudio = !!els.toggleAudio.checked;
    if (state.selectedId) selectEntry(state.selectedId);
  });

  els.btnImport.addEventListener("click", importFile);
  els.btnExport.addEventListener("click", exportJson);
  els.btnReset.addEventListener("click", resetData);
  els.btnClearAudio.addEventListener("click", clearAllAudio);

  renderResults();
}

init().catch(err => {
  console.error(err);
  alert("初始化失败：请检查文件是否完整（尤其是 data/entries.json）。");
});
