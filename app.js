/* 考公政治常识 · 每日刷题 + 四级核心 2000 词  v2 */
(function () {
  'use strict';

  var appEl = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var LETTERS = 'ABCDEFGH';
  var ISSUES = (window.KG_ISSUES || []).slice().sort(function (a, b) { return b.issue - a.issue; });
  var PLAN = (window.KG_VOCAB_PLAN || []).slice().sort(function (a, b) { return a.n - b.n; });
  var VBATCH = window.KG_VOCAB || [];
  var NEWS = (window.KG_NEWS || []).slice().sort(function (a, b) { return b.id - a.id; });
  var VBATCH_SIZE = 20;
  var DEADLINE = '2026-11-15';

  /* ================= 档案（多用户） ================= */
  var PS_KEY = 'kg_profiles', CU_KEY = 'kg_current';
  var PID = null;

  function loadProfiles() {
    try { var a = JSON.parse(localStorage.getItem(PS_KEY)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveProfiles(a) { try { localStorage.setItem(PS_KEY, JSON.stringify(a)); } catch (e) {} }
  function curProfile() {
    var ps = loadProfiles();
    for (var i = 0; i < ps.length; i++) if (ps[i].id === PID) return ps[i];
    return null;
  }
  function lsKey(base) { return base + '::' + (PID || 'anon'); }

  /* ================= 存储 ================= */
  var store = { p: {} };
  var vstore = { w: {} };
  function loadAll() {
    try { var o = JSON.parse(localStorage.getItem(lsKey('kg_quiz_v2'))); store = (o && o.p) ? o : { p: {} }; } catch (e) { store = { p: {} }; }
    try { var v = JSON.parse(localStorage.getItem(lsKey('kg_vocab_v1'))); vstore = (v && v.w) ? { w: v.w, t: v.t || {} } : { w: {}, t: {} }; } catch (e) { vstore = { w: {}, t: {} }; }
  }
  function saveStore() { try { localStorage.setItem(lsKey('kg_quiz_v2'), JSON.stringify(store)); } catch (e) {} scheduleSync(); }
  function saveVStore() { try { localStorage.setItem(lsKey('kg_vocab_v1'), JSON.stringify(vstore)); } catch (e) {} scheduleSync(); }
  function progOf(id) { if (!store.p[id]) store.p[id] = { ans: {}, updated: Date.now() }; return store.p[id]; }

  /* ================= 账号 / 云同步（ID + 密码，全设备互联） =================
     存储：textdb.dev 公开 KV（免注册、CORS 全开）
       kg-accounts     注册表 {v:1, ids:{ "<小写ID>": {id, pwd:"salt$hash", created, dk} }}
       kg-u-<dk>       该 ID 的全部数据 {v:1, id, updated, accounts:[], data:{ pid:{quiz,vocab,diary} } }
     规则：ID 唯一（建过就不能再注册）、一个 ID 一个密码、一个 ID 对应这一份数据。
     合并：逐条目按时间戳取新（答题记录 / 单词掌握度 / 日记），删除写时间戳墓碑，所以不会互相覆盖。
     ⚠️ 老实话：密码校验跑在浏览器里，KV 也没有写权限控制 → 这套是「够用级的门」，挡不住技术高手。
        别用和你其他账号相同的密码，也别放敏感内容。要真安全必须上后端。 */
  var SYNC_API = 'https://textdb.dev/api/data/';
  var ACC_REG = 'kg-accounts';
  var ACCT = { id: null, dk: null, status: '', at: 0, busy: false };
  var pushTimer = null;
  var GATE = { mode: 'login', err: '', busy: false };

  function apiGet(key) {
    return fetch(SYNC_API + key + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('GET ' + r.status);
      return r.text();
    }).then(function (t) {
      t = (t || '').trim();
      if (!t || t === 'null' || t === '[]' || t.charAt(0) !== '{') return null;
      return JSON.parse(t);
    });
  }
  function apiPut(key, obj) {
    return fetch(SYNC_API + key, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    }).then(function (r) { if (!r.ok) throw new Error('POST ' + r.status); return true; });
  }

  function normId(s) { return String(s == null ? '' : s).replace(/[\s\u3000]/g, '').slice(0, 16); }
  function simpleHash(s) {
    var h1 = 0x811c9dc5, h2 = 5381;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = ((h1 ^ c) * 16777619) >>> 0;
      h2 = ((h2 * 33) ^ c) >>> 0;
    }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }
  function dkOf(id) { return 'kg-u-' + simpleHash(normId(id).toLowerCase()); }
  function randSalt() { return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8); }
  function fallbackHash(salt, pwd) {
    var x = String(salt) + '|' + String(pwd);
    for (var i = 0; i < 300; i++) x = simpleHash(x + salt + i);
    return x;
  }
  function shaHash(salt, pwd, cb) {
    try {
      if (!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest) || !window.TextEncoder) return cb(null);
      var enc = new TextEncoder();
      (function step(acc, n) {
        return window.crypto.subtle.digest('SHA-256', enc.encode(acc)).then(function (buf) {
          var b = new Uint8Array(buf), hex = '';
          for (var i = 0; i < b.length; i++) hex += ('0' + b[i].toString(16)).slice(-2);
          if (n >= 60) return cb(hex.slice(0, 48));
          return step(String(salt) + hex, n + 1);
        });
      })(String(salt) + '|' + String(pwd), 1)['catch'](function () { cb(null); });
    } catch (e) { cb(null); }
  }
  /* 优先 SHA-256（https 环境），失败则用内置兜底哈希（局域网 http 等非安全上下文） */
  function hashPwd(pwd, salt, cb) { shaHash(salt, pwd, function (h) { cb(h || fallbackHash(salt, pwd)); }); }
  function pwdOk(pwd, salt, stored) {
    if (!stored) return false;
    var s = String(stored);
    if (fallbackHash(salt, pwd) === s) return true;
    return false;
  }

  function saveSession() { try { localStorage.setItem('kg_session', JSON.stringify({ id: ACCT.id, dk: ACCT.dk, at: Date.now() })); } catch (e) {} }
  function loadSession() {
    try {
      var o = JSON.parse(localStorage.getItem('kg_session') || 'null');
      if (o && o.id) { ACCT.id = o.id; ACCT.dk = o.dk || dkOf(o.id); }
    } catch (e) {}
  }
  function clearSession() {
    ACCT.id = null; ACCT.dk = null; ACCT.status = ''; ACCT.at = 0;
    try { localStorage.removeItem('kg_session'); } catch (e) {}
  }

  function ensureProfile(id) {
    var ps = loadProfiles(), old = null;
    for (var i = 0; i < ps.length; i++) if (ps[i].name === id || ps[i].id === id) old = ps[i];
    if (!old && ps.length === 1) old = ps[0];
    if (old && old.id !== id) {
      ['kg_quiz_v2', 'kg_vocab_v1', 'kg_diary_v1'].forEach(function (b) {
        try {
          var v = localStorage.getItem(b + '::' + old.id);
          if (v && !localStorage.getItem(b + '::' + id)) localStorage.setItem(b + '::' + id, v);
        } catch (e) {}
      });
    }
    saveProfiles([{ id: id, name: id, created: (old && old.created) || new Date().toISOString() }]);
    try { localStorage.setItem(CU_KEY, id); } catch (e) {}
  }

  function acctSync(then) {
    if (!ACCT.id) { if (then) then(); return; }
    if (ACCT.busy) { if (then) then(); return; }
    ACCT.busy = true; ACCT.status = '同步中…';
    if (S.view === 'sync') render();
    var local = localSpace();
    apiGet(ACCT.dk).then(function (remote) {
      var merged = mergeSpace(local, remote);
      merged.id = ACCT.id; merged.updated = Date.now();
      applySpace(merged);
      return apiPut(ACCT.dk, merged).then(function () {
        ACCT.busy = false; ACCT.at = Date.now(); ACCT.status = '已同步';
        loadAll();
        if (S.view === 'sync' || S.view === 'home' || S.view === 'stat') render();
        if (then) then();
      });
    }).catch(function () {
      ACCT.busy = false; ACCT.status = '离线：连不上服务器，改动先存在本机';
      if (S.view === 'sync') render();
      if (then) then();
    });
  }
  function scheduleSync() {
    if (!ACCT.id) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { acctSync(); }, 1800);
  }

  function doRegister() {
    var id = normId(valOf('accid')), p1 = valOf('accpwd'), p2 = valOf('accpwd2');
    if (GATE.busy) return;
    if (id.length < 2) return gateErr('ID 至少 2 个字');
    if (!p1 || p1.length < 4) return gateErr('密码至少 4 位');
    if (p1 !== p2) return gateErr('两次输入的密码不一样');
    GATE.busy = true; GATE.err = ''; GATE.mode = 'register'; renderGate();
    apiGet(ACC_REG).then(function (reg) {
      reg = (reg && reg.ids) ? reg : { v: 1, ids: {} };
      var key = id.toLowerCase();
      if (reg.ids[key]) {
        GATE.busy = false;
        return gateErr('「' + id + '」这个 ID 已经被注册了 —— 换一个，或者直接去登录');
      }
      var salt = randSalt();
      hashPwd(p1, salt, function (ph) {
        reg.ids[key] = { id: id, pwd: salt + '$' + ph, created: Date.now(), dk: dkOf(id) };
        apiPut(ACC_REG, reg).then(function () {
          GATE.busy = false;
          ACCT.id = id; ACCT.dk = dkOf(id); ACCT.status = '首次同步…';
          saveSession(); ensureProfile(id);
          PID = id; loadAll();
          location.hash = '#/'; applyHash(); render();
          acctSync(function () { toast('注册成功，以后换设备用「' + id + '」+ 密码登录就行 ✅'); });
        })['catch'](function () {
          GATE.busy = false;
          gateErr('注册没成功：连不上服务器（可能网络不通），稍后再试');
        });
      });
    })['catch'](function () {
      GATE.busy = false;
      gateErr('连不上服务器：检查网络后重试');
    });
  }

  function doLogin() {
    var id = normId(valOf('accid')), p1 = valOf('accpwd');
    if (GATE.busy) return;
    if (!id) return gateErr('先填 ID');
    if (!p1) return gateErr('先填密码');
    GATE.busy = true; GATE.err = ''; GATE.mode = 'login'; renderGate();
    apiGet(ACC_REG).then(function (reg) {
      var e = (reg && reg.ids) ? reg.ids[id.toLowerCase()] : null;
      if (!e) { GATE.busy = false; return gateErr('没有「' + id + '」这个 ID，先去注册一个吧'); }
      var parts = String(e.pwd || '').split('$');
      hashPwd(p1, parts[0], function (ph) {
        if (ph !== parts[1] && !pwdOk(p1, parts[0], parts[1])) { GATE.busy = false; return gateErr('密码不对，再想想（密码找不回来，只能重新注册）'); }
        GATE.busy = false;
        ACCT.id = e.id; ACCT.dk = e.dk || dkOf(e.id); ACCT.status = '正在拉取云端数据…';
        saveSession(); ensureProfile(e.id);
        PID = e.id; loadAll();
        location.hash = ''; applyHash(); S.view = 'home'; S.subject = 'quiz';
        render(); syncHash();
        acctSync(function () { toast('欢迎回来，' + e.id + '（数据已和其他设备对齐）'); });
      });
    })['catch'](function () {
      GATE.busy = false;
      gateErr('连不上服务器：检查网络后重试');
    });
  }

  function doLogout() {
    if (!window.confirm('退出登录？本机保留数据，换设备用同一个 ID + 密码登录即可看到同一份数据。')) return;
    clearSession();
    PID = null; store = { p: {} }; vstore = { w: {} };
    try { localStorage.removeItem(CU_KEY); } catch (e) {}
    try { localStorage.removeItem('kg_profiles'); } catch (e) {}
    location.hash = '';
    GATE.mode = 'login'; GATE.err = '';
    renderGate();
  }

  function gateErr(msg) { GATE.err = msg; renderGate(); }
  function valOf(id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; }

  /* 连不上服务器时的兜底：先用本机，数据不丢，之后注册/登录会把本机数据带上去 */
  function offlineGo() {
    var id = normId(valOf('accid')) || '本机用户';
    ACCT.id = null; ACCT.dk = null; ACCT.status = '';
    try { localStorage.removeItem('kg_session'); } catch (e) {}
    ensureProfile(id);
    PID = id; loadAll();
    location.hash = ''; S.view = 'home'; S.subject = 'quiz';
    render(); syncHash();
    toast('已进入离线模式：数据只存本机，之后可在「账号与同步」里登录并上传');
  }
  function goGate() {
    PID = null;
    try { localStorage.removeItem(CU_KEY); } catch (e) {}
    location.hash = '';
    GATE.mode = 'login'; GATE.err = ''; GATE.busy = false;
    renderGate();
    window.scrollTo(0, 0);
  }



  function readLocal(p) {
    var q = null, v = null, d = null;
    try { q = JSON.parse(localStorage.getItem('kg_quiz_v2::' + p) || 'null'); } catch (e) {}
    try { v = JSON.parse(localStorage.getItem('kg_vocab_v1::' + p) || 'null'); } catch (e) {}
    try { d = JSON.parse(localStorage.getItem('kg_diary_v1::' + p) || 'null'); } catch (e) {}
    return {
      quiz: (q && q.p) ? q : { p: {} },
      vocab: (v && v.w) ? { w: v.w, t: v.t || {} } : { w: {}, t: {} },
      diary: (d && typeof d === 'object') ? d : {}
    };
  }

  function localSpace() {
    var accs = loadProfiles(), data = {};
    accs.forEach(function (p) { data[p.id] = readLocal(p.id); });
    if (PID && !data[PID]) { data[PID] = { quiz: store, vocab: { w: vstore.w, t: vstore.t || {} }, diary: loadDiary() }; }
    return { v: 1, updated: Date.now(), accounts: accs, data: data };
  }

  function mergeQuizObj(a, b) {
    a = a || { p: {} }; b = b || { p: {} };
    var out = { p: {} }, ids = {};
    Object.keys(a.p || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(b.p || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (k) {
      var la = (a.p || {})[k] || { ans: {}, updated: 0 }, lb = (b.p || {})[k] || { ans: {}, updated: 0 };
      var ans = {}, keys = {};
      Object.keys(la.ans || {}).forEach(function (i) { keys[i] = 1; });
      Object.keys(lb.ans || {}).forEach(function (i) { keys[i] = 1; });
      Object.keys(keys).forEach(function (i) {
        var ea = (la.ans || {})[i], eb = (lb.ans || {})[i];
        if (!ea) ans[i] = eb;
        else if (!eb) ans[i] = ea;
        else ans[i] = ((eb.ts || 0) > (ea.ts || 0)) ? eb : ea;
      });
      out.p[k] = { ans: ans, updated: Math.max(la.updated || 0, lb.updated || 0) };
    });
    return out;
  }
  function mergeVocabObj(a, b) {
    a = a || { w: {}, t: {} }; b = b || { w: {}, t: {} };
    var w = {}, t = {};
    [a, b].forEach(function (src) {
      Object.keys(src.w || {}).forEach(function (k) {
        var ts = (src.t || {})[k] || 0;
        if (!(k in w) || ts > (t[k] || 0)) { w[k] = src.w[k]; t[k] = ts; }
      });
    });
    return { w: w, t: t };
  }
  function mergeDiaryObj(a, b) {
    a = a || {}; b = b || {};
    var out = {}, ks = {};
    Object.keys(a).forEach(function (k) { ks[k] = 1; });
    Object.keys(b).forEach(function (k) { ks[k] = 1; });
    Object.keys(ks).forEach(function (k) {
      var x = normEntry(a[k]), y = normEntry(b[k]);
      if (!y) { out[k] = x; return; }
      if (!x) { out[k] = y; return; }
      out[k] = (y.u || 0) > (x.u || 0) ? y : x;
    });
    return out;
  }
  function normEntry(v) {
    if (v == null) return null;
    if (typeof v === 'string') return { t: v, u: 0 };
    if (typeof v === 'object') return { t: String(v.t || ''), u: v.u || 0 };
    return null;
  }
  function mergeSpace(a, b) {
    var out = { v: 1, updated: Date.now(), accounts: [], data: {} };
    var byId = {};
    [a, b].forEach(function (sp) {
      if (!sp) return;
      (sp.accounts || []).forEach(function (p) {
        if (!p || !p.id) return;
        if (!byId[p.id]) { byId[p.id] = p; out.accounts.push(p); }
      });
    });
    var ids = {};
    [a, b].forEach(function (sp) { if (sp) Object.keys(sp.data || {}).forEach(function (k) { ids[k] = 1; }); });
    Object.keys(ids).forEach(function (pid) {
      var da = ((a || {}).data || {})[pid] || {}, db = ((b || {}).data || {})[pid] || {};
      out.data[pid] = {
        quiz: mergeQuizObj(da.quiz, db.quiz),
        vocab: mergeVocabObj(da.vocab, db.vocab),
        diary: mergeDiaryObj(da.diary, db.diary)
      };
    });
    out.updated = Math.max((a && a.updated) || 0, (b && b.updated) || 0, Date.now());
    return out;
  }

  function applySpace(sp) {
    if (!sp) return;
    var ps = loadProfiles(), changed = false;
    (sp.accounts || []).forEach(function (p) {
      var hit = null;
      for (var i = 0; i < ps.length; i++) if (ps[i].id === p.id) hit = ps[i];
      if (!hit) { ps.push(p); changed = true; }
    });
    if (changed) saveProfiles(ps);
    Object.keys(sp.data || {}).forEach(function (pid) {
      var cur = readLocal(pid), nx = sp.data[pid];
      var q = mergeQuizObj(cur.quiz, nx.quiz), v = mergeVocabObj(cur.vocab, nx.vocab), d = mergeDiaryObj(cur.diary, nx.diary);
      try {
        localStorage.setItem('kg_quiz_v2::' + pid, JSON.stringify(q));
        localStorage.setItem('kg_vocab_v1::' + pid, JSON.stringify(v));
        localStorage.setItem('kg_diary_v1::' + pid, JSON.stringify(d));
      } catch (e) {}
    });
  }

  function syncNow(then) { acctSync(then); }

  /* ================= 状态 ================= */
  var S = {
    view: 'home', subject: 'quiz', issueId: null, idx: 0, picked: [], judged: false,
    batch: 1, vIdx: 0, revealed: false, rev: null, newsId: null, goldCat: '全部',
    diaryYm: null, diaryDate: null,
  };

  function currentIssue() {
    for (var i = 0; i < ISSUES.length; i++) if (ISSUES[i].issue === S.issueId) return ISSUES[i];
    return null;
  }
  function isRight(item, picked) {
    var a = (item.q.answer || []).slice().sort().join('');
    var p = picked.slice().sort().join('');
    return a === p && p.length > 0;
  }

  /* ================= 工具 ================= */
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function fmtDate(d) {
    if (!d) return '';
    var p = String(d).split('-'); if (p.length < 3) return d;
    return parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日';
  }
  function typeName(t) { return t === 'multi' ? '多选' : '单选'; }
  function daysLeft() {
    var now = new Date(), end = new Date(DEADLINE + 'T23:59:59');
    return Math.max(0, Math.ceil((end - now) / 86400000));
  }
  function speak(w) {
    try {
      if (!window.speechSynthesis) return toast('这个浏览器不支持发音');
      var u = new SpeechSynthesisUtterance(w);
      u.lang = 'en-US'; u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ================= 背单词 · 数据 ================= */
  function planTotal() { return PLAN.length; }
  function batchCount() { return Math.max(1, Math.ceil(planTotal() / VBATCH_SIZE)); }
  function batchWords(b) {
    var s = (b - 1) * VBATCH_SIZE;
    return PLAN.slice(s, s + VBATCH_SIZE).map(function (r) { return { n: r.n, w: r.w, ph: r.ph, cn: r.cn }; });
  }
  function batchContent(b) {
    for (var i = 0; i < VBATCH.length; i++) if (VBATCH[i].batch === b) return VBATCH[i];
    return null;
  }
  function mergeWords(b) {
    var list = batchWords(b), c = batchContent(b);
    if (!c) return list;
    var map = {};
    (c.words || []).forEach(function (x) { map[String(x.w).toLowerCase()] = x; });
    return list.map(function (x) {
      var e = map[String(x.w).toLowerCase()];
      if (!e) return x;
      return { n: x.n, w: x.w, ph: e.ph || x.ph, cn: e.cn || x.cn, eg: e.eg, egCn: e.egCn, rel: e.rel || {} };
    });
  }
  function lvlOf(w) { var v = vstore.w[String(w).toLowerCase()]; return (v === 0 || v === 1 || v === 2) ? v : null; }
  function setLvl(w, lv) { var k = String(w).toLowerCase(); vstore.w[k] = lv; vstore.t = vstore.t || {}; vstore.t[k] = Date.now(); saveVStore(); scheduleSync(); }
  function vocabStats() {
    var known = 0, fuzzy = 0, no = 0;
    Object.keys(vstore.w).forEach(function (k) {
      var v = vstore.w[k];
      if (v === 2) known++; else if (v === 1) fuzzy++; else if (v === 0) no++;
    });
    return { known: known, fuzzy: fuzzy, no: no, done: known + fuzzy + no, total: planTotal() };
  }
  function nextBatch() {
    for (var b = 1; b <= batchCount(); b++) {
      var ws = batchWords(b), ok = 0;
      for (var i = 0; i < ws.length; i++) if (lvlOf(ws[i].w) !== null) ok++;
      if (ok < ws.length) return b;
    }
    return batchCount();
  }
  function dueWords() {
    var out = [];
    PLAN.forEach(function (r) {
      var v = vstore.w[String(r.w).toLowerCase()];
      if (v === 0 || v === 1) out.push(r);
    });
    return out;
  }

  /* ================= 档案门 ================= */
  function renderGate() {
    var isReg = (GATE.mode === 'register');
    var busy = GATE.busy;
    var err = GATE.err ? '<div class="gateerr">' + h(GATE.err) + '</div>' : '';
    var body = '<div class="card">' +
      '<div class="gtabs">' +
      '<button class="gtab' + (!isReg ? ' on' : '') + '" data-act="gate-login">登录</button>' +
      '<button class="gtab' + (isReg ? ' on' : '') + '" data-act="gate-register">注册新 ID</button>' +
      '</div>' +
      '<label class="fld"><span>ID</span><input id="accid" maxlength="16" autocomplete="username" placeholder="如：西瓜" value="' + h(GATE.lastId || '') + '"></label>' +
      '<label class="fld"><span>密码</span><input id="accpwd" type="password" autocomplete="' + (isReg ? 'new-password' : 'current-password') + '" placeholder="' + (isReg ? '至少 4 位' : '') + '"></label>' +
      (isReg ? '<label class="fld"><span>再输一遍</span><input id="accpwd2" type="password" autocomplete="new-password" placeholder="确认密码"></label>' : '') +
      err +
      '<button class="btn lg block" data-act="' + (isReg ? 'register' : 'login') + '">' +
      (busy ? '处理中…' : (isReg ? '注册并开始' : '登录')) + '</button>' +
      '<div class="summary-box small muted" style="margin-top:14px">' +
      (isReg
        ? '📌 <b>ID 是唯一的</b>：注册过的 ID 别人（包括你）都注册不了第二次。<b>一个 ID 对应一份数据</b> —— 手机、平板、电脑都登同一个 ID，看到的就是同一份进度、同一本生词本、同一本日志。'
        : '📌 用你注册时那个 ID + 密码登录，数据会自动和云端对齐。<b>密码丢了就找不回来</b>（没有后台也没有客服），只能换个 ID 重新开始。') +
      '</div>' +
      '<div class="small muted" style="margin-top:10px">⚠️ 说句实话：密码校验是在浏览器里做的，数据放在免费的公开存储上 —— 这是一扇「够用的门」，挡得住顺手的人，挡不住技术高手。别用你其他账号的密码，也别放敏感内容。</div>' +
      '</div>' +
      '<div class="row center" style="justify-content:center;margin:14px 0 24px">' +
      '<button class="btn ghost small" data-act="offline">连不上网？先离线用（数据只存本机）</button></div>';
    appEl.innerHTML = '<div class="gate">' +
      '<div class="hero"><h1>学习工作台 🧠</h1>' +
      '<div class="sub">考公政治常识 ｜ 四级 2000 词 ｜ 每日新闻 ｜ 学习日志</div></div>' + body + '</div>';
    dropFooter();
  }

  function syncCopy() {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(ACCT.id);
      toast('ID 已复制：' + ACCT.id);
    } catch (e) { toast('你的 ID：' + ACCT.id); }
  }


  /* ================= 首页 ================= */
  function cloudDot() {
    if (!ACCT.id) return '';
    if (ACCT.busy) return '<span class="cdot busy" title="同步中">☁</span>';
    if (ACCT.status && ACCT.status.indexOf('离线') === 0) return '<span class="cdot off" title="离线：改动存在本机">⚠</span>';
    return '<span class="cdot on" title="已同步">☁</span>';
  }
  function tabsHtml() {
    var p = curProfile() || { name: (ACCT.id || '?') };
    return '<div class="topbar solid">' +
      '<span class="pav sm">' + h((p.name || '?').slice(0, 1)) + '</span>' +
      '<span class="grow small"><b>' + h(p.name) + '</b>' + cloudDot() + '</span>' +
      '<button class="iconbtn" data-act="sync" title="账号与同步">☁</button>' +
      '<button class="iconbtn" data-act="logout" title="退出登录">⇄</button></div>' +
      '<div class="tabs">' +
      '<button class="tab' + (S.subject === 'quiz' ? ' on' : '') + '" data-act="tab-quiz">📕 考公刷题</button>' +
      '<button class="tab' + (S.subject === 'vocab' ? ' on' : '') + '" data-act="tab-vocab">🔤 背单词</button>' +
      '<button class="tab' + (S.subject === 'news' ? ' on' : '') + '" data-act="tab-news">📰 每日新闻</button>' +
      '<button class="tab' + (S.subject === 'gold' ? ' on' : '') + '" data-act="tab-gold">💎 申论金句</button>' +
      '<button class="tab' + (S.subject === 'diary' ? ' on' : '') + '" data-act="tab-diary">📔 学习日志</button>' +
      '</div>';
  }

  function renderHome() {
    var owner = '';
    if (isOwner()) {
      owner = '<button class="statentry" data-act="stat">📊 站点使用统计（总号专属）</button>';
    }
    appEl.innerHTML = tabsHtml() + owner + (S.subject === 'vocab' ? renderVocabHome() : (S.subject === 'news' ? renderNewsHome() : (S.subject === 'gold' ? renderGoldHome() : (S.subject === 'diary' ? renderDiary() : renderQuizHome()))));
    dropFooter();
  }

  function renderQuizHome() {
    var totalQ = 0, doneQ = 0, rightQ = 0;
    ISSUES.forEach(function (it) {
      var p = progOf(it.issue);
      (it.items || []).forEach(function (_, i) {
        totalQ++;
        var a = p.ans[i];
        if (a) { doneQ++; if (a.ok) rightQ++; }
      });
    });
    var rate = doneQ ? Math.round(rightQ / doneQ * 100) : 0;

    var cards = ISSUES.map(function (it) {
      var p = progOf(it.issue), n = (it.items || []).length, dn = 0, rt = 0;
      for (var i = 0; i < n; i++) { var a = p.ans[i]; if (a) { dn++; if (a.ok) rt++; } }
      var pct = n ? Math.round(dn / n * 100) : 0;
      var badge = dn >= n ? '<span class="tag ok">已完成 ' + rt + '/' + n + '</span>'
        : (dn ? '<span class="tag">继续 ' + dn + '/' + n + '</span>' : '<span class="tag gray">未开始</span>');
      return '<button class="issue" data-issue="' + it.issue + '">' +
        '<span class="idx">第<br>' + it.issue + '期</span>' +
        '<span class="meta">' +
        '<h3>' + fmtDate(it.date) + ' · ' + (it.session === 'pm' ? '晚间' : '早间') + '</h3>' +
        '<p>' + h(it.title || '') + '</p>' +
        '<span class="bar"><i style="width:' + pct + '%"></i></span></span>' +
        '<span class="side">' + badge + '<div class="small muted" style="margin-top:6px">' + n + ' 题</div></span>' +
        '</button>';
    }).join('');

    if (!ISSUES.length) cards = '<div class="card center muted">还没有内容，等下次推送后刷新本页～</div>';

    return '<div class="stats">' +
      '<div class="stat"><b>' + ISSUES.length + '</b><span>已更新期数</span></div>' +
      '<div class="stat"><b>' + doneQ + '/' + totalQ + '</b><span>已答题数</span></div>' +
      '<div class="stat"><b>' + rate + '%</b><span>正确率</span></div></div>' +
      '<div class="row between" style="margin:0 4px 10px"><span class="small muted">往期内容</span>' +
      '<span class="small muted">点卡片开始刷题</span></div>' + cards +
      '<div class="card small muted" style="text-align:center">每天 8:00 / 20:00 自动更新一期 · 进度存在本机浏览器</div>';
  }

  function renderVocabHome() {
    var st = vocabStats();
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    var nb = nextBatch(), due = dueWords().length, left = daysLeft();
    var per = Math.max(1, Math.ceil((st.total - st.done) / Math.max(1, left * 2)));

    var cards = '';
    for (var b = 1; b <= batchCount(); b++) {
      var ws = batchWords(b), dn = 0;
      for (var i = 0; i < ws.length; i++) if (lvlOf(ws[i].w) !== null) dn++;
      var bp = ws.length ? Math.round(dn / ws.length * 100) : 0;
      var has = !!batchContent(b);
      var tag = dn >= ws.length ? '<span class="tag ok">已背完</span>'
        : (dn ? '<span class="tag">' + dn + '/' + ws.length + '</span>'
          : (has ? '<span class="tag gray">未开始</span>' : '<span class="tag gray">待更新</span>'));
      var head = ws.length ? (ws[0].n + ' - ' + ws[ws.length - 1].n + ' 词') : '';
      var sub = ws.slice(0, 4).map(function (x) { return h(x.w); }).join(' · ');
      cards += '<button class="issue' + (dn >= ws.length ? ' done' : '') + '" data-batch="' + b + '">' +
        '<span class="idx">第<br>' + b + '批</span>' +
        '<span class="meta"><h3>' + head + '</h3>' +
        '<p class="small muted">' + sub + ' …</p>' +
        '<span class="bar"><i style="width:' + bp + '%"></i></span></span>' +
        '<span class="side">' + tag + '<div class="small muted" style="margin-top:6px">' + ws.length + ' 词</div></span>' +
        '</button>';
    }

    return '<div class="card">' +
      '<div class="between"><div><div class="kptitle">四级核心 2000 词</div>' +
      '<div class="small muted">精简版 · 每天 2 批 × 20 词 · ' + DEADLINE + ' 前背完</div></div>' +
      '<div class="bigpct">' + pct + '%</div></div>' +
      '<span class="bar lg"><i style="width:' + pct + '%"></i></span>' +
      '<div class="vstats">' +
      '<span class="vs ok">认识 ' + st.known + '</span>' +
      '<span class="vs warn">模糊 ' + st.fuzzy + '</span>' +
      '<span class="vs err">不认识 ' + st.no + '</span>' +
      '<span class="vs gray">未学 ' + (st.total - st.done) + '</span></div>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn grow" data-act="learn-next">继续学习（第 ' + nb + ' 批）</button>' +
      '<button class="btn ghost" data-act="review">复习' + (due ? ' ' + due : '') + '</button></div>' +
      '<div class="summary-box small muted" style="margin-top:10px">剩余 ' + left + ' 天 · 还差 ' + (st.total - st.done) + ' 词 · 平摊下来每批约 ' + per + ' 词</div>' +
      '</div>' +
      '<div class="card small muted">💡 点「🔊」听发音；标了「模糊 / 不认识」的词自动进生词本，复习优先考它们。</div>' +
      '<div class="row between" style="margin:0 4px 10px"><span class="small muted">批次列表</span>' +
      '<span class="small muted">共 ' + batchCount() + ' 批</span></div>' + cards;
  }

  /* ================= 每日新闻 + 申论素材 ================= */
  function newsById(id) {
    for (var i = 0; i < NEWS.length; i++) if (NEWS[i].id === id) return NEWS[i];
    return null;
  }

  function renderNewsHome() {
    var totalN = 0, totalS = 0;
    NEWS.forEach(function (n) { totalN += (n.news || []).length; totalS += (n.shenlun || []).length; });

    var cards = NEWS.map(function (n) {
      var cnt = (n.news || []).length, sl = (n.shenlun || []).length, cats = [];
      (n.news || []).forEach(function (x) { if (x.cat && cats.indexOf(x.cat) < 0) cats.push(x.cat); });
      return '<button class="issue" data-news="' + n.id + '">' +
        '<span class="idx">第<br>' + n.id + '期</span>' +
        '<span class="meta"><h3>' + fmtDate(n.date) + ' · ' + (n.slot === 'pm' ? '晚间' : '早间') + '</h3>' +
        '<p>' + h(n.brief || '') + '</p>' +
        '<span class="cats">' + cats.map(function (c) { return '<i>' + h(c) + '</i>'; }).join('') + '</span></span>' +
        '<span class="side"><span class="tag">' + cnt + ' 条</span><div class="small muted" style="margin-top:6px">金句 ' + sl + '</div></span>' +
        '</button>';
    }).join('');
    if (!NEWS.length) cards = '<div class="card center muted">还没有新闻，等下次推送后刷新本页～</div>';

    return '<div class="stats">' +
      '<div class="stat"><b>' + NEWS.length + '</b><span>已更新期数</span></div>' +
      '<div class="stat"><b>' + totalN + '</b><span>精读条数</span></div>' +
      '<div class="stat"><b>' + totalS + '</b><span>申论金句</span></div></div>' +
      '<div class="row between" style="margin:0 4px 10px"><span class="small muted">往期精读</span>' +
      '<span class="small muted">点开看全文 + 申论金句</span></div>' + cards +
      '<div class="card small muted" style="text-align:center">每天更新一期 · 只挑 2~3 条精读，末尾附可直接上考场的申论金句</div>';
  }

  function renderNewsDetail() {
    var it = newsById(S.newsId); if (!it) return goHome();
    var list = it.news || [], sl = it.shenlun || [];

    var groups = [], gmap = {};
    list.forEach(function (n, i) {
      var c = n.cat || '要闻';
      if (!gmap[c]) { gmap[c] = { cat: c, items: [] }; groups.push(gmap[c]); }
      gmap[c].items.push({ n: n, i: i });
    });

    var body = groups.map(function (g) {
      return '<div class="sechead">' + h(g.cat) + '</div>' + g.items.map(function (o) {
        var n = o.n;
        return '<div class="card">' +
          '<div class="between" style="margin-bottom:8px"><span class="tag gray">' + h(n.cat || '要闻') + '</span>' +
          '<span class="small muted">' + (o.i + 1) + ' / ' + list.length + '</span></div>' +
          '<div class="nh">' + h(n.h) + '</div>' +
          '<div class="np">' + h(n.p) + '</div>' +
          (n.why ? '<div class="why"><div class="wh">🧭 为什么重要</div>' + h(n.why) + '</div>' : '') +
          (n.src ? '<div class="small muted" style="margin-top:8px">来源：' + h(n.src) + '</div>' : '') +
          '</div>';
      }).join('');
    }).join('');

    var nav = groups.length > 1 ? '<div class="chips">' + groups.map(function (g) {
      return '<span class="chip">' + h(g.cat) + ' ' + g.items.length + '</span>';
    }).join('') + '</div>' : '';

    var slHtml = sl.map(function (s, i) {
      var cases = (s.cases || []).map(function (c, j) {
        return '<div class="slcase"><span class="cn">' + (j + 1) + '</span>' +
          '<span class="ct"><b>' + h(c.n) + '</b>' + h(c.d) + '</span></div>';
      }).join('');
      return '<div class="card slcard">' +
        '<div class="between" style="margin-bottom:10px"><span class="slnum">金句 ' + (i + 1) + '</span>' +
        '<button class="btn gray" style="padding:5px 11px;font-size:12.5px" data-sl="' + it.id + '-' + i + '">复制</button></div>' +
        '<div class="sltopic">📌 ' + h(s.topic) + '</div>' +
        (s.pattern ? '<span class="pat">' + h(s.pattern) + '</span>' : '') +
        '<div class="slquote">' + h(s.sentence) + '</div>' +
        '<div class="slk">🧩 句中的案例（可替换）</div>' + cases +
        (s.swap ? '<div class="slk">🔄 换个领域怎么写</div><div class="slp">' + h(s.swap) + '</div>' : '') +
        '<div class="slk">✍️ 怎么引用</div><div class="slp">' + h(s.use) + '</div>' +
        '<div class="slk">🔍 背后的故事</div><div class="slp">' + h(s.back) + '</div>' +
        '</div>';
    }).join('');

    appEl.innerHTML = '<div class="topbar solid">' +
      '<button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small"><b>第 ' + it.id + ' 期 · ' + fmtDate(it.date) + '</b>' +
      '<div class="muted" style="font-size:12px">' + (it.slot === 'pm' ? '晚间' : '早间') + '精读 · ' + list.length + ' 条 · 金句 ' + sl.length + ' 条</div></span>' +
      (NEWS.length > 1 ? '<button class="iconbtn" data-act="news-older" title="往期">📚</button>' : '') + '</div>' +
      nav + (it.brief ? '<div class="card small muted">🗞 ' + h(it.brief) + '</div>' : '') + body +
      '<div class="sechead">📝 申论金句（' + sl.length + ' 条）</div>' +
      '<div class="card small muted">每句话都能直接搬进考场：<b>句式</b>给你骨架，<b>案例</b>给你血肉（可随手替换）；「怎么引用」说落笔位置，「背后的故事」把新闻读成论证材料。</div>' +
      slHtml +
      '<button class="btn ghost block" data-act="home" style="margin-bottom:24px">← 返回新闻列表</button>';
    dropFooter();
  }

  function copySl(id, i) {
    var it = newsById(id), s = it && it.shenlun ? it.shenlun[i] : null;
    if (!s) return;
    var cs = (s.cases || []).map(function (c, j) { return '  ' + (j + 1) + '. ' + c.n + '——' + c.d; }).join('\n');
    var txt = '【适用主题】' + s.topic + (s.pattern ? '（' + s.pattern + '）' : '') +
      '\n【金句】' + s.sentence +
      (cs ? '\n【句中案例】\n' + cs : '') +
      (s.swap ? '\n【换个领域】' + s.swap : '') +
      '\n【怎么引用】' + s.use + '\n【背后的故事】' + s.back;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      toast('已复制，直接粘到笔记里就行');
    } catch (e) { toast('复制失败，长按选中即可'); }
  }

  /* ================= 申论金句专区 ================= */
  var GOLD_RULES = [
    ['大国外交', ['外交', '国际关系', '命运共同体', '开放', '中美', '全球治理']],
    ['主权与安全', ['主权', '国防', '海洋', '领土', '安全观', '反分裂']],
    ['经济与民生', ['内需', '民生', '经济', '消费', '就业', '物价', '乡村振兴', '共同富裕', '社会保障', '营商环境']],
    ['科技创新', ['科技', '创新', '新质生产力', '举国体制', '数字化', '人工智能', '自立自强']],
    ['基层治理', ['治理', '公共安全', '法治', '基层', '应急', '风险', '底线思维', '执法']],
    ['文化自信', ['文化', '文明', '教育', '非遗', '传统', '精神']],
    ['生态文明', ['生态', '绿色', '双碳', '能源', '环境', '低碳']]
  ];

  function goldCat(topic) {
    var t = topic || '';
    for (var i = 0; i < GOLD_RULES.length; i++) {
      for (var j = 0; j < GOLD_RULES[i][1].length; j++) {
        if (t.indexOf(GOLD_RULES[i][1][j]) >= 0) return GOLD_RULES[i][0];
      }
    }
    return '其他';
  }

  function goldList() {
    var out = [];
    NEWS.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (it) {
      (it.shenlun || []).forEach(function (s, i) {
        out.push({ iid: it.id, date: it.date, slot: it.slot, idx: i, s: s, cat: goldCat(s.topic) });
      });
    });
    return out;
  }

  function renderGoldHome() {
    var all = goldList();
    if (!all.length) return '<div class="card center muted">还没有金句，等第一期新闻发布后就有了～</div>';
    var cats = [], cmap = {};
    all.forEach(function (g) {
      if (!cmap[g.cat]) { cmap[g.cat] = 0; cats.push(g.cat); }
      cmap[g.cat]++;
    });
    var sel = S.goldCat || '全部';
    var show = sel === '全部' ? all : all.filter(function (g) { return g.cat === sel; });

    var chips = '<div class="chips">' +
      '<span class="chip' + (sel === '全部' ? ' on' : '') + '" data-gcat="全部">全部 ' + all.length + '</span>' +
      cats.map(function (c) {
        return '<span class="chip' + (sel === c ? ' on' : '') + '" data-gcat="' + h(c) + '">' + h(c) + ' ' + cmap[c] + '</span>';
      }).join('') + '</div>';

    var cards = show.map(function (g) {
      var s = g.s;
      var cases = (s.cases || []).map(function (c, j) {
        return '<div class="slcase"><span class="cn">' + (j + 1) + '</span>' +
          '<span class="ct"><b>' + h(c.n) + '</b>' + h(c.d) + '</span></div>';
      }).join('');
      return '<div class="card slcard">' +
        '<div class="between" style="margin-bottom:10px">' +
        '<span class="slnum">' + h(g.cat) + '</span>' +
        '<button class="btn gray" style="padding:5px 11px;font-size:12.5px" data-sl="' + g.iid + '-' + g.idx + '">复制</button></div>' +
        '<div class="sltopic">📌 ' + h(s.topic) + '</div>' +
        (s.pattern ? '<span class="pat">' + h(s.pattern) + '</span>' : '') +
        '<div class="slquote">' + h(s.sentence) + '</div>' +
        (cases ? '<div class="slk">🧩 句中的案例（可替换）</div>' + cases : '') +
        (s.swap ? '<div class="slk">🔄 换个领域怎么写</div><div class="slp">' + h(s.swap) + '</div>' : '') +
        '<div class="slk">✍️ 怎么引用</div><div class="slp">' + h(s.use) + '</div>' +
        '<div class="slk">🔍 背后的故事</div><div class="slp">' + h(s.back) + '</div>' +
        '<div class="small muted" style="margin-top:10px;border-top:1px dashed var(--line);padding-top:8px">' +
        '来源：第 ' + g.iid + ' 期 · ' + fmtDate(g.date) + ' <span class="glink" data-news="' + g.iid + '">看当天的新闻 →</span></div>' +
        '</div>';
    }).join('');

    var nIssue = {};
    all.forEach(function (g) { nIssue[g.iid] = 1; });

    return '<div class="stats">' +
      '<div class="stat"><b>' + all.length + '</b><span>金句总数</span></div>' +
      '<div class="stat"><b>' + Object.keys(nIssue).length + '</b><span>覆盖期数</span></div>' +
      '<div class="stat"><b>' + cats.length + '</b><span>主题分类</span></div></div>' +
      '<div class="card small muted">🎯 <b>考前集中刷</b>：按主题或句式挑，每句都能直接搬进考场。复制按钮会把「金句+案例+引用方式+背景分析」整段复制到你的笔记里。</div>' +
      chips + cards;
  }

  /* ================= 学习日志（日历） ================= */
  var DOWS = ['日', '一', '二', '三', '四', '五', '六'];

  function diaryKey() { return 'kg_diary_v1::' + PID; }
  function loadDiary() {
    try {
      var o = JSON.parse(localStorage.getItem(diaryKey()) || '{}');
      if (!o || typeof o !== 'object') return {};
      var out = {};
      Object.keys(o).forEach(function (k) { var e = normEntry(o[k]); out[k] = e || { t: '', u: 0 }; });
      return out;
    } catch (e) { return {}; }
  }
  function saveDiary(o) { try { localStorage.setItem(diaryKey(), JSON.stringify(o)); } catch (e) {} scheduleSync(); }
  function dsOf(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function cnDate(ds) { var a = ds.split('-'); return (+a[0]) + '年' + (+a[1]) + '月' + (+a[2]) + '日'; }
  function dowOf(ds) { return '星期' + DOWS[new Date(ds + 'T00:00:00').getDay()]; }

  function diaryStats(d) {
    var keys = Object.keys(d).filter(function (k) { var e = normEntry(d[k]); return e && String(e.t || '').trim(); });
    var ym = ymd().slice(0, 7);
    var month = keys.filter(function (k) { return k.slice(0, 7) === ym; }).length;
    var streak = 0, t = new Date();
    for (; ;) {
      if (keys.indexOf(ymd(t)) >= 0) { streak++; t = new Date(t.getTime() - 86400000); } else break;
    }
    return { total: keys.length, month: month, streak: streak };
  }

  function renderDiary() {
    var d = loadDiary(), today = ymd();
    var ym = S.diaryYm || today.slice(0, 7);
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    var firstDow = new Date(y, m - 1, 1).getDay();
    var daysIn = new Date(y, m, 0).getDate();
    var prevDays = new Date(y, m - 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var n, mm = m, yy = y, other = false;
      if (i < firstDow) { n = prevDays - firstDow + 1 + i; mm = m - 1; if (mm < 1) { mm = 12; yy = y - 1; } other = true; }
      else if (i - firstDow + 1 > daysIn) { n = i - firstDow + 1 - daysIn; mm = m + 1; if (mm > 12) { mm = 1; yy = y + 1; } other = true; }
      else n = i - firstDow + 1;
      var ds = dsOf(yy, mm, n);
      var de = normEntry(d[ds]);
      var txt = (de && String(de.t || '').trim()) || '';
      cells += '<button class="cd' + (other ? ' other' : '') + (ds === today ? ' today' : '') + (txt ? ' has' : '') + '" data-day="' + ds + '">' +
        '<span class="cdn">' + n + '</span>' +
        (txt ? '<span class="cdt">' + h(txt.replace(/\s+/g, ' ').slice(0, 14)) + '</span>' : '') +
        '</button>';
    }
    var st = diaryStats(d);
    var head = DOWS.map(function (w) { return '<span class="cw">' + w + '</span>'; }).join('');
    return '<div class="topbar solid">' +
      '<span class="grow small"><b>📔 学习日志</b><div class="muted" style="font-size:12px">点任意一天，写下当天做了什么</div></span>' +
      '<button class="iconbtn" data-act="diary-today" title="回到今天">◎</button></div>' +
      '<div class="row between" style="margin:0 2px 10px">' +
      '<button class="btn gray" style="padding:6px 12px" data-act="diary-prev">‹</button>' +
      '<b>' + y + ' 年 ' + m + ' 月</b>' +
      '<button class="btn gray" style="padding:6px 12px" data-act="diary-next">›</button></div>' +
      '<div class="card"><div class="calhead">' + head + '</div><div class="cal">' + cells + '</div></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + st.month + '</b><span>本月记录</span></div>' +
      '<div class="stat"><b>' + st.streak + '</b><span>连续打卡</span></div>' +
      '<div class="stat"><b>' + st.total + '</b><span>累计记录</span></div></div>' +
      '<div class="card small muted">📌 记录只保存在<b>本机这个档案</b>里（不上传、不同步）。日历上<b>蓝底</b>=有记录，<b>方框</b>=今天。想每天留点痕迹，就写两句：今天刷了什么、哪儿卡住了、明天先干什么。</div>';
  }

  function renderDiaryDay() {
    var ds = S.diaryDate || ymd();
    var d = loadDiary(), de = normEntry(d[ds]);
    var txt = (de && de.t) || '';
    var chars = txt.replace(/\s/g, '').length;
    return '<div class="topbar solid">' +
      '<button class="iconbtn" data-act="diary-back">‹</button>' +
      '<span class="grow small"><b>' + cnDate(ds) + '</b><div class="muted" style="font-size:12px">' + dowOf(ds) + (ds === ymd() ? ' · 就是今天' : '') + '</div></span>' +
      (txt ? '<button class="iconbtn" data-act="diary-del" title="删除这天的记录">🗑</button>' : '') +
      '</div>' +
      '<div class="card">' +
      '<textarea id="dtext" class="dtext" placeholder="今天做了什么？">' + h(txt) + '</textarea>' +
      '<div class="row between" style="margin-top:10px">' +
      '<span class="small muted" id="dcnt">' + chars + ' 字</span>' +
      '<span><button class="btn gray" data-act="diary-back">返回</button> ' +
      '<button class="btn" data-act="diary-save">保存</button></span></div>' +
      '<div class="small muted" style="margin-top:8px">提示：Ctrl/⌘ + Enter 也能保存；留空保存 = 删掉这天。</div>' +
      '</div>';
  }

  function renderDiaryDayView() {
    appEl.innerHTML = renderDiaryDay();
    dropFooter();
  }

  function diarySave() {
    var el = document.getElementById('dtext'); if (!el) return;
    var v = el.value.replace(/\r/g, '');
    var d = loadDiary();
    d[S.diaryDate] = { t: v.trim() ? v : '', u: Date.now() };
    saveDiary(d);
    toast(v.trim() ? '已记下 ' + cnDate(S.diaryDate) + ' ✅' : '已清空这天的记录');
    S.view = 'home'; S.subject = 'diary'; syncHash(); render();
  }
  function diaryDel() {
    if (!window.confirm('删除 ' + cnDate(S.diaryDate) + ' 的记录？')) return;
    var d = loadDiary(); d[S.diaryDate] = { t: '', u: Date.now() }; saveDiary(d);
    toast('已删除'); S.view = 'home'; S.subject = 'diary'; syncHash(); render();
  }

  /* ================= 站点使用统计（总号专属） ================= */
  var STAT_URL = 'https://textdb.dev/api/data/kg-site-stats';
  var OWNER_NAME = '西瓜';

  function uidOf() {
    try {
      var u = localStorage.getItem('kg_uid');
      if (!u) {
        u = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem('kg_uid', u);
      }
      return u;
    } catch (e) { return null; }
  }

  function isOwner() {
    var pr = curProfile();
    if (pr && String(pr.name || '').replace(/\s/g, '') === OWNER_NAME) return true;
    try { return localStorage.getItem('kg_owner') === '1'; } catch (e) { return false; }
  }

  function ymd(d) {
    d = d ? new Date(d) : new Date();
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }

  function statGet() {
    return fetch(STAT_URL + '?t=' + Date.now(), { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && typeof d === 'object' && d.u) ? d : { v: 1, u: {} }; })
      .catch(function () { return null; });
  }

  function statPost(d) {
    return fetch(STAT_URL, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    }).catch(function () {});
  }

  function statReport() {
    var uid = uidOf(); if (!uid) return;
    var today = ymd();
    try { if (localStorage.getItem('kg_stat_day') === today) return; } catch (e) {}
    statGet().then(function (d) {
      if (!d) return;
      var pr = curProfile();
      var e = d.u[uid] || { f: today, l: today, n: 0, names: [] };
      e.l = today;
      e.n = (e.n || 0) + 1;
      if (!e.f) e.f = today;
      e.names = e.names || [];
      if (pr && pr.name && e.names.indexOf(pr.name) < 0) e.names.push(pr.name);
      d.u[uid] = e;
      d.v = 1;
      try { localStorage.setItem('kg_stat_day', today); } catch (e2) {}
      statPost(d);
    });
  }

  function statDays(n) {
    var out = [], t = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(t.getTime() - i * 86400000);
      out.push(ymd(d));
    }
    return out;
  }

  function renderStats() {
    appEl.innerHTML = '<div class="topbar solid">' +
      '<button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small"><b>📊 站点使用统计</b><div class="muted" style="font-size:12px">总号「' + OWNER_NAME + '」专属 · 仅本机浏览器可见</div></span>' +
      '<button class="iconbtn" data-act="stat-reload" title="刷新">🔄</button></div>' +
      '<div class="card center muted" id="statbox">正在读取…</div>';

    statGet().then(function (d) {
      var box = document.getElementById('statbox');
      if (!box) return;
      if (!d) { box.className = 'card center'; box.textContent = '读取失败（网络或服务不可用），点右上角 🔄 重试'; return; }
      var uids = Object.keys(d.u || {});
      var today = ymd();
      var last7 = statDays(7), last14 = statDays(14);
      var act = 0, act7 = 0, names = [], visits = 0;
      uids.forEach(function (k) {
        var e = d.u[k] || {};
        if (e.l === today) act++;
        if (last7.indexOf(e.l) >= 0) act7++;
        visits += (e.n || 0);
        (e.names || []).forEach(function (nm) { if (nm && names.indexOf(nm) < 0) names.push(nm); });
      });
      var rows = uids.map(function (k) { return { k: k, e: d.u[k] || {} }; })
        .sort(function (a, b) { return String(b.e.l || '').localeCompare(String(a.e.l || '')); });

      var hist = last14.map(function (day) {
        var cnt = 0, neu = 0;
        uids.forEach(function (k) {
          var e = d.u[k] || {};
          if (e.l === day) cnt++;
          if (e.f === day) neu++;
        });
        return { day: day, act: cnt, neu: neu };
      });
      var maxA = 1;
      hist.forEach(function (h) { if (h.act > maxA) maxA = h.act; });
      var bars = hist.map(function (h) {
        var w = Math.round(h.act / maxA * 100);
        return '<div class="hrow"><span class="hday">' + h.day.slice(5) + '</span>' +
          '<span class="hbar"><i style="width:' + w + '%"></i></span>' +
          '<span class="hnum">' + h.act + (h.neu ? ' <em>+' + h.neu + '</em>' : '') + '</span></div>';
      }).join('');

      var list = rows.map(function (r, i) {
        var e = r.e;
        return '<div class="urow"><span class="uno">' + (i + 1) + '</span>' +
          '<span class="ut"><b>' + h((e.names || []).join('、') || '（未命名）') + '</b>' +
          '<span class="small muted">' + h(r.k.slice(-6)) + ' · 首次 ' + h(e.f || '-') + ' · 最近 ' + h(e.l || '-') + '</span></span>' +
          '<span class="un">' + (e.n || 0) + ' 次</span></div>';
      }).join('') || '<div class="center muted small">还没有用户数据</div>';

      box.outerHTML =
        '<div class="stats">' +
        '<div class="stat"><b>' + uids.length + '</b><span>累计用户</span></div>' +
        '<div class="stat"><b>' + act + '</b><span>今日活跃</span></div>' +
        '<div class="stat"><b>' + act7 + '</b><span>近7日活跃</span></div></div>' +
        '<div class="row between" style="margin:0 4px 10px"><span class="small muted">近 14 天活跃（+N = 当日新增）</span>' +
        '<span class="small muted">打开 ' + visits + ' 次 · 档案 ' + names.length + ' 个</span></div>' +
        '<div class="card">' + bars + '</div>' +
        '<div class="row between" style="margin:0 4px 10px"><span class="small muted">用户明细（按最近活跃排序）</span></div>' +
        '<div class="card">' + list + '</div>' +
        '<div class="card small muted">统计口径：按<b>浏览器</b>去重（清缓存/换设备会记为新用户）；只在每天第一次打开时上报一次，不记录任何学习内容、密码或同步码。数据存在公共 KV（textdb.dev），任何知道地址的人理论上可读取，因此只用来数人头，不要当成安全系统。</div>' +
        '<button class="btn ghost block" data-act="home" style="margin-bottom:24px">← 返回首页</button>';
    });
    dropFooter();
  }

  /* ================= 刷题页 ================= */
  function renderQuiz() {
    var it = currentIssue(); if (!it) return goHome();
    var items = it.items || [];
    var i = S.idx, item = items[i];
    if (!item) return goResult();
    var p = progOf(it.issue), prev = p.ans[i];
    if (prev && !S.judged && !S.picked.length) { S.picked = prev.pick.slice(); S.judged = true; }

    var pct = Math.round((i + (S.judged ? 1 : 0)) / items.length * 100);
    var kp = item.kp || {};

    var kpHtml = '<div class="card kp">' +
      '<div class="between" style="margin-bottom:8px"><span class="tag">知识点 ' + (i + 1) + '</span>' +
      '<span class="small muted">' + h(kp.module || '') + '</span></div>' +
      '<div class="kptitle">' + h(kp.title || '') + '</div>' +
      '<ul>' + (kp.points || []).map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul>' +
      (S.judged && kp.pitfall ? '<div class="pit">⚠️ 易错点：' + h(kp.pitfall) + '</div>' : '') + '</div>';

    var opts = (item.q.options || []).map(function (o, k) {
      var key = LETTERS[k], cls = 'opt';
      var picked = S.picked.indexOf(key) >= 0;
      var isAns = (item.q.answer || []).indexOf(key) >= 0;
      if (S.judged) { if (isAns) cls += ' ok'; else if (picked) cls += ' err'; }
      else if (picked) cls += ' sel';
      return '<button class="' + cls + '" data-opt="' + key + '"' + (S.judged ? ' disabled' : '') + '>' +
        '<span class="k">' + key + '</span><span class="grow">' + h(o) + '</span></button>';
    }).join('');

    var fb = '';
    if (S.judged) {
      var ok = isRight(item, S.picked);
      fb = '<div class="fb ' + (ok ? 'good' : 'bad') + '">' +
        '<h4>' + (ok ? '✅ 回答正确' : '❌ 回答错误') + '</h4>' +
        '<div class="ans">你的答案：' + (S.picked.join('') || '未作答') + '　｜　正确答案：' + (item.q.answer || []).join('') + '</div></div>' +
        (item.tip ? '<div class="card"><div class="block-title">⚠️ 易错点</div><div class="tips">' + h(item.tip) + '</div></div>' : '') +
        '<div class="card"><div class="block-title">📖 解析</div><div class="explain">' + h(item.q.explain || '') + '</div></div>' +
        (item.recap ? '<div class="card"><div class="block-title">🧠 本题小结</div><div class="recap">' + h(item.recap) + '</div></div>' : '');
    }

    appEl.innerHTML = '<div class="topbar">' +
      '<button class="iconbtn" data-act="home">‹</button>' +
      '<span class="progress-line"><i style="width:' + pct + '%"></i></span>' +
      '<span class="count">' + (i + 1) + ' / ' + items.length + '</span></div>' +
      kpHtml +
      '<div class="card"><div class="qhead"><span class="qno">第 ' + (i + 1) + ' 题</span>' +
      '<span class="tag ' + (item.q.type === 'multi' ? '' : 'gray') + '">' + typeName(item.q.type) + '</span>' +
      (it.difficulty ? '<span class="small muted">' + h(it.difficulty) + '</span>' : '') + '</div>' +
      '<p class="stem">' + h(item.q.stem) + '</p>' +
      '<div class="opts">' + opts + '</div></div>' + fb;

    renderFooter();
  }

  /* ================= 底部操作栏 ================= */
  function renderFooter() {
    var inner = '';
    if (S.view === 'quiz') {
      var it = currentIssue(); if (!it) return;
      var items = it.items || [], i = S.idx, item = items[i];
      if (!item) return;
      if (!S.judged) {
        inner = item.q.type === 'multi'
          ? '<button class="btn lg block" data-act="submit"' + (S.picked.length ? '' : ' disabled') + '>确认答案（多选）</button>'
          : '<div class="btn lg block gray" style="cursor:default">点击选项即可判定 · 单选</div>';
      } else {
        var last = i >= items.length - 1;
        inner = (i > 0 ? '<button class="btn lg ghost" data-act="prev">上一题</button>' : '') +
          '<button class="btn lg grow" data-act="' + (last ? 'result' : 'next') + '">' + (last ? '完成，看总结 →' : '下一题 →') + '</button>';
      }
    } else if (S.view === 'learn') {
      var ws = maybeWords(), w = ws[S.vIdx];
      if (!w) return;
      if (!S.revealed) {
        inner = '<button class="btn lg block" data-act="reveal">看释义（' + (S.vIdx + 1) + '/' + ws.length + '）</button>';
      } else {
        inner = '<div class="markrow">' +
          '<button class="mbtn err" data-mark="0">不认识</button>' +
          '<button class="mbtn warn" data-mark="1">模糊</button>' +
          '<button class="mbtn ok" data-mark="2">认识</button>' +
          '</div>';
      }
    } else if (S.view === 'review') {
      var rv = S.rev;
      if (rv && rv.pickedText) {
        inner = '<button class="btn lg block" data-act="rev-next">' + (rv.idx >= rv.list.length - 1 ? '看结果 →' : '下一题 →') + '</button>';
      } else {
        inner = '<div class="btn lg block gray" style="cursor:default">点选项作答</div>';
      }
    }
    var f = document.querySelector('.footer');
    if (!f) { f = document.createElement('div'); f.className = 'footer'; document.body.appendChild(f); }
    f.innerHTML = '<div class="inner">' + inner + '</div>';
  }
  function dropFooter() { var f = document.querySelector('.footer'); if (f) f.remove(); }

  /* ================= 背单词 · 学习页 ================= */
  function maybeWords() { return mergeWords(S.batch); }

  function renderLearn() {
    var ws = maybeWords();
    if (!ws.length) return goHome();
    if (S.vIdx >= ws.length) return renderBatchDone();
    var w = ws[S.vIdx], lv = lvlOf(w.w), rel = w.rel || {};
    var pct = Math.round(S.vIdx / ws.length * 100);

    function relrow(k, cls, arr) {
      if (!arr || !arr.length) return '';
      return '<div class="relrow"><span class="relk ' + cls + '">' + k + '</span><span class="relv">' +
        arr.map(function (x) { return h(x); }).join('、') + '</span></div>';
    }

    var detail = S.revealed
      ? '<div class="wcn">' + h(w.cn || '—') + '</div>' +
        (w.eg ? '<div class="wblock"><div class="relk eg">例句</div>' +
          '<div class="wtag">' + h(w.eg) + '</div>' +
          (w.egCn ? '<div class="small muted" style="margin-top:4px">' + h(w.egCn) + '</div>' : '') + '</div>' : '') +
        ((rel.form && rel.form.length) || (rel.sound && rel.sound.length) || (rel.syn && rel.syn.length)
          ? '<div class="wblock"><div class="relk">拓展</div>' +
            relrow('形近', 'form', rel.form) + relrow('音近', 'sound', rel.sound) + relrow('近义', 'syn', rel.syn) + '</div>'
          : '<div class="small muted" style="margin-top:10px">该词的例句 / 拓展还没上线，先记住读音和释义～</div>')
      : '<div class="hint-tap" data-act="reveal">点这里看释义、例句和拓展 ↗</div>';

    appEl.innerHTML = '<div class="topbar">' +
      '<button class="iconbtn" data-act="home">‹</button>' +
      '<span class="progress-line"><i style="width:' + pct + '%"></i></span>' +
      '<span class="count">' + (S.vIdx + 1) + ' / ' + ws.length + '</span></div>' +
      '<div class="card wordcard">' +
      '<div class="between" style="margin-bottom:6px"><span class="tag">第 ' + S.batch + ' 批 · 第 ' + w.n + ' 词</span>' +
      (lv !== null ? '<span class="tag ' + (lv === 2 ? 'ok' : (lv === 1 ? '' : 'gray')) + '">上次：' + ['不认识', '模糊', '认识'][lv] + '</span>' : '') +
      '</div>' +
      '<div class="wordline"><span class="word" data-act="say">' + h(w.w) + '</span>' +
      '<button class="spk" data-act="say" title="发音">🔊</button></div>' +
      (w.ph ? '<div class="phon">/' + h(String(w.ph).replace(/^\/|\/$/g, '')) + '/</div>' : '') +
      detail +
      '</div>' +
      '<div class="card small muted">卡片式背诵：先想，再看答案，然后如实标一下掌握程度 —— 标注结果会进生词本，复习优先考它们。</div>';

    renderFooter();
  }

  function renderBatchDone() {
    var ws = maybeWords(), known = 0, fuzzy = 0, no = 0;
    ws.forEach(function (x) {
      var v = lvlOf(x.w);
      if (v === 2) known++; else if (v === 1) fuzzy++; else if (v === 0) no++;
    });
    var total = ws.length;
    var pct = total ? Math.round(known / total * 100) : 0;
    var deg = pct * 3.6;
    var color = pct >= 80 ? 'var(--ok)' : (pct >= 50 ? 'var(--primary)' : 'var(--err)');

    var list = ws.map(function (x) {
      var v = lvlOf(x.w), cls = v === 2 ? 'ok' : (v === 1 ? 'warn' : 'err');
      return '<div class="wrow"><b>' + h(x.w) + '</b><span class="small muted">' + h(String(x.cn || '').slice(0, 18)) + '</span>' +
        '<span class="wdot ' + cls + '">' + ['不认识', '模糊', '认识'][v === null ? 0 : v] + '</span></div>';
    }).join('');

    appEl.innerHTML = '<div class="topbar"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small muted">第 ' + S.batch + ' 批 · ' + total + ' 词</span></div>' +
      '<div class="card"><div class="score">' +
      '<div class="ring" style="background:conic-gradient(' + color + ' ' + deg + 'deg,#e9edf7 ' + deg + 'deg)">' +
      '<div class="inner"><b>' + pct + '%</b><span>认识率</span></div></div>' +
      '<div class="verdict">' + (pct >= 80 ? '这批很稳，明天快速过一遍就行' : pct >= 50 ? '一半以上有印象，模糊词多滚两轮' : '生词偏多，建议今天就再刷一遍这批') + '</div>' +
      '<div class="small muted">认识 ' + known + ' · 模糊 ' + fuzzy + ' · 不认识 ' + no + '</div></div></div>' +
      '<div class="card"><div class="block-title">📋 本批词表</div>' + list + '</div>' +
      '<div class="row" style="gap:10px;margin-bottom:20px">' +
      '<button class="btn ghost grow" data-act="redo-batch">重背这批</button>' +
      '<button class="btn grow" data-act="learn-next">下一批 →</button></div>';
    dropFooter();
  }

  /* ================= 背单词 · 复习（英译中测试） ================= */
  function startReview(limit) {
    var due = dueWords();
    if (!due.length) { toast('生词本是空的，先去背一批吧'); return; }
    var pool = due.slice(0, limit || 20);
    shuffle(pool);
    S.rev = { list: pool, idx: 0, picked: null, right: 0, wrong: [], locked: false };
    S.view = 'review';
    syncHash();
    render();
  }

  function revQuestion() {
    var r = S.rev, w = r.list[r.idx];
    var opts = [w.cn];
    var guard = 0;
    while (opts.length < 4 && guard++ < 200) {
      var c = PLAN[Math.floor(Math.random() * PLAN.length)];
      if (!c || c.w === w.w) continue;
      if (opts.indexOf(c.cn) < 0) opts.push(c.cn);
    }
    shuffle(opts);
    return { w: w, opts: opts };
  }

  function renderReview() {
    var r = S.rev;
    if (!r) return goHome();
    if (r.idx >= r.list.length) return renderReviewDone();
    var q = revQuestion(), w = q.w;
    var pct = Math.round(r.idx / r.list.length * 100);

    var opts = q.opts.map(function (o, k) {
      var key = LETTERS[k], cls = 'opt';
      var isAns = o === w.cn, picked = r.pickedText === o;
      if (r.pickedText) { if (isAns) cls += ' ok'; else if (picked) cls += ' err'; }
      else if (picked) cls += ' sel';
      return '<button class="' + cls + '" data-ropt="' + h(o) + '"' + (r.pickedText ? ' disabled' : '') + '>' +
        '<span class="k">' + key + '</span><span class="grow">' + h(o) + '</span></button>';
    }).join('');

    var fb = '';
    if (r.pickedText) {
      var ok = r.pickedText === w.cn;
      fb = '<div class="fb ' + (ok ? 'good' : 'bad') + '">' +
        '<h4>' + (ok ? '✅ 记住了' : '❌ 还是没记住') + '</h4>' +
        '<div class="ans">' + h(w.w) + '　' + h(w.cn) + '</div></div>' +
        (ok ? '' : '<div class="card small muted">它已留在生词本，下次复习还会考到。</div>');
    }

    appEl.innerHTML = '<div class="topbar">' +
      '<button class="iconbtn" data-act="home">‹</button>' +
      '<span class="progress-line"><i style="width:' + pct + '%"></i></span>' +
      '<span class="count">' + (r.idx + 1) + ' / ' + r.list.length + '</span></div>' +
      '<div class="card wordcard"><div class="small muted" style="margin-bottom:8px">选出正确的中文释义</div>' +
      '<div class="wordline"><span class="word" data-act="say-review">' + h(w.w) + '</span>' +
      '<button class="spk" data-act="say-review" title="发音">🔊</button></div>' +
      (w.ph ? '<div class="phon">/' + h(w.ph) + '/</div>' : '') + '</div>' +
      '<div class="card"><div class="opts">' + opts + '</div></div>' + fb;

    renderFooter();
  }

  function renderReviewDone() {
    var r = S.rev, total = r.list.length, right = r.right;
    var pct = total ? Math.round(right / total * 100) : 0;
    var deg = pct * 3.6;
    var color = pct >= 80 ? 'var(--ok)' : (pct >= 50 ? 'var(--primary)' : 'var(--err)');
    var wrongHtml = r.wrong.length
      ? r.wrong.map(function (x) {
        return '<div class="wrow"><b>' + h(x.w) + '</b><span class="small muted">' + h(x.cn) + '</span>' +
          '<span class="wdot err">还要再看</span></div>';
      }).join('')
      : '<div class="small muted">全对，生词本这一轮清干净了 🎉</div>';

    appEl.innerHTML = '<div class="topbar"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small muted">复习结果</span></div>' +
      '<div class="card"><div class="score">' +
      '<div class="ring" style="background:conic-gradient(' + color + ' ' + deg + 'deg,#e9edf7 ' + deg + 'deg)">' +
      '<div class="inner"><b>' + pct + '%</b><span>答对率</span></div></div>' +
      '<div class="verdict">' + (pct >= 80 ? '生词基本拿下，继续保持' : pct >= 50 ? '有印象，明天再滚一轮' : '这批生词还生，建议重背一遍') + '</div>' +
      '<div class="small muted">答对 ' + right + ' / ' + total + '</div></div></div>' +
      '<div class="card"><div class="block-title">📌 还要再看的词</div>' + wrongHtml + '</div>' +
      '<div class="row" style="gap:10px;margin-bottom:20px">' +
      '<button class="btn ghost grow" data-act="review">再来一轮</button>' +
      '<button class="btn grow" data-act="home">返回首页</button></div>';
    dropFooter();
  }

  /* ================= 刷题 · 结算页 ================= */
  function renderResult() {
    var it = currentIssue(); if (!it) return goHome();
    var items = it.items || [], p = progOf(it.issue);
    var right = 0, wrong = [];
    items.forEach(function (item, i) {
      var a = p.ans[i]; if (a && a.ok) right++; else if (a) wrong.push({ i: i, item: item, a: a });
    });
    var done = items.filter(function (_, i) { return p.ans[i]; }).length;
    var total = items.length, rate = total ? Math.round(right / total * 100) : 0;
    var deg = rate * 3.6;
    var color = rate >= 80 ? 'var(--ok)' : (rate >= 60 ? 'var(--primary)' : 'var(--err)');
    var verdict = rate >= 90 ? '稳，这期可以跳过复看' : rate >= 70 ? '不错，重点看错题' : rate >= 50 ? '基础还行，易错点要再背' : '这期得回炉，建议重做一遍';

    var sm = it.summary || {};
    var wrongHtml = wrong.length ? wrong.map(function (w) {
      return '<div class="wi"><span class="n">' + (w.i + 1) + '</span><span class="t">' +
        '<b>' + h((w.item.kp || {}).title || '') + '</b>' +
        '<span class="a">你选 ' + (w.a.pick.join('') || '-') + '　正确 ' + (w.item.q.answer || []).join('') + '</span></span></div>';
    }).join('') : '<div class="small muted">全部答对，没有错题 🎉</div>';

    var onelines = (sm.oneLiners || []).map(function (x, k) {
      return '<div class="oneline"><span class="i">' + (k + 1) + '</span><span>' + h(x) + '</span></div>';
    }).join('');

    var pitfalls = (sm.pitfalls || []).map(function (g) {
      return '<div class="pitline">' + h(Array.isArray(g) ? g.join('　｜　') : g) + '</div>';
    }).join('');

    appEl.innerHTML = '<div class="topbar"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small muted">第 ' + it.issue + ' 期 · ' + fmtDate(it.date) + '</span>' +
      '<span class="small muted">已答 ' + done + '/' + total + '</span></div>' +
      '<div class="card"><div class="score">' +
      '<div class="ring" style="background:conic-gradient(' + color + ' ' + deg + 'deg,#e9edf7 ' + deg + 'deg)">' +
      '<div class="inner"><b>' + rate + '%</b><span>正确率</span></div></div>' +
      '<div class="verdict">' + verdict + '</div>' +
      '<div class="small muted">答对 ' + right + ' / ' + total + ' 题</div></div></div>' +
      '<div class="card"><div class="block-title">❌ 错题回顾</div><div class="wronglist">' + wrongHtml + '</div></div>' +
      '<div class="card"><div class="block-title">⚡ 全部知识点速记</div>' + (onelines || '<div class="small muted">暂无</div>') + '</div>' +
      (pitfalls ? '<div class="card"><div class="block-title">🔍 易错对照</div>' + pitfalls + '</div>' : '') +
      (sm.next ? '<div class="card"><div class="block-title">📌 下期方向</div><div class="recap">' + h(sm.next) + '</div></div>' : '') +
      '<div class="row" style="gap:10px;margin-bottom:20px">' +
      '<button class="btn ghost grow" data-act="retry">重做这期</button>' +
      '<button class="btn grow" data-act="home">返回首页</button></div>';
    dropFooter();
  }

  /* ================= 云同步页 ================= */
  function renderSync() {
    var head = '<div class="topbar"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small muted">账号与同步</span></div>';
    if (!ACCT.id) {
      var lp = curProfile();
      appEl.innerHTML = head +
        '<div class="card"><div class="kptitle">还没登录账号</div>' +
        '<div class="small muted" style="margin-top:6px">你现在是<b>离线模式</b>：本机档案「' + h(lp ? lp.name : '—') + '」的数据只存在这台设备里。登录或注册一个 ID，就能把这份数据带上云端，之后手机 / 平板 / 电脑都同步。</div>' +
        '<div class="row" style="gap:10px;margin-top:14px">' +
        '<button class="btn grow" data-act="go-gate">登录 / 注册（同步本机数据）</button></div></div>' +
        '<div class="card small muted">📌 登录时如果 ID 和本机档案同名（或本机只有这一个档案），本机的进度、生词本、日志会自动跟着这个 ID 走。</div>';
      dropFooter(); return;
    }
    var st = ACCT.busy ? '同步中…' : (ACCT.status || '已就绪');
    var doneQ = 0, mastery = 0, stars = 0, diaryDays = 0;
    Object.keys(store.p || {}).forEach(function (k) { doneQ += Object.keys((store.p[k] || {}).ans || {}).length; });
    Object.keys(vstore.w || {}).forEach(function (k) {
      if (vstore.w[k] > 0) mastery++;
      if (vstore.w[k] >= 2) stars++;
    });
    var dd = loadDiary();
    Object.keys(dd).forEach(function (k) { var e = normEntry(dd[k]); if (e && String(e.t || '').trim()) diaryDays++; });
    appEl.innerHTML = head +
      '<div class="card"><div class="kptitle">当前账号</div>' +
      '<div class="acctid" data-act="acc-copy">' + h(ACCT.id) + '<span class="small muted">  （点一下复制）</span></div>' +
      '<div class="small muted" style="margin-top:8px">换手机 / 换平板 / 换电脑：打开同一个网址 → 登录页填 <b>' + h(ACCT.id) + '</b> + 你的密码 → 你的进度、生词本、日志都会跟过来。</div>' +
      '<div class="row" style="gap:10px;margin-top:14px">' +
      '<button class="btn grow" data-act="acc-now">' + (ACCT.busy ? '同步中…' : '立即同步') + '</button>' +
      '<button class="btn ghost" data-act="acc-copy">复制 ID</button></div>' +
      '<div class="small muted" style="margin-top:10px">状态：' + h(st) + ' ｜ 上次同步：' + (ACCT.at ? new Date(ACCT.at).toLocaleString() : '—') + '</div></div>' +
      '<div class="card"><div class="block-title">这个 ID 的数据</div>' +
      '<div class="wrow"><b>刷题</b><span class="small muted">已作答 ' + doneQ + ' 题</span></div>' +
      '<div class="wrow"><b>单词</b><span class="small muted">掌握 ' + mastery + ' 个（其中 ' + stars + ' 个已熟）</span></div>' +
      '<div class="wrow"><b>日志</b><span class="small muted">写了 ' + diaryDays + ' 天</span></div>' +
      '<div class="small muted" style="margin-top:10px">这些数据每次改动会自动上传（约 2 秒后），登录其他设备时自动合并 —— 两边都改也不会互相盖掉，按条目取新的那一份。</div></div>' +
      '<div class="card small muted">⚠️ 再提醒一次：密码在浏览器里校验、数据存在免费公开存储上，属于「够用级的门」。别用其他账号的密码，别放敏感内容。</div>' +
      '<div class="row" style="margin-bottom:24px"><button class="btn ghost grow" data-act="logout">退出登录</button></div>';
    dropFooter();
  }


  function render() {
    if (!PID) { renderGate(); window.scrollTo(0, 0); return; }
    if (S.view === 'home') { dropFooter(); renderHome(); }
    else if (S.view === 'quiz') renderQuiz();
    else if (S.view === 'result') renderResult();
    else if (S.view === 'learn') renderLearn();
    else if (S.view === 'batchdone') renderBatchDone();
    else if (S.view === 'review') renderReview();
    else if (S.view === 'revdone') renderReviewDone();
    else if (S.view === 'sync') renderSync();
    else if (S.view === 'stat') renderStats();
    else if (S.view === 'diaryday') renderDiaryDayView();
    else if (S.view === 'news') renderNewsDetail();
    else { dropFooter(); renderHome(); }
    window.scrollTo(0, 0);
  }

  function hashOf() {
    if (S.view === 'quiz') return '#/q/' + S.issueId + '/' + (S.idx + 1);
    if (S.view === 'result') return '#/r/' + S.issueId;
    if (S.view === 'learn') return '#/v/b/' + S.batch;
    if (S.view === 'batchdone') return '#/v/b/' + S.batch + '/done';
    if (S.view === 'review' || S.view === 'revdone') return '#/v/rev';
    if (S.view === 'sync') return '#/sync';
    if (S.view === 'stat') return '#/stat';
    if (S.view === 'diaryday') return '#/d/' + S.diaryDate;
    if (S.view === 'home' && S.subject === 'diary') return '#/d';
    if (S.view === 'news') return '#/n/' + S.newsId;
    if (S.view === 'home' && S.subject === 'gold') return S.goldCat && S.goldCat !== '全部' ? '#/g/' + encodeURIComponent(S.goldCat) : '#/g';
    if (S.view === 'home' && S.subject === 'news') return '#/n';
    return '#/';
  }
  function syncHash() {
    try { if (location.hash !== hashOf()) history.replaceState(null, '', hashOf()); } catch (e) {}
  }
  function goHome() {
    S.view = 'home'; S.issueId = null; dropFooter(); syncHash(); render();
  }
  function goNews(id) {
    S.subject = 'news'; S.view = 'news'; S.newsId = id; dropFooter(); syncHash(); render();
  }
  function goGold(cat) {
    S.subject = 'gold'; S.view = 'home'; S.goldCat = cat || '全部'; dropFooter(); syncHash(); render();
  }
  function goQuiz(id, idx) {
    S.subject = 'quiz'; S.view = 'quiz'; S.issueId = id; S.idx = idx || 0; S.picked = []; S.judged = false;
    syncHash(); render();
  }
  function goResult() { S.view = 'result'; dropFooter(); syncHash(); render(); }
  function goSync() { S.view = 'sync'; dropFooter(); syncHash(); render(); }
  function goLearn(b, i) {
    S.subject = 'vocab'; S.view = 'learn'; S.batch = b; S.vIdx = i || 0; S.revealed = false;
    syncHash(); render();
  }

  function applyHash() {
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] === 'q' && parts[1]) {
      var id = parseInt(parts[1], 10), ix = parts[2] ? parseInt(parts[2], 10) - 1 : 0, found = null;
      for (var i = 0; i < ISSUES.length; i++) if (ISSUES[i].issue === id) found = ISSUES[i];
      if (found) {
        S.subject = 'quiz'; S.view = 'quiz'; S.issueId = id;
        S.idx = Math.min(Math.max(ix, 0), (found.items || []).length - 1);
        S.picked = []; S.judged = false; return;
      }
    } else if (parts[0] === 'r' && parts[1]) {
      S.subject = 'quiz'; S.view = 'result'; S.issueId = parseInt(parts[1], 10); return;
    } else if (parts[0] === 'sync') {
      S.view = 'sync'; return;
    } else if (parts[0] === 'stat') {
      S.view = 'stat'; return;
    } else if (parts[0] === 'd') {
      if (parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) { S.view = 'diaryday'; S.subject = 'diary'; S.diaryDate = parts[1]; S.diaryYm = parts[1].slice(0, 7); }
      else { S.view = 'home'; S.subject = 'diary'; }
      return;
    } else if (parts[0] === 'n') {
      if (parts[1]) {
        var nid = parseInt(parts[1], 10);
        if (newsById(nid)) { S.subject = 'news'; S.view = 'news'; S.newsId = nid; return; }
      }
      S.subject = 'news'; S.view = 'home'; return;
    } else if (parts[0] === 'g') {
      S.subject = 'gold'; S.view = 'home';
      S.goldCat = parts[1] ? decodeURIComponent(parts[1]) : '全部';
      return;
    } else if (parts[0] === 'v') {
      S.subject = 'vocab';
      if (parts[1] === 'rev') {
        if (!S.rev) startReview(20); else S.view = 'review';
        return;
      }
      if (parts[1] === 'b' && parts[2]) {
        var b = parseInt(parts[2], 10);
        S.batch = (b >= 1 && b <= batchCount()) ? b : 1;
        if (parts[3] === 'done') { S.view = 'batchdone'; return; }
        S.view = 'learn';
        S.vIdx = parts[3] ? Math.max(0, parseInt(parts[3], 10) - 1) : 0;
        S.revealed = false;
        return;
      }
    }
    S.view = 'home'; S.issueId = null;
  }
  window.addEventListener('hashchange', function () {
    if (!PID) return;
    applyHash(); render();
  });

  /* ================= 交互 ================= */
  function judge() {
    var it = currentIssue(), item = (it.items || [])[S.idx];
    if (!item || !S.picked.length) return;
    var ok = isRight(item, S.picked);
    var p = progOf(it.issue);
    p.ans[S.idx] = { pick: S.picked.slice(), ok: ok, ts: Date.now() }; saveStore();
    S.judged = true;
    render();
  }

  function pickOpt(key) {
    if (S.judged) return;
    var it = currentIssue(), item = (it.items || [])[S.idx];
    if (!item) return;
    if (item.q.type === 'multi') {
      var k = S.picked.indexOf(key);
      if (k >= 0) S.picked.splice(k, 1); else S.picked.push(key);
      render();
    } else { S.picked = [key]; judge(); }
  }

  function markWord(lv) {
    var ws = maybeWords(), w = ws[S.vIdx];
    if (!w) return;
    setLvl(w.w, lv);
    S.vIdx++; S.revealed = false;
    if (S.vIdx >= ws.length) { S.view = 'batchdone'; syncHash(); }
    render();
    if (lv === 0) toast('已进生词本');
  }

  function answerReview(text) {
    var r = S.rev; if (!r || r.pickedText) return;
    var w = r.list[r.idx];
    r.pickedText = text;
    if (text === w.cn) { r.right++; toast('答对了'); }
    else { r.wrong.push(w); toast('答错了，记住它'); }
    render();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-issue],[data-batch],[data-opt],[data-ropt],[data-pid],[data-mark],[data-act],[data-news],[data-sl],[data-gcat],[data-day]');
    if (!t) return;

    if (t.hasAttribute('data-day')) { S.view = 'diaryday'; S.subject = 'diary'; S.diaryDate = t.getAttribute('data-day'); syncHash(); return render(); }

    if (t.hasAttribute('data-gcat')) { S.subject = 'gold'; S.goldCat = t.getAttribute('data-gcat'); return renderHome(); }
    if (t.hasAttribute('data-news')) return goNews(parseInt(t.getAttribute('data-news'), 10));
    if (t.hasAttribute('data-sl')) {
      var sp = t.getAttribute('data-sl').split('-');
      return copySl(parseInt(sp[0], 10), parseInt(sp[1], 10));
    }
    if (t.hasAttribute('data-issue')) return goQuiz(parseInt(t.getAttribute('data-issue'), 10), 0);
    if (t.hasAttribute('data-mark')) return markWord(parseInt(t.getAttribute('data-mark'), 10));
    if (t.hasAttribute('data-batch')) return goLearn(parseInt(t.getAttribute('data-batch'), 10), 0);
    if (t.hasAttribute('data-opt')) return pickOpt(t.getAttribute('data-opt'));
    if (t.hasAttribute('data-ropt')) return answerReview(t.getAttribute('data-ropt'));
    if (t.hasAttribute('data-pid')) return enter(t.getAttribute('data-pid'));

    var act = t.getAttribute('data-act');
    if (!act) return;

    if (act === 'home') return goHome();
    if (act === 'submit') return judge();
    if (act === 'prev') { if (S.idx > 0) { S.idx--; S.picked = []; S.judged = false; render(); } return; }
    if (act === 'next') { if (S.idx < (currentIssue().items || []).length - 1) { S.idx++; S.picked = []; S.judged = false; render(); } return; }
    if (act === 'result') return goResult();
    if (act === 'retry') {
      store.p[S.issueId] = { ans: {}, updated: Date.now() }; saveStore();
      goQuiz(S.issueId, 0); toast('已重置，重新开始'); return;
    }
    if (act === 'tab-quiz') { S.subject = 'quiz'; return renderHome(); }
    if (act === 'tab-vocab') { S.subject = 'vocab'; return renderHome(); }
    if (act === 'tab-news') { S.subject = 'news'; return renderHome(); }
    if (act === 'tab-gold') { S.subject = 'gold'; S.view = 'home'; syncHash(); return render(); }
    if (act === 'tab-diary') { S.subject = 'diary'; S.view = 'home'; S.diaryYm = S.diaryYm || ymd().slice(0, 7); syncHash(); return render(); }
    if (act === 'diary-back') { S.view = 'home'; S.subject = 'diary'; syncHash(); return render(); }
    if (act === 'diary-today') { S.view = 'diaryday'; S.subject = 'diary'; S.diaryDate = ymd(); S.diaryYm = ymd().slice(0, 7); syncHash(); return render(); }
    if (act === 'diary-save') return diarySave();
    if (act === 'diary-del') return diaryDel();
    if (act === 'diary-prev' || act === 'diary-next') {
      var ym0 = S.diaryYm || ymd().slice(0, 7), y0 = +ym0.slice(0, 4), m0 = +ym0.slice(5, 7);
      m0 += (act === 'diary-next' ? 1 : -1);
      if (m0 < 1) { m0 = 12; y0--; } if (m0 > 12) { m0 = 1; y0++; }
      S.diaryYm = y0 + '-' + (m0 < 10 ? '0' : '') + m0;
      S.view = 'home'; S.subject = 'diary'; return render();
    }
    if (act === 'stat') { S.view = 'stat'; S.subject = 'quiz'; syncHash(); return render(); }
    if (act === 'stat-reload') { S.view = 'stat'; return render(); }
    if (act === 'news-older') { S.subject = 'news'; return goHome(); }
    if (act === 'learn-next') return goLearn(Math.min(batchCount(), nextBatch()), 0);
    if (act === 'redo-batch') return goLearn(S.batch, 0);
    if (act === 'review') return startReview(20);
    if (act === 'rev-next') {
      var r = S.rev;
      if (r.idx >= r.list.length - 1) { r.idx++; S.view = 'revdone'; syncHash(); render(); }
      else { r.idx++; r.picked = null; r.pickedText = null; render(); }
      return;
    }
    if (act === 'reveal') { S.revealed = true; render(); return; }
    if (act === 'say') { var wsx = maybeWords(), wx = wsx[S.vIdx]; if (wx) speak(wx.w); return; }
    if (act === 'say-review') { if (S.rev) speak(S.rev.list[S.rev.idx].w); return; }
    if (act === 'offline') return offlineGo();
    if (act === 'go-gate') return goGate();
    if (act === 'login') return doLogin();
    if (act === 'register') return doRegister();
    if (act === 'logout') return doLogout();
    if (act === 'acc-now') return acctSync(function () { toast('同步完成'); });
    if (act === 'acc-copy') return syncCopy();
    if (act === 'gate-login') { GATE.lastId = normId(valOf('accid') || GATE.lastId || ''); GATE.mode = 'login'; GATE.err = ''; return renderGate(); }
    if (act === 'gate-register') { GATE.lastId = normId(valOf('accid') || GATE.lastId || ''); GATE.mode = 'register'; GATE.err = ''; return renderGate(); }
    if (act === 'sync') return goSync();
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'dtext') {
      var c = document.getElementById('dcnt');
      if (c) c.textContent = e.target.value.replace(/\s/g, '').length + ' 字';
    }
  });

  document.addEventListener('keydown', function (e) {
    if (S.view === 'diaryday' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); return diarySave(); }
    if (!PID) {
      if (e.key === 'Enter') {
        var el = document.getElementById('accpwd') || document.getElementById('accid');
        if (el === document.activeElement) { if (GATE.mode === 'register') doRegister(); else doLogin(); }
      }
      return;
    }
    if (S.view === 'quiz') {
      var it = currentIssue(), item = (it && it.items) ? it.items[S.idx] : null; if (!item) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= (item.q.options || []).length) return pickOpt(LETTERS[n - 1]);
      if (e.key === 'Enter') {
        if (!S.judged && item.q.type === 'multi') return judge();
        if (S.judged) {
          if (S.idx < (currentIssue().items || []).length - 1) { S.idx++; S.picked = []; S.judged = false; render(); }
          else goResult();
        }
      }
      if (e.key === 'ArrowLeft' && S.idx > 0) { S.idx--; S.picked = []; S.judged = false; render(); }
      return;
    }
    if (S.view === 'learn') {
      if (e.key === ' ' || e.key === 'Enter') {
        if (!S.revealed) { S.revealed = true; render(); }
        else markWord(2);
        e.preventDefault();
      }
    }
  });

  /* ================= 启动 ================= */
  var saved = null;
  try { saved = localStorage.getItem(CU_KEY); } catch (e) {}
  loadSession();
  if (saved && curProfileById(saved) && (!ACCT.id || saved === ACCT.id)) {
    PID = saved;
    loadAll();
    applyHash();
    render();
    statReport();
    if (ACCT.id) acctSync();
  } else {
    if (ACCT.id && saved !== ACCT.id) { ACCT.id = null; ACCT.dk = null; try { localStorage.removeItem('kg_session'); } catch (e) {} }
    renderGate();
    statReport();
  }

  function curProfileById(id) {
    var ps = loadProfiles();
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return true;
    return false;
  }
})();
