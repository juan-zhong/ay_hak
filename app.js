/* Gan-nan Hakka Dict — fuzzy search + import/export + record audio per entry + upload to YOUR Drive (Apps Script) */

const DRIVE_UPLOAD_ENDPOINT = ""; // <-- 粘贴你的 Apps Script Web App URL（以 /exec 结尾）

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
  entries: "gn_hakka_dict_entries_v1",
  stars: "gn_hakka_dict_starred_v1",
};

// ---------- IndexedDB (audio blobs) ----------
const AudioDB = (() => {
  const DB_NAME = "gn_hakka_audio_db_v1";
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
let baseEntries = [];
let entries = [];
let state = {
  dialect: "all",
  pos: "all",
  showIPA: true,
  showAudio: true,
  query: "",
  selectedId: null,
  starred: new Set(JSON.parse(localStorage.getItem(STORE_KEYS.stars) || "[]")),
};

function saveStars() { localStorage.setItem(STORE_KEYS.stars, JSON.stringify([...state.starred])); }
function saveEntriesLocal(list) { localStorage.setItem(STORE_KEYS.entries, JSON.stringify(list)); }
function loadEntriesLocal() {
  const raw = localStorage.getItem(STORE_KEYS.entries);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ---------- fuzzy search ----------
function norm(s) { return (s || "").toLowerCase().trim(); }

function normalizeRoman(s) {
  // keep letters+numbers; strip spaces, hyphens, apostrophes, tone marks
  return norm(s)
    .replace(/[ \t\r\n\-_']/g, "")
    // common superscript tone digits -> normal digits
    .replace(/[¹]/g, "1").replace(/[²]/g, "2").replace(/[³]/g, "3")
    .replace(/[⁴]/g, "4").replace(/[⁵]/g, "5").replace(/[⁶]/g, "6")
    .replace(/[⁷]/g, "7").replace(/[⁸]/g, "8").replace(/[⁹]/g, "9")
    // remove diacritics (nùng -> nung)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeIPA(s) {
  return norm(s)
    .replace(/[\[\]\(\)]/g, "")
    .replace(/[ˈˌːˑ]/g, "")
    .replace(/\s+/g, "");
}

function buildSearchText(e) {
  const pron = e.pron || {};
  const search = e.search || {};
  const parts = [
    e.headword, e.gloss,
    (pron.roman || ""), (pron.ipa || ""),
    ...(pron.alt || []),
    ...(e.senses || []),
    ...(e.tags || []),
    ...(e.examples || []).map(x => `${x.zh || ""} ${x.note || ""}`),
    ...(search.aliases || []),
    ...(search.keywords || []),
    ...(e.syllables || []),
  ];
  return parts.filter(Boolean).join(" ");
}

function levenshtein(a, b) {
  a = a || ""; b = b || "";
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function scoreEntry(e, queryRaw) {
  const q = norm(queryRaw);
  if (!q) return 0;

  const head = norm(e.headword || "");
  const pron = e.pron || {};
  const roman = normalizeRoman(pron.roman || "");
  const ipa = normalizeIPA(pron.ipa || "");
  const qRoman = normalizeRoman(q);
  const qIPA = normalizeIPA(q);

  // high confidence hits
  if (q && head === q) return 1000;
  if (qRoman && roman && roman === qRoman) return 900;
  if (qIPA && ipa && ipa === qIPA) return 850;

  // prefixes
  if (q && head.startsWith(q)) return 700;
  if (qRoman && roman.startsWith(qRoman)) return 650;

  // substring in aggregated text
  const hay = norm(e._searchText || "");
  let s = 0;
  if (hay.includes(q)) s += 300;

  // roman substring
  if (qRoman && roman.includes(qRoman)) s += 260;

  // mild typo tolerance for roman
  if (qRoman && roman) {
    const dist = levenshtein(qRoman, roman);
    if (dist <= 2) s += (200 - dist * 60);
  }

  // mild tolerance in headword (for 1-char/2-char miss) — optional
  if (q.length >= 2 && head) {
    const dist2 = levenshtein(q, head);
    if (dist2 <= 1) s += 120;
  }

  return s;
}

function matchesFilters(e) {
  if (state.dialect !== "all" && e.dialect !== state.dialect) return false;
  if (state.pos !== "all" && e.pos !== state.pos) return false;
  return true;
}

// ---------- UI render ----------
function renderResults() {
  const q = els.q.value || "";
  state.query = q;

  const pool = entries.filter(matchesFilters);
  const scored = pool.map(e => ({
    e,
    score: scoreEntry(e, q),
  }));

  // if empty query, keep stable order (score=0); else sort by score desc
  const items = q.trim()
    ? scored.filter(x => x.score > 0).sort((a,b) => b.score - a.score).map(x => x.e)
    : pool;

  els.resultMeta.textContent = `${items.length} 条`;

  els.results.innerHTML = items.map(e => {
    const badge = `${e.dialectLabel || e.dialect || "—"} · ${e.posLabel || e.pos || "—"}`;
    const starred = state.starred.has(e.id) ? "★" : "☆";
    const pron = e.pron || {};
    const sub = [pron.roman, (state.showIPA ? pron.ipa : "")].filter(Boolean).join(" · ");
    return `
      <div class="result-item" data-id="${escapeHtml(e.id)}">
        <div class="result-top">
          <div class="word">${escapeHtml(e.headword || "—")}</div>
          <div class="badge">${starred} ${escapeHtml(badge)}</div>
        </div>
        <p class="gloss">${escapeHtml(e.gloss || "")}${sub ? " · " + escapeHtml(sub) : ""}</p>
      </div>
    `;
  }).join("");

  $$(".result-item").forEach(el => el.addEventListener("click", () => selectEntry(el.dataset.id)));

  if (!state.selectedId && items[0]) selectEntry(items[0].id);

  if (items.length === 0) {
    state.selectedId = null;
    els.entry.classList.add("empty");
    els.entry.innerHTML = `<p>没有结果。换个关键词试试（支持 nung2 / nung / nùng / IPA / 英文关键词）。</p>`;
    els.btnStar.disabled = true;
    els.btnCopy.disabled = true;
  }
}

async function renderEntry(e) {
  const isStarred = state.starred.has(e.id);
  const pron = e.pron || {};
  const metaBits = [
    e.dialectLabel ? `<span class="kv">${escapeHtml(e.dialectLabel)}</span>` : "",
    e.posLabel ? `<span class="kv">${escapeHtml(e.posLabel)}</span>` : (e.pos ? `<span class="kv">${escapeHtml(e.pos)}</span>` : ""),
    pron.roman ? `<span class="kv">${escapeHtml(pron.roman)}</span>` : "",
    (state.showIPA && pron.ipa) ? `<span class="kv">IPA ${escapeHtml(pron.ipa)}</span>` : "",
    (e.tags || []).map(t => `<span class="kv">${escapeHtml(t)}</span>`).join("")
  ].filter(Boolean).join("");

  const senses = (e.senses || []).map((s, i) => `<p class="example">${i + 1}. ${escapeHtml(s)}</p>`).join("");
  const examples = (e.examples || []).map(ex => `
    <div class="example">
      <div>${escapeHtml(ex.zh || "")}</div>
      <div style="color:#999;margin-top:6px;">${escapeHtml(ex.note || "")}</div>
    </div>
  `).join("");

  const audioKey = `entry:${e.id}`;
  const blob = state.showAudio ? await AudioDB.get(audioKey) : null;
  const hasBlob = !!blob;
  const blobUrl = hasBlob ? URL.createObjectURL(blob) : null;

  els.entry.classList.remove("empty");
  els.entry.innerHTML = `
    <h3>${escapeHtml(e.headword || "—")}</h3>
    <div class="meta">${metaBits || ""}</div>

    <div class="section">
      <h3>释义</h3>
      <p style="margin-bottom:14px;">${escapeHtml(e.gloss || "")}</p>
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
          本机保存：IndexedDB。上传到 Drive：需要把 apps_script.gs 部署成 Web App。
        </p>
        <div class="controls">
          <button id="btnMic" class="btn">开启麦克风</button>
          <button id="btnRec" class="btn" disabled>开始录音</button>
          <button id="btnStop" class="btn" disabled>停止录音</button>
          <button id="btnSaveAudio" class="btn" disabled>保存到本机</button>
          <button id="btnUploadDrive" class="btn" ${hasBlob ? "" : "disabled"}>上传到我的 Drive</button>
          <button id="btnDelAudio" class="btn btn-ghost" ${hasBlob ? "" : "disabled"}>删除本机录音</button>
          <button id="btnDownloadAudio" class="btn btn-ghost" ${hasBlob ? "" : "disabled"}>下载录音</button>
        </div>
        <p class="small" id="audioStatus">${hasBlob ? "已保存本机录音 ✅" : "暂无录音"}</p>
        <p class="small" id="driveStatus">—</p>
        <audio id="audioPlayer" controls style="width:100%; display:${hasBlob ? "block" : "none"}" src="${hasBlob ? blobUrl : ""}"></audio>
      </div>
    ` : ""}
  `;

  els.btnStar.disabled = false;
  els.btnStar.textContent = isStarred ? "★" : "☆";
  els.btnCopy.disabled = false;

  if (state.showAudio) wireRecorderAndDrive(audioKey, e);
}

function selectEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  state.selectedId = id;
  renderEntry(e);
}

// ---------- recorder + Drive upload ----------
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

function safeFilename(s) {
  return String(s || "audio").replace(/[\\/:*?"<>|]/g, "_").slice(0, 50);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const idx = dataUrl.indexOf("base64,");
      if (idx === -1) return reject(new Error("No base64"));
      resolve(dataUrl.slice(idx + 7));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function uploadToDrive(entryId, headword, blob) {
  if (!DRIVE_UPLOAD_ENDPOINT) {
    throw new Error("DRIVE_UPLOAD_ENDPOINT 为空：请先粘贴 Apps Script Web App URL");
  }
  const mimeType = blob.type || "audio/webm";
  const ext = mimeType.includes("mp4") ? "m4a" : (mimeType.includes("webm") ? "webm" : "dat");
  const filename = `${safeFilename(headword || entryId)}_${entryId}_${new Date().toISOString().replace(/[:.]/g,"-")}.${ext}`;

  const dataBase64 = await blobToBase64(blob);
  const payload = { entryId, filename, mimeType, dataBase64 };

  const resp = await fetch(DRIVE_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const out = await resp.json();
  if (!out.ok) throw new Error(out.error || "Upload failed");
  return out;
}

function wireRecorderAndDrive(audioKey, entryObj) {
  const btnMic = $("#btnMic");
  const btnRec = $("#btnRec");
  const btnStop = $("#btnStop");
  const btnSave = $("#btnSaveAudio");
  const btnUp = $("#btnUploadDrive");
  const btnDel = $("#btnDelAudio");
  const btnDl = $("#btnDownloadAudio");
  const audioStatus = $("#audioStatus");
  const driveStatus = $("#driveStatus");
  const audioPlayer = $("#audioPlayer");

  let stream = null;
  let recorder = null;
  let chunks = [];
  let blob = null;
  let url = null;

  const setA = (m) => { if (audioStatus) audioStatus.textContent = m; };
  const setD = (m) => { if (driveStatus) driveStatus.textContent = m; };

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
    btnUp.disabled = true;
    setD("—");

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
    setA("已保存本机录音 ✅");
    btnDel.disabled = false;
    btnDl.disabled = false;
    btnUp.disabled = false;

    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    if (audioPlayer) {
      audioPlayer.src = url;
      audioPlayer.style.display = "block";
    }
  });

  btnUp?.addEventListener("click", async () => {
    try {
      btnUp.disabled = true;
      setD("上传中…");
      const saved = await AudioDB.get(audioKey);
      if (!saved) throw new Error("本机没有录音：先保存到本机");
      const out = await uploadToDrive(entryObj.id, entryObj.headword, saved);
      setD(`上传成功 ✅ ${out.fileName} ｜ 打开：${out.viewUrl}`);
    } catch (e) {
      console.error(e);
      setD(`上传失败：${e.message || e}`);
    } finally {
      btnUp.disabled = false;
    }
  });

  btnDel?.addEventListener("click", async () => {
    await AudioDB.del(audioKey);
    setA("已删除本机录音");
    btnDel.disabled = true;
    btnDl.disabled = true;
    btnUp.disabled = true;
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
    const fn = `${safeFilename(entryObj.headword || entryObj.id)}_${new Date().toISOString().replace(/[:.]/g,"-")}.${ext}`;
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

    // pron fields (optional in CSV)
    const pron = {};
    if (obj.roman) pron.roman = obj.roman;
    if (obj.ipa) pron.ipa = obj.ipa;
    if (obj.alt) pron.alt = obj.alt.split("||").map(s=>s.trim()).filter(Boolean);
    if (obj.tone) pron.tone = obj.tone;
    obj.pron = pron;

    if (obj.syllables) obj.syllables = obj.syllables.split("||").map(s=>s.trim()).filter(Boolean);
    else obj.syllables = pron.roman ? [pron.roman] : [];

    const search = {};
    if (obj.aliases) search.aliases = obj.aliases.split("||").map(s=>s.trim()).filter(Boolean);
    if (obj.keywords) search.keywords = obj.keywords.split("||").map(s=>s.trim()).filter(Boolean);
    obj.search = search;

    if (!obj.id) obj.id = `${obj.dialect || "gn_hakka"}_${obj.headword || "entry"}_${i}`;
    if (!obj.headword) obj.headword = obj.word || "";
    if (!obj.dialect) obj.dialect = "gannan_hakka";
    if (!obj.dialectLabel) obj.dialectLabel = "赣南客家话";

    // cleanup
    delete obj.roman; delete obj.ipa; delete obj.alt; delete obj.tone; delete obj.aliases; delete obj.keywords;

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
      if (!e.dialect) e.dialect = "gannan_hakka";
      if (!e.dialectLabel) e.dialectLabel = "赣南客家话";
      e.pron = e.pron || {};
      e.search = e.search || {};
      e.syllables = e.syllables || (e.pron.roman ? [e.pron.roman] : []);
      e._searchText = buildSearchText(e);
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
  const clean = entries.map(({ _searchText, ...rest }) => rest);
  const text = JSON.stringify(clean, null, 2);
  const fn = `gn_hakka_entries_${new Date().toISOString().slice(0,10)}.json`;
  downloadText(fn, text);
  els.exportStatus.textContent = `已导出：${fn}`;
}

async function resetData() {
  localStorage.removeItem(STORE_KEYS.entries);
  entries = baseEntries.map(e => ({ ...e }));
  entries.forEach(e => e._searchText = buildSearchText(e));
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
    const e = entries.find(x => x.id === state.selectedId);
    if (!e) return;
    const pron = e.pron || {};
    const text = [
      `词：${e.headword || ""}`,
      `方言：${e.dialectLabel || e.dialect || ""}`,
      `词性：${e.posLabel || e.pos || ""}`,
      pron.roman ? `转写：${pron.roman}` : "",
      pron.ipa ? `IPA：${pron.ipa}` : "",
      `释义：${e.gloss || ""}`,
      (e.examples && e.examples[0]) ? `例句：${e.examples[0].zh}${e.examples[0].note ? "（" + e.examples[0].note + "）" : ""}` : ""
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

// ---------- init ----------
async function loadBaseEntries() {
  const resp = await fetch("./data/entries.json", { cache: "no-store" });
  if (!resp.ok) throw new Error("无法读取 data/entries.json");
  return await resp.json();
}

function fillExamples() {
  els.csvExample.textContent =
`id,headword,dialect,dialectLabel,pos,posLabel,roman,ipa,alt,tone,gloss,senses,examples,tags,syllables,aliases,keywords
gn_hakka_nung2,侬,gannan_hakka,赣南客家话,pron,代词,nung2,[nuŋ˧˥],"nung||nùng",2,你（第二人称）,"你（第二人称代词）","侬来无？::你来吗？","常用","nung2","你||侬仔","2sg||second person"`;

  els.jsonExample.textContent =
`[
  {
    "id": "gn_hakka_nung2",
    "headword": "侬",
    "dialect": "gannan_hakka",
    "dialectLabel": "赣南客家话",
    "pos": "pron",
    "posLabel": "代词",
    "pron": { "roman": "nung2", "ipa": "[nuŋ˧˥]", "tone": "2", "alt": ["nung", "nùng"] },
    "gloss": "你（第二人称）",
    "senses": ["你（第二人称代词）"],
    "examples": [{"zh":"侬来无？","note":"你来吗？"}],
    "tags": ["常用"],
    "syllables": ["nung2"],
    "search": { "aliases": ["你","侬仔"], "keywords": ["2sg","second person"] }
  }
]`;
}

async function init() {
  fillExamples();
  await AudioDB.open();

  baseEntries = await loadBaseEntries();
  baseEntries.forEach(e => e._searchText = buildSearchText(e));

  const local = loadEntriesLocal();
  entries = Array.isArray(local) && local.length ? local : baseEntries.map(e => ({ ...e }));
  entries.forEach(e => e._searchText = e._searchText || buildSearchText(e));

  wireChips();
  wireTopActions();

  els.btnSearch.addEventListener("click", doSearch);
  els.q.addEventListener("keydown", (ev) => { if (ev.key === "Enter") doSearch(); });
  els.q.addEventListener("input", () => { renderResults(); });

  els.toggleIPA.addEventListener("change", () => {
    state.showIPA = !!els.toggleIPA.checked;
    renderResults();
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
