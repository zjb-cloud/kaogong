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
  var VBATCH_SIZE = 50;
  var VBATCH_START = '2026-09-27';
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
  var wrong = { w: {}, grad: 0 };   /* 错题本：{ "<期>|<题号>": {n 错次, ok 连对数, d 首次, u 最近} } + grad 已毕业数 */
  var exam = { e: {} };             /* 模考记录：{ "<时间戳>": {at,d,score,total,used,mods} } */
  var drill = { d: {} };            /* 申论动笔：{ "YYYY-MM-DD": {t 正文, u 时间, s 自评分} } */
  var istore = { p: {} };           /* 词语速记：{ "<期>": {ans:{"<题号>":{pick,ok,ts}}, updated} } */
  var cstore = { p: {} };           /* 速算训练：结构同上 */
  var wkstore = { p: {} };          /* 周末测试：{ "<期>": {ans:{"<题号>":{pick/wr,ts}}, self:{"<题号>":[踩分点序号]}, done:{at,xz,sl,total}, u} } */
  var iwrong = { w: {}, grad: 0 };  /* 错词本（成语/四字词语）：{ "<期>|<题号>": {n 错次, ok 连对数, d 首次, u 最近} } + grad 已毕业数 */
  function loadAll() {
    try { var o = JSON.parse(localStorage.getItem(lsKey('kg_quiz_v2'))); store = (o && o.p) ? o : { p: {} }; } catch (e) { store = { p: {} }; }
    try { var v = JSON.parse(localStorage.getItem(lsKey('kg_vocab_v1'))); vstore = (v && v.w) ? { w: v.w, t: v.t || {} } : { w: {}, t: {} }; } catch (e) { vstore = { w: {}, t: {} }; }
    try { var w2 = JSON.parse(localStorage.getItem(lsKey('kg_wrong_v1'))); wrong = (w2 && w2.w) ? { w: w2.w, grad: w2.grad || 0 } : { w: {}, grad: 0 }; } catch (e) { wrong = { w: {}, grad: 0 }; }
    try { var e2 = JSON.parse(localStorage.getItem(lsKey('kg_exam_v1'))); exam = (e2 && e2.e) ? e2 : { e: {} }; } catch (e) { exam = { e: {} }; }
    try { var d2 = JSON.parse(localStorage.getItem(lsKey('kg_drill_v1'))); drill = (d2 && d2.d) ? d2 : { d: {} }; } catch (e) { drill = { d: {} }; }
    try { var i2 = JSON.parse(localStorage.getItem(lsKey('kg_idiom_v1'))); istore = (i2 && i2.p) ? i2 : { p: {} }; } catch (e) { istore = { p: {} }; }
    try { var c2 = JSON.parse(localStorage.getItem(lsKey('kg_calc_v1'))); cstore = (c2 && c2.p) ? c2 : { p: {} }; } catch (e) { cstore = { p: {} }; }
    try { var iw2 = JSON.parse(localStorage.getItem(lsKey('kg_iwrong_v1'))); iwrong = (iw2 && iw2.w) ? { w: iw2.w, grad: iw2.grad || 0 } : { w: {}, grad: 0 }; } catch (e) { iwrong = { w: {}, grad: 0 }; }
    try { var wk2 = JSON.parse(localStorage.getItem(lsKey('kg_weekend_v1'))); wkstore = (wk2 && wk2.p) ? wk2 : { p: {} }; } catch (e) { wkstore = { p: {} }; }
  }
  function saveStore() { try { localStorage.setItem(lsKey('kg_quiz_v2'), JSON.stringify(store)); } catch (e) {} scheduleSync(); }
  function saveVStore() { try { localStorage.setItem(lsKey('kg_vocab_v1'), JSON.stringify(vstore)); } catch (e) {} scheduleSync(); }
  function saveWrong() { try { localStorage.setItem(lsKey('kg_wrong_v1'), JSON.stringify(wrong)); } catch (e) {} scheduleSync(); }
  function saveExam() { try { localStorage.setItem(lsKey('kg_exam_v1'), JSON.stringify(exam)); } catch (e) {} scheduleSync(); }
  function saveDrill() { try { localStorage.setItem(lsKey('kg_drill_v1'), JSON.stringify(drill)); } catch (e) {} scheduleSync(); }
  function saveIStore() { try { localStorage.setItem(lsKey('kg_idiom_v1'), JSON.stringify(istore)); } catch (e) {} scheduleSync(); }
  function saveCStore() { try { localStorage.setItem(lsKey('kg_calc_v1'), JSON.stringify(cstore)); } catch (e) {} scheduleSync(); }
  function saveWK() { try { localStorage.setItem(lsKey('kg_weekend_v1'), JSON.stringify(wkstore)); } catch (e) {} scheduleSync(); }
  function saveIWrong() { try { localStorage.setItem(lsKey('kg_iwrong_v1'), JSON.stringify(iwrong)); } catch (e) {} scheduleSync(); }
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
      ['kg_quiz_v2', 'kg_vocab_v1', 'kg_diary_v1', 'kg_wrong_v1', 'kg_exam_v1', 'kg_drill_v1', 'kg_idiom_v1', 'kg_calc_v1', 'kg_iwrong_v1', 'kg_weekend_v1'].forEach(function (b) {
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
    var local = localSpace(), key = normId(ACCT.id).toLowerCase();
    apiGet(ACC_REG).then(function (reg) {
      if (reg && reg.ids && !reg.ids[key]) { accountGone(); return null; }
      return apiGet(ACCT.dk).then(function (remote) {
        var merged = mergeSpace(local, remote);
        merged.id = ACCT.id; merged.updated = Date.now();
        applySpace(merged);
        return apiPut(ACCT.dk, merged).then(function () {
          ACCT.busy = false; ACCT.at = Date.now(); ACCT.status = '已同步';
          loadAll();
          wBackfill();
          if (S.view === 'sync' || S.view === 'home' || S.view === 'stat') render();
          if (then) then();
        });
      });
    })['catch'](function () {
      ACCT.busy = false; ACCT.status = '离线：连不上服务器，改动先存在本机';
      if (S.view === 'sync') render();
      if (then) then();
    });
  }

  /* 云端账号已不存在（被清空/删除）→ 退出登录，但本机数据保留，重新注册可再带上去 */
  function accountGone() {
    ACCT.busy = false; ACCT.id = null; ACCT.dk = null; ACCT.status = '';
    clearSession();
    try { localStorage.removeItem(CU_KEY); } catch (e) {}
    PID = null;
    if (S.view === 'sync' || S.view === 'stat') S.view = 'home';
    GATE.mode = 'register'; GATE.busy = false;
    GATE.err = '服务器上这个 ID 已经不存在了（账号被清空），请重新注册一个 ID。';
    location.hash = '';
    renderGate();
    window.scrollTo(0, 0);
  }

  /* 彻底清空本机数据（云端不动） */
  function wipeLocal() {
    if (!window.confirm('彻底清空本机数据？\n\n会删掉：本机档案、刷题进度、生词本、学习日志、登录状态。\n云端数据不受影响。\n\n确定要清吗？')) return;
    try {
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('kg_') === 0) ks.push(k); }
      ks.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    ACCT.id = null; ACCT.dk = null; ACCT.status = ''; ACCT.busy = false; ACCT.at = 0;
    PID = null; S.view = 'home'; S.subject = 'quiz';
    GATE.mode = 'register'; GATE.busy = false;
    GATE.err = '本机数据已清空 ✅ 注册一个新 ID 就能从零开始。';
    location.hash = '';
    renderGate();
    window.scrollTo(0, 0);
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
    var q = null, v = null, d = null, w = null, e = null, dr = null, ii = null, cc = null, iw = null, wkk = null;
    try { q = JSON.parse(localStorage.getItem('kg_quiz_v2::' + p) || 'null'); } catch (e2) {}
    try { v = JSON.parse(localStorage.getItem('kg_vocab_v1::' + p) || 'null'); } catch (e2) {}
    try { d = JSON.parse(localStorage.getItem('kg_diary_v1::' + p) || 'null'); } catch (e2) {}
    try { w = JSON.parse(localStorage.getItem('kg_wrong_v1::' + p) || 'null'); } catch (e2) {}
    try { e = JSON.parse(localStorage.getItem('kg_exam_v1::' + p) || 'null'); } catch (e2) {}
    try { dr = JSON.parse(localStorage.getItem('kg_drill_v1::' + p) || 'null'); } catch (e2) {}
    try { ii = JSON.parse(localStorage.getItem('kg_idiom_v1::' + p) || 'null'); } catch (e2) {}
    try { cc = JSON.parse(localStorage.getItem('kg_calc_v1::' + p) || 'null'); } catch (e2) {}
    try { iw = JSON.parse(localStorage.getItem('kg_iwrong_v1::' + p) || 'null'); } catch (e2) {}
    try { wkk = JSON.parse(localStorage.getItem('kg_weekend_v1::' + p) || 'null'); } catch (e2) {}
    return {
      quiz: (q && q.p) ? q : { p: {} },
      vocab: (v && v.w) ? { w: v.w, t: v.t || {} } : { w: {}, t: {} },
      diary: (d && typeof d === 'object') ? d : {},
      wrong: (w && w.w) ? { w: w.w, grad: w.grad || 0 } : { w: {}, grad: 0 },
      exam: (e && e.e) ? e : { e: {} },
      drill: (dr && dr.d) ? dr : { d: {} },
      idiom: (ii && ii.p) ? ii : { p: {} },
      calc: (cc && cc.p) ? cc : { p: {} },
      iwrong: (iw && iw.w) ? { w: iw.w, grad: iw.grad || 0 } : { w: {}, grad: 0 },
      weekend: (wkk && wkk.p) ? wkk : { p: {} }
    };
  }

  function localSpace() {
    var accs = loadProfiles(), data = {};
    accs.forEach(function (p) { data[p.id] = readLocal(p.id); });
    if (PID && !data[PID]) { data[PID] = { quiz: store, vocab: { w: vstore.w, t: vstore.t || {} }, diary: loadDiary(), wrong: wrong, exam: exam, drill: drill, idiom: istore, calc: cstore, iwrong: iwrong, weekend: wkstore }; }
    return { v: 1, updated: Date.now(), accounts: accs, data: data };
  }

  /* 通用：带时间戳的 map 合并（每个 key 取更新的那份，用于错题本 / 模考记录 / 申论动笔） */
  function mergeMap(a, b) {
    a = a || {}; b = b || {};
    var out = {}, ks = {};
    Object.keys(a).forEach(function (k) { ks[k] = 1; });
    Object.keys(b).forEach(function (k) { ks[k] = 1; });
    Object.keys(ks).forEach(function (k) {
      var x = a[k], y = b[k];
      if (x == null) { out[k] = y; return; }
      if (y == null) { out[k] = x; return; }
      var tx = x.u || x.at || 0, ty = y.u || y.at || 0;
      out[k] = (ty > tx) ? y : x;
    });
    return out;
  }

  function mergeQuizObj(a, b) {
    a = a || { p: {} }; b = b || { p: {} };
    var out = { p: {} }, ids = {};
    Object.keys(a.p || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(b.p || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (k) {
      var la = (a.p || {})[k] || { ans: {}, updated: 0 }, lb = (b.p || {})[k] || { ans: {}, updated: 0 };
      /* 「重做」墓碑：del[题号] = 清空那一刻的时间戳。比它旧的作答一律丢掉，
         否则云端/备份按条目合并时会把已经重置掉的答案又合回来（只重置了第一题的现象） */
      var del = {};
      [la.del, lb.del].forEach(function (m) {
        Object.keys(m || {}).forEach(function (i) { if ((m[i] || 0) > (del[i] || 0)) del[i] = m[i]; });
      });
      var ans = {}, keys = {};
      Object.keys(la.ans || {}).forEach(function (i) { keys[i] = 1; });
      Object.keys(lb.ans || {}).forEach(function (i) { keys[i] = 1; });
      Object.keys(keys).forEach(function (i) {
        var ea = (la.ans || {})[i], eb = (lb.ans || {})[i];
        var win = !ea ? eb : (!eb ? ea : (((eb.ts || 0) > (ea.ts || 0)) ? eb : ea));
        if (!win) return;
        if ((win.ts || 0) <= (del[i] || 0)) return;   /* 清空之后没再作答 → 丢弃 */
        ans[i] = win;
      });
      out.p[k] = { ans: ans, updated: Math.max(la.updated || 0, lb.updated || 0) };
      if (Object.keys(del).length) out.p[k].del = del;
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
        diary: mergeDiaryObj(da.diary, db.diary),
        wrong: { w: mergeMap((da.wrong || {}).w, (db.wrong || {}).w), grad: Math.max(((da.wrong || {}).grad) || 0, ((db.wrong || {}).grad) || 0) },
        exam: { e: mergeMap((da.exam || {}).e, (db.exam || {}).e) },
        drill: { d: mergeMap((da.drill || {}).d, (db.drill || {}).d) },
        idiom: mergeQuizObj(da.idiom, db.idiom),
        calc: mergeQuizObj(da.calc, db.calc),
        iwrong: { w: mergeMap((da.iwrong || {}).w, (db.iwrong || {}).w), grad: Math.max(((da.iwrong || {}).grad) || 0, ((db.iwrong || {}).grad) || 0) },
        weekend: { p: mergeMap((da.weekend || {}).p, (db.weekend || {}).p) }
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
      var w = { w: mergeMap((cur.wrong || {}).w, (nx.wrong || {}).w), grad: Math.max(((cur.wrong || {}).grad) || 0, ((nx.wrong || {}).grad) || 0) };
      var ex = { e: mergeMap((cur.exam || {}).e, (nx.exam || {}).e) };
      var dr = { d: mergeMap((cur.drill || {}).d, (nx.drill || {}).d) };
      var idm = mergeQuizObj(cur.idiom, nx.idiom), clc = mergeQuizObj(cur.calc, nx.calc);
      var iw = { w: mergeMap((cur.iwrong || {}).w, (nx.iwrong || {}).w), grad: Math.max(((cur.iwrong || {}).grad) || 0, ((nx.iwrong || {}).grad) || 0) };
      var wkx = { p: mergeMap((cur.weekend || {}).p, (nx.weekend || {}).p) };
      try {
        localStorage.setItem('kg_quiz_v2::' + pid, JSON.stringify(q));
        localStorage.setItem('kg_vocab_v1::' + pid, JSON.stringify(v));
        localStorage.setItem('kg_diary_v1::' + pid, JSON.stringify(d));
        localStorage.setItem('kg_wrong_v1::' + pid, JSON.stringify(w));
        localStorage.setItem('kg_exam_v1::' + pid, JSON.stringify(ex));
        localStorage.setItem('kg_drill_v1::' + pid, JSON.stringify(dr));
        localStorage.setItem('kg_idiom_v1::' + pid, JSON.stringify(idm));
        localStorage.setItem('kg_calc_v1::' + pid, JSON.stringify(clc));
        localStorage.setItem('kg_iwrong_v1::' + pid, JSON.stringify(iw));
        localStorage.setItem('kg_weekend_v1::' + pid, JSON.stringify(wkx));
      } catch (e) {}
    });
  }

  function syncNow(then) { acctSync(then); }

  /* ================= 状态 ================= */
  var S = {
    view: 'home', subject: 'quiz', issueId: null, idx: 0, picked: [], judged: false,
    batch: 1, vIdx: 0, revealed: false, rev: null, newsId: null, goldCat: '全部',
    idioId: null, calcId: null,
    diaryYm: null, diaryDate: null,
    /* 错题重做 */
    wIdx: 0, wPicked: [], wJudged: false, wList: null,
    /* 词语速记 · 错词复习 / 混入 */
    iMode: 'set', iMix: null, iList: null, iEd: null, iPrev: null,
    /* 模考 */
    ex: null, exTimer: null,
    /* 周末测试 */
    wkId: null, wkI: 0,
    /* 听写 */
    dict: null, dcnt: 0,
    /* 申论动笔 */
    drillDs: null, drillOpen: false
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

  /* ================= 错题本（答错自动收 · 隔 3/7 天回收 · 连对两次毕业） ================= */
  var DAY = 86400000;
  function wkey(i, x) { return i + '|' + x; }
  function wEntry(i, x) { return wrong.w[wkey(i, x)] || null; }
  function wInt(e) { return ((e && e.ok) >= 1) ? 7 * DAY : 3 * DAY; }
  function wDueAt(e) { return (e.u || e.d || 0) + wInt(e); }
  function wIsDue(e, now) { return (!e.gone) && wDueAt(e) <= (now || Date.now()); }
  function wMark(issue, idx, ok) {
    var k = wkey(issue, idx), e = wrong.w[k], now = Date.now();
    if (!ok) {
      wrong.w[k] = { n: (((e && !e.gone) ? e.n : 0) || 0) + 1, ok: 0, d: (e && e.d) || now, u: now };
      saveWrong(); return;
    }
    if (!e || e.gone) return;
    var nok = (e.ok || 0) + 1;
    if (nok >= 2) { wrong.w[k] = { gone: 1, u: now }; wrong.grad = (wrong.grad || 0) + 1; }
    else wrong.w[k] = { n: e.n || 1, ok: nok, d: e.d || now, u: now };
    saveWrong();
  }
  function wAll() {
    var out = [];
    Object.keys(wrong.w).forEach(function (k) {
      var e = wrong.w[k]; if (!e || e.gone) return;
      var p = k.split('|');
      out.push({ issue: parseInt(p[0], 10), idx: parseInt(p[1], 10), e: e });
    });
    out.sort(function (a, b) { return wDueAt(a.e) - wDueAt(b.e); });
    return out;
  }
  function wDue() { var n = Date.now(); return wAll().filter(function (x) { return wIsDue(x.e, n); }); }
  function wItem(x) {
    var it = null;
    ISSUES.forEach(function (v) { if (v.issue === x.issue) it = v; });
    if (!it) return null;
    var item = (it.items || [])[x.idx];
    return item ? { issue: x.issue, idx: x.idx, item: item } : null;
  }
  function wDaysTxt(e) {
    if (!e) return '';
    var n = Math.round((wDueAt(e) - Date.now()) / DAY);
    if (n > 0) return n + ' 天后回来';
    if (n === 0) return '今天该重做';
    return '已到期 ' + (-n) + ' 天';
  }
  function wOpts(q, picked, judged) {
    return (q.options || []).map(function (o, i) {
      var L = 'ABCD'[i], on = picked.indexOf(L) >= 0, cls = 'opt' + (on ? ' on' : '');
      if (judged) cls = 'opt' + (((q.answer || []).indexOf(L) >= 0) ? ' right' : (on ? ' wrong' : ''));
      return '<button class="' + cls + '" data-wopt="' + L + '"><b>' + L + '</b><span>' + h(o) + '</span></button>';
    }).join('');
  }
  function renderWrongHome() {
    var all = wAll(), due = wDue(), nxt = null;
    all.forEach(function (x) { if (!nxt && !wIsDue(x.e)) nxt = x; });
    var list = all.map(function (x) {
      var it = wItem(x); if (!it) return '';
      var q = it.item.q, st = String(q.stem || '');
      return '<div class="wq"><div class="wqhead"><span class="tag gray">第 ' + x.issue + ' 期 · 第 ' + (x.idx + 1) + ' 题</span>' +
        '<span class="tag ' + (wIsDue(x.e) ? 'warn2' : 'gray') + '">' + wDaysTxt(x.e) + '</span></div>' +
        '<div class="small">' + h(st.slice(0, 46)) + (st.length > 46 ? '…' : '') + '</div>' +
        '<div class="small muted">错过 ' + (x.e.n || 1) + ' 次' + (x.e.ok ? ' · 已连对 ' + x.e.ok + ' 次' : '') + '</div></div>';
    }).join('');
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small"><b>🧯 错题本</b><div class="muted" style="font-size:12px">答错自动收 · 隔 3 / 7 天回来重做</div></span></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + due.length + '</b><span>今天该重做</span></div>' +
      '<div class="stat"><b>' + all.length + '</b><span>在错题本里</span></div>' +
      '<div class="stat"><b>' + (wrong.grad || 0) + '</b><span>已毕业</span></div></div>' +
      '<div class="card small muted">规则：答错 → 立刻进错题本；<b>隔 3 天</b>回来重做；做对后<b>隔 7 天</b>再做一次；<b>连对两次</b>才算毕业（移出去）。中途再错就重新计时。</div>' +
      (due.length ? '<button class="btn grow" data-act="w-start" style="margin-bottom:12px">开始重做（' + due.length + ' 道）</button>'
        : '<div class="card center muted">今天没有到期的错题 🎉 ' + (nxt ? '下一批 ' + wDaysTxt(nxt.e) : '（错题本是空的）') + '</div>') +
      (list ? '<div class="block-title">错题清单（' + all.length + '）</div>' + list : '') +
      '<div style="height:20px"></div>';
    dropFooter();
  }
  function wStart() {
    S.wList = wDue().map(function (x) { return wItem(x); }).filter(Boolean);
    if (!S.wList.length) { toast('今天没有到期的错题'); return; }
    S.wIdx = 0; S.wPicked = []; S.wJudged = false; S.subject = 'quiz'; S.view = 'wredo';
    syncHash(); render();
  }
  function renderWrongQ() {
    var x = (S.wList || [])[S.wIdx];
    if (!x) { S.view = 'wrong'; return renderWrongHome(); }
    var q = x.item.q, picked = S.wPicked, fb = '';
    if (S.wJudged) {
      var ok = isRight(x.item, picked);
      fb = '<div class="card ' + (ok ? 'okcard' : 'badcard') + '"><div class="block-title">' + (ok ? '✅ 这次对了' : '❌ 还是错') + '</div>' +
        '<div class="small">正确答案：<b>' + (q.answer || []).join('') + '</b>　你选：<b>' + (picked.join('') || '—') + '</b></div>' +
        (q.explain ? '<div class="small muted" style="margin-top:6px">' + h(q.explain) + '</div>' : '') +
        '<div class="small muted" style="margin-top:6px">' + (ok ? '再对一次就毕业；否则 7 天后回来。' : '已重新计时：3 天后回来。') + '</div></div>';
    }
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="w-back">‹</button>' +
      '<span class="grow small"><b>错题重做 ' + (S.wIdx + 1) + '/' + S.wList.length + '</b><div class="muted" style="font-size:12px">第 ' + x.issue + ' 期 · 第 ' + (x.idx + 1) + ' 题 · ' + typeName(q.type) + '</div></span></div>' +
      '<div class="card"><div class="qstem">' + h(q.stem) + '</div>' + wOpts(q, picked, S.wJudged) + '</div>' + fb +
      (S.wJudged ? '<button class="btn grow" data-act="w-next" style="margin-bottom:20px">' + (S.wIdx + 1 >= S.wList.length ? '完成 🎉' : '下一题 →') + '</button>'
        : '<button class="btn grow" data-act="w-judge" style="margin-bottom:20px">提交答案</button>');
    dropFooter();
  }
  function wPick(key) {
    if (S.wJudged) return;
    var x = (S.wList || [])[S.wIdx]; if (!x) return;
    if (x.item.q.type === 'multi') {
      var k = S.wPicked.indexOf(key);
      if (k >= 0) S.wPicked.splice(k, 1); else S.wPicked.push(key);
      render();
    } else { S.wPicked = [key]; wJudgeNow(); }
  }
  function wJudgeNow() {
    var x = (S.wList || [])[S.wIdx]; if (!x || !S.wPicked.length) return;
    var ok = isRight(x.item, S.wPicked);
    wMark(x.issue, x.idx, ok);
    S.wJudged = true;
    toast(ok ? '连对 +1' : '已重新计时');
    render();
  }
  function wNext() {
    S.wIdx++; S.wPicked = []; S.wJudged = false;
    if (S.wIdx >= (S.wList || []).length) { S.view = 'wrong'; S.wList = null; toast('这一轮清完了'); syncHash(); return render(); }
    render();
  }

  /* 把历史上答错的题补进错题本（这个功能上线前做错的也不漏） */
  function wBackfill() {
    var changed = false, now = Date.now();
    ISSUES.forEach(function (it) {
      var p = store.p[it.issue]; if (!p) return;
      Object.keys(p.ans || {}).forEach(function (k) {
        var a = p.ans[k];
        if (!a || a.ok !== false) return;
        var kk = wkey(it.issue, parseInt(k, 10));
        if (!wrong.w[kk]) { wrong.w[kk] = { n: 1, ok: 0, d: a.ts || now, u: a.ts || now, bf: 1 }; changed = true; }
      });
    });
    if (changed) saveWrong();
  }

  /* ================= 周末测试（一周一张卷：行测客观 + 申论主观） =================
     规则：答题过程中不给答案、不给解析；全部做完交卷后，才统一给出答案、踩分点与做题技巧。
     数据：kaogong/data/weekend-NNN.json（window.KG_WEEKEND）
     进度：kg_weekend_v1（整卷按时间戳取新合并，所以在其它设备上做完/重做都不会互相覆盖） */
  function weekOf(id) {
    for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].id === id) return WEEKS[i];
    return null;
  }
  function wkAll(w) { return (w.xz || []).concat(w.sl || []); }
  function wkProg(id) {
    if (!wkstore.p[id]) wkstore.p[id] = { ans: {}, self: {}, u: Date.now() };
    var p = wkstore.p[id];
    if (!p.ans) p.ans = {};
    if (!p.self) p.self = {};
    return p;
  }
  function wkIsXz(w, i) { return i < (w.xz || []).length; }
  function wkItemAt(w, i) { return wkAll(w)[i] || null; }
  function wkRight(item, pick) {
    var a = (item.answer || []).slice().sort().join('');
    var p = (pick || []).slice().sort().join('');
    return a === p && p.length > 0;
  }
  function wkAnswered(w, p, i) {
    var a = p.ans[i];
    if (!a) return false;
    return wkIsXz(w, i) ? !!(a.pick && a.pick.length) : !!a.wr;
  }
  function wkDoneN(w, p) { var n = 0; wkAll(w).forEach(function (_, i) { if (wkAnswered(w, p, i)) n++; }); return n; }
  function wkXzScore(w, p) {
    var n = 0;
    (w.xz || []).forEach(function (it, i) { var a = p.ans[i]; if (a && wkRight(it, a.pick)) n++; });
    return n;
  }
  function wkSlFull(w) { var t = 0; (w.sl || []).forEach(function (it) { (it.points || []).forEach(function (x) { t += x.n || 0; }); }); return t; }
  function wkSlScore(w, p) {
    var t = 0;
    (w.sl || []).forEach(function (it, k) {
      var j = (w.xz || []).length + k, sel = p.self[j] || [];
      (it.points || []).forEach(function (x, q) { if (sel.indexOf(q) >= 0) t += x.n || 0; });
    });
    return t;
  }
  function wkTouch(id) { var p = wkProg(id); p.u = Date.now(); saveWK(); return p; }
  function wkFirstOpen(w, p) {
    var items = wkAll(w);
    for (var i = 0; i < items.length; i++) if (!wkAnswered(w, p, i)) return i;
    return 0;
  }
  function goWeekend() { S.view = 'wkhome'; S.wkId = null; S.wkI = 0; dropFooter(); syncHash(); render(); }
  function goWkEnter(id) {
    var w = weekOf(id); if (!w) return goWeekend();
    var p = wkProg(id);
    S.subject = 'quiz'; S.wkId = id;
    if (p.done) { S.view = 'wkdone'; S.wkI = 0; } else { S.view = 'wkq'; S.wkI = wkFirstOpen(w, p); }
    dropFooter(); syncHash(); render(); window.scrollTo(0, 0);
  }
  function goWkQ(id, i) {
    var w = weekOf(id); if (!w) return goWeekend();
    S.subject = 'quiz'; S.wkId = id;
    S.wkI = Math.min(Math.max(i || 0, 0), wkAll(w).length - 1);
    S.view = wkProg(id).done ? 'wkdone' : 'wkq';
    syncHash(); render();
  }
  function goWkDone(id) { S.subject = 'quiz'; S.wkId = id; S.view = 'wkdone'; syncHash(); render(); }
  function wkPick(key) {
    if (S.view !== 'wkq') return;
    var w = weekOf(S.wkId); if (!w || !wkIsXz(w, S.wkI)) return;
    var item = wkItemAt(w, S.wkI), p = wkProg(S.wkId), a = p.ans[S.wkI] || {};
    var pick = (a.pick || []).slice();
    if (item.type === 'multi') {
      var k = pick.indexOf(key);
      if (k >= 0) pick.splice(k, 1); else pick.push(key);
    } else pick = [key];
    p.ans[S.wkI] = { pick: pick, ts: Date.now() };
    wkTouch(S.wkId); render();
  }
  function wkWrite() {
    var p = wkTouch(S.wkId), a = p.ans[S.wkI] || {};
    a.wr = !a.wr; a.ts = Date.now();
    p.ans[S.wkI] = a; saveWK(); render();
  }
  function wkNav(d) {
    var w = weekOf(S.wkId); if (!w) return;
    var n = wkAll(w).length, i = S.wkI + d;
    if (i < 0 || i > n - 1) return;
    S.wkI = i; syncHash(); render(); window.scrollTo(0, 0);
  }
  function wkSubmit() {
    var w = weekOf(S.wkId); if (!w) return;
    var p = wkProg(w.id), n = wkAll(w).length, dn = wkDoneN(w, p);
    if (dn < n && !window.confirm('还有 ' + (n - dn) + ' 题没作答。\n\n交卷后本期才显示答案、踩分点和做题技巧，也不能再改答案了。确定现在交卷？')) return;
    var xz = wkXzScore(w, p), sl = wkSlScore(w, p);
    p.done = { at: Date.now(), xz: xz, sl: sl, total: xz + sl };
    wkTouch(w.id);
    toast('已交卷');
    goWkDone(w.id);
  }
  function wkRedo() {
    var id = S.wkId; if (!id) return goWeekend();
    if (!window.confirm('重做这一期？\n\n本期已作答的记录和自评都会清空。')) return;
    wkstore.p[id] = { ans: {}, self: {}, u: Date.now() };
    saveWK();
    S.wkI = 0; S.view = 'wkq'; syncHash(); render(); window.scrollTo(0, 0);
    toast('已重置，重新开始');
  }
  function wkSelf(j, q) {
    var w = weekOf(S.wkId); if (!w) return;
    var p = wkTouch(w.id), sel = (p.self[j] || []).slice();
    var k = sel.indexOf(q);
    if (k >= 0) sel.splice(k, 1); else sel.push(q);
    p.self[j] = sel;
    if (p.done) { p.done.sl = wkSlScore(w, p); p.done.total = p.done.xz + p.done.sl; }
    saveWK(); render();
  }

  function wkHomeTag() {
    if (!WEEKS.length) return ' · 本周还没出卷';
    var w = WEEKS[0], p = wkProg(w.id), n = wkAll(w).length, dn = wkDoneN(w, p);
    if (p.done) return ' · 第 ' + w.id + ' 期已交卷 ' + p.done.total + ' 分';
    if (dn) return ' · 第 ' + w.id + ' 期进行中 ' + dn + '/' + n;
    return ' · 第 ' + w.id + ' 期未开始';
  }
  function renderWeekendHome() {    var list = WEEKS.map(function (w) {
      var p = wkProg(w.id), n = wkAll(w).length, dn = wkDoneN(w, p);
      var pct = n ? Math.round(dn / n * 100) : 0;
      var badge = p.done ? '<span class="tag ok">已交卷 ' + p.done.total + ' 分</span>'
        : (dn ? '<span class="tag">进行中 ' + dn + '/' + n + '</span>' : '<span class="tag gray">未开始</span>');
      return '<button class="issue" data-wk="' + w.id + '"><span class="idx">第<br>' + w.id + '期</span>' +
        '<span class="meta"><h3>' + h(w.title || '') + '</h3>' +
        '<p>' + (w.range ? '覆盖 ' + h(w.range) + ' · ' : '') + '行测 ' + (w.xz || []).length + ' 题 ＋ 申论 ' + (w.sl || []).length + ' 题</p>' +
        '<span class="bar"><i style="width:' + pct + '%"></i></span></span>' +
        '<span class="side">' + badge + '<div class="small muted" style="margin-top:6px">' + n + ' 题</div></span></button>';
    }).join('');
    if (!WEEKS.length) list = '<div class="card center muted">还没有周末测试卷，等更新后刷新本页～</div>';
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="tab-quiz">‹</button>' +
      '<span class="grow small"><b>📝 周末测试</b><div class="muted" style="font-size:12px">一周一张卷 · 行测客观 ＋ 申论主观</div></span></div>' +
      '<div class="card"><div class="kptitle">做完才给答案</div>' +
      '<div class="small muted" style="margin-top:6px">以<b>本周学习内容</b>为主（考公各期考点 ＋ 本周成语 ＋ 速算技巧 ＋ 新闻素材），另加下周拓展。答题过程中<b>不显示对错、不给解析</b>；全部做完交卷后，统一出<b>答案、解析、踩分点、做题技巧</b>。</div>' +
      '<div class="small muted" style="margin-top:8px">申论是主观题：交卷后按踩分点逐条对照自评（勾一勾我答到的点），自动算分。</div></div>' +
      list +
      '<div class="card small muted">行测每题 1 分自动判分；申论按踩分点自评。建议一次做完一整张卷（约 60 分钟）。</div>';
    dropFooter();
  }

  function renderWeekendQ() {
    var w = weekOf(S.wkId); if (!w) return goWeekend();
    var p = wkProg(w.id), items = wkAll(w), n = items.length, i = S.wkI;
    var item = items[i];
    if (!item) { S.wkI = 0; return renderWeekendQ(); }
    var isXz = wkIsXz(w, i), dn = wkDoneN(w, p), body = '';
    if (isXz) {
      var a = p.ans[i] || {}, pick = a.pick || [];
      var opts = (item.options || []).map(function (o, k) {
        var L = LETTERS[k];
        return '<button class="opt' + (pick.indexOf(L) >= 0 ? ' on' : '') + '" data-wkopt="' + L + '"><b>' + L + '</b><span>' + h(o) + '</span></button>';
      }).join('');
      body = (item.data ? '<div class="card small"><div class="block-title">资料</div><div>' + h(item.data) + '</div></div>' : '') +
        '<div class="card">' + (item.type === 'multi' ? '<div class="small muted">多选题（可多选）</div>' : '') +
        '<div class="qstem">' + h(item.stem) + '</div>' + opts + '</div>';
    } else {
      var wr = !!(p.ans[i] && p.ans[i].wr);
      body = '<div class="card"><div class="block-title">材料</div><div class="small" style="white-space:pre-wrap;line-height:1.7">' + h(item.stem) + '</div></div>' +
        '<div class="card"><div class="block-title">' + h(item.mod) + '</div>' +
        '<div class="small" style="line-height:1.7">' + h(item.req || '') + (item.limit ? '（' + h(item.limit) + '）' : '') + '</div>' +
        '<div class="small muted" style="margin-top:10px">在纸上写好后回来点一下标记；交卷前可以反复改。</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn ' + (wr ? '' : 'ghost') + ' grow" data-act="wk-write">' + (wr ? '✅ 我已动笔作答' : '标记：我已动笔作答') + '</button></div></div>';
    }
    var last = (i + 1 >= n);
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="wk-back">‹</button>' +
      '<span class="grow small"><b>第 ' + (i + 1) + ' / ' + n + ' 题</b><div class="muted" style="font-size:12px">' + (isXz ? '行测 · ' : '申论 · ') + h(item.mod) + (item.from ? ' · ' + h(item.from) : '') + '</div></span>' +
      '<span class="small muted">已答 ' + dn + '/' + n + '</span></div>' +
      body +
      '<div class="row" style="gap:10px">' +
      '<button class="btn ghost' + (i === 0 ? ' dis' : '') + '" data-act="wk-prev">‹ 上一题</button>' +
      '<button class="btn grow" data-act="wk-next">' + (last ? '交卷 ✓' : '下一题 →') + '</button></div>' +
      '<div class="row" style="gap:10px;margin-bottom:22px"><button class="btn ghost grow" data-act="wk-submit">✅ 交卷（出答案）</button></div>' +
      '<div class="card small muted">考场模式：不给对错、不给解析；交卷后统一给答案、踩分点和做题技巧。</div>';
    dropFooter();
  }

  function renderWeekendDone() {
    var w = weekOf(S.wkId); if (!w) return goWeekend();
    var p = wkProg(w.id);
    if (!p.done) { S.view = 'wkq'; return renderWeekendQ(); }
    var xzN = (w.xz || []).length, slFull = wkSlFull(w), full = xzN + slFull;
    var xzS = p.done.xz || 0, slS = p.done.sl || 0, tot = xzS + slS;
    var pct = full ? Math.round(tot / full * 100) : 0;
    var xzRows = (w.xz || []).map(function (it, i) {
      var a = p.ans[i] || {}, pick = (a.pick || []).slice(), pts = pick.join('') || '—', ok = wkRight(it, pick);
      var opts = (item0Opts(it, pick));
      return '<div class="card">' +
        '<div class="between"><b>' + (ok ? '✅' : (pts === '—' ? '⚪' : '❌')) + ' 第 ' + (it.no || i + 1) + ' 题 · ' + h(it.mod) + '</b>' +
        '<span class="small muted">你 ' + pts + ' ／正确 ' + (it.answer || []).join('') + '</span></div>' +
        (it.from ? '<div class="small muted">' + h(it.from) + '</div>' : '') +
        (it.data ? '<div class="small muted" style="margin-top:6px">资料：' + h(it.data) + '</div>' : '') +
        '<div class="qstem" style="margin-top:8px">' + h(it.stem) + '</div>' + opts +
        '<div class="block-title" style="margin-top:10px">解析</div><div class="small" style="line-height:1.7">' + h(it.explain || '') + '</div>' +
        (it.tip ? '<div class="small" style="margin-top:8px"><b>📝 做题技巧</b>：' + h(it.tip) + '</div>' : '') +
        (it.key ? '<div class="small muted" style="margin-top:6px">🧠 一句话记住：' + h(it.key) + '</div>' : '') +
        '</div>';
    }).join('');
    var slRows = (w.sl || []).map(function (it, k) {
      var j = xzN + k, sel = p.self[j] || [], got = 0, f = 0;
      var pts = (it.points || []).map(function (x, q) {
        var on = sel.indexOf(q) >= 0; f += x.n || 0; if (on) got += x.n || 0;
        return '<button class="opt' + (on ? ' on' : '') + '" data-wkpt="' + j + '-' + q + '"><b>' + (on ? '✓' : '○') + '</b><span>' + h(x.pt) + '　<b>(' + (x.n || 0) + ' 分)</b></span></button>';
      }).join('');
      return '<div class="card">' +
        '<div class="between"><b>第 ' + (it.no || k + 1) + ' 题 · ' + h(it.mod) + '</b><span class="small muted">自评 ' + got + '/' + f + ' 分</span></div>' +
        (it.from ? '<div class="small muted">' + h(it.from) + '</div>' : '') +
        '<div class="block-title" style="margin-top:8px">材料</div><div class="small" style="white-space:pre-wrap;line-height:1.7">' + h(it.stem) + '</div>' +
        '<div class="small" style="margin-top:8px"><b>要求</b>：' + h(it.req || '') + (it.limit ? '（' + h(it.limit) + '）' : '') + '</div>' +
        '<div class="block-title" style="margin-top:12px">🎯 踩分点（对照勾选我答到的）</div>' + pts +
        '<div class="block-title" style="margin-top:12px">参考答案</div><div class="small" style="white-space:pre-wrap;line-height:1.7">' + h(it.sample || '') + '</div>' +
        (it.tip ? '<div class="small" style="margin-top:10px"><b>📝 做题技巧</b>：' + h(it.tip) + '</div>' : '') +
        '</div>';
    }).join('');
    var tip = pct >= 85 ? '这份卷子拿得稳，保持这个手感 🎯' : (pct >= 60 ? '基本盘有了，把踩分点漏掉的地方补上就是一档' : '先别急：把错题的解析和技巧读一遍，下周重点攻它');
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="wk-back">‹</button>' +
      '<span class="grow small"><b>成绩与答案 · 第 ' + w.id + ' 期</b><div class="muted" style="font-size:12px">' + h(w.title || '') + '</div></span></div>' +
      '<div class="card center"><div class="bigpct">' + tot + ' / ' + full + '</div>' +
      '<div class="small muted">行测 ' + xzS + '/' + xzN + ' 分 · 申论自评 ' + slS + '/' + slFull + ' 分</div>' +
      '<div class="small muted" style="margin-top:4px">' + tip + '</div></div>' +
      '<div class="block-title">行测（客观题 · 已判分）</div>' + xzRows +
      '<div class="block-title">申论（主观题 · 自评踩分）</div>' + slRows +
      '<div class="row" style="gap:10px;margin-bottom:24px">' +
      '<button class="btn ghost grow" data-act="wk-redo">🔄 重做这一期</button>' +
      '<button class="btn grow" data-act="wk">回周末测试</button></div>';
    dropFooter();
  }
  function item0Opts(it, pick) {
    return (it.options || []).map(function (o, k) {
      var L = LETTERS[k], okA = (it.answer || []).indexOf(L) >= 0, mine = (pick || []).indexOf(L) >= 0;
      var cls = okA ? 'okc' : (mine ? 'badc' : '');
      return '<div class="small ' + cls + '">' + L + '. ' + h(o) + (okA ? ' ✓' : (mine ? ' （你选的）' : '')) + '</div>';
    }).join('');
  }

  /* ================= 限时模考（仅每周末开放：周六、周日） ================= */
  function isWeekend(d) { var k = (d || new Date()).getDay(); return k === 6 || k === 0; }
  function nextWeekendTxt() {
    var d = new Date(), n = 0;
    while (!isWeekend(d)) { d.setDate(d.getDate() + 1); n++; }
    if (n === 0) return '就是今天';
    return n + ' 天后（' + (d.getMonth() + 1) + '月' + d.getDate() + '日）';
  }
  function examPool() {
    var pool = [];
    ISSUES.forEach(function (it) {
      (it.items || []).forEach(function (item, i) {
        pool.push({ issue: it.issue, idx: i, item: item, mod: (item.kp && item.kp.module) || '综合' });
      });
    });
    return pool;
  }
  function examRecs() {
    var out = [];
    Object.keys(exam.e).forEach(function (k) { var r = exam.e[k]; if (r && !r.gone) out.push(r); });
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return out;
  }
  function clockTxt(s) { var m = Math.floor(s / 60), x = s % 60; return ('0' + m).slice(-2) + ':' + ('0' + x).slice(-2); }
  function examStart(mode) {
    if (!isWeekend()) { toast('模考只在周末（周六/周日）开放 · 下一次 ' + nextWeekendTxt()); return; }
    var pool = shuffle(examPool());
    var n = (mode === 'full') ? Math.min(pool.length, 30) : Math.min(pool.length, 20);
    var list = pool.slice(0, n);
    if (!list.length) { toast('题库还没有内容'); return; }
    var total = (mode === 'full') ? 7200 : Math.round(n * 2 * 60);
    S.ex = { list: list, i: 0, picked: {}, mods: {}, total: total, left: total, mode: mode || 'quick', lastT: Date.now() };
    S.subject = 'quiz'; S.view = 'examq';
    syncHash(); render(); exTick();
  }
  function exTick() {
    if (S.exTimer) { clearInterval(S.exTimer); S.exTimer = null; }
    if (!S.ex) return;
    S.exTimer = setInterval(function () {
      if (!S.ex) { clearInterval(S.exTimer); S.exTimer = null; return; }
      S.ex.left--;
      if (S.ex.left <= 0) { S.ex.left = 0; clearInterval(S.exTimer); S.exTimer = null; examSubmit(true); return; }
      var el = document.getElementById('exclock');
      if (el) { el.textContent = clockTxt(S.ex.left); el.className = 'exclock' + (S.ex.left <= 300 ? ' red' : ''); }
    }, 1000);
  }
  function exBank() {
    var ex = S.ex; if (!ex) return;
    var cur = ex.list[ex.i], now = Date.now();
    var used = Math.max(0, Math.round((now - (ex.lastT || now)) / 1000));
    ex.mods[cur.mod] = ex.mods[cur.mod] || { n: 0, sec: 0, ok: 0 };
    ex.mods[cur.mod].sec += used;
    ex.lastT = now;
  }
  function renderExamQ() {
    var ex = S.ex;
    if (!ex) { S.view = 'exam'; return renderExamHome(); }
    var cur = ex.list[ex.i], q = cur.item.q, pick = ex.picked[ex.i] || [];
    var opts = (q.options || []).map(function (o, i) {
      var L = 'ABCD'[i];
      return '<button class="opt' + (pick.indexOf(L) >= 0 ? ' on' : '') + '" data-eopt="' + L + '"><b>' + L + '</b><span>' + h(o) + '</span></button>';
    }).join('');
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="ex-quit">‹</button>' +
      '<span class="grow small"><b>第 ' + (ex.i + 1) + ' / ' + ex.list.length + ' 题</b><div class="muted" style="font-size:12px">' + h(cur.mod) + ' · ' + typeName(q.type) + ' · 第 ' + cur.issue + ' 期</div></span>' +
      '<span class="exclock' + (ex.left <= 300 ? ' red' : '') + '" id="exclock">' + clockTxt(ex.left) + '</span></div>' +
      '<div class="card"><div class="qstem">' + h(q.stem) + '</div>' + opts + '</div>' +
      '<div class="row" style="gap:10px">' +
      '<button class="btn ghost' + (ex.i === 0 ? ' dis' : '') + '" data-act="ex-prev">‹ 上一题</button>' +
      '<button class="btn grow" data-act="ex-next">' + (ex.i + 1 >= ex.list.length ? '交卷' : '下一题 →') + '</button></div>' +
      '<div class="card small muted">考场模式：不显示对错、不给解析。已答 ' + Object.keys(ex.picked).length + ' / ' + ex.list.length + ' 题，额定 ' + Math.round(ex.total / ex.list.length) + ' 秒/题。剩 5 分钟倒计时变红，到点自动交卷。</div>';
    dropFooter();
  }
  function exPick(key) {
    var ex = S.ex; if (!ex) return;
    var cur = ex.list[ex.i], q = cur.item.q, pick = (ex.picked[ex.i] || []).slice();
    if (q.type === 'multi') {
      var k = pick.indexOf(key);
      if (k >= 0) pick.splice(k, 1); else pick.push(key);
    } else pick = [key];
    ex.picked[ex.i] = pick;
    render();
  }
  function exNav(d) {
    var ex = S.ex; if (!ex) return;
    exBank();
    var i = ex.i + d;
    if (i < 0) return;
    if (i >= ex.list.length) return examSubmit();
    ex.i = i; render();
  }
  function exQuit() {
    if (!S.ex) { S.view = 'exam'; return render(); }
    if (!window.confirm('中途退出算放弃，这次不计入记录。确定退出？')) return;
    if (S.exTimer) { clearInterval(S.exTimer); S.exTimer = null; }
    S.ex = null; S.view = 'exam'; syncHash(); render();
  }
  function examSubmit(auto) {
    var ex = S.ex; if (!ex) return;
    if (!auto && !window.confirm('确定交卷？剩余时间 ' + clockTxt(ex.left) + '。')) return;
    exBank();
    if (S.exTimer) { clearInterval(S.exTimer); S.exTimer = null; }
    var right = 0, rows = [];
    ex.list.forEach(function (x, i) {
      var pick = ex.picked[i] || [], ok = isRight(x.item, pick);
      if (ok) right++;
      var m = ex.mods[x.mod] = ex.mods[x.mod] || { n: 0, sec: 0, ok: 0 };
      m.n++; if (ok) m.ok++;
      rows.push({ i: i + 1, issue: x.issue, idx: x.idx, mod: x.mod, ok: ok, pick: pick.join('') || '—', ans: (x.item.q.answer || []).join('') });
      if (!ok) wMark(x.issue, x.idx, false);
    });
    var used = Math.max(0, ex.total - Math.max(ex.left, 0));
    var rec = { at: Date.now(), d: ymd(), score: right, total: ex.list.length, used: used, limit: ex.total, mode: ex.mode, mods: ex.mods, rows: rows };
    exam.e[String(rec.at)] = rec;
    saveExam();
    S.exResult = rec; S.ex = null; S.view = 'examdone';
    syncHash(); render();
  }
  function renderExamDone() {
    var r = S.exResult || examRecs()[0];
    if (!r) { S.view = 'exam'; return renderExamHome(); }
    var pct = Math.round(r.score / Math.max(r.total, 1) * 100);
    var mods = Object.keys(r.mods || {}).map(function (k) {
      var m = r.mods[k];
      return '<div class="wrow"><b>' + h(k) + '</b><span class="small muted">' + m.ok + '/' + m.n + ' · 用时 ' + Math.round((m.sec || 0) / 60) + ' 分</span></div>';
    }).join('');
    var rows = (r.rows || []).map(function (x) {
      return '<div class="wrow"><b class="' + (x.ok ? 'okc' : 'badc') + '">' + (x.ok ? '✅' : '❌') + ' ' + x.i + '</b>' +
        '<span class="small muted">' + h(x.mod) + ' · 第 ' + x.issue + ' 期 · 你 ' + x.pick + ' ／正确 ' + x.ans + '</span></div>';
    }).join('');
    var recs = examRecs().slice(0, 8).map(function (x) {
      var p = Math.round(x.score / Math.max(x.total, 1) * 100);
      return '<div class="wrow"><b>' + h(x.d) + '</b><span class="small muted">' + x.score + '/' + x.total + '（' + p + '%）· 用时 ' + Math.round(x.used / 60) + ' 分</span></div>';
    }).join('');
    var tip = pct >= 80 ? '这个水平稳住，考场不慌 💪' : (pct >= 60 ? '及格偏上，把错题啃掉就能上一档' : '分不高是好消息：现在暴露，比考场上暴露便宜多了');
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="exam">‹</button>' +
      '<span class="grow small"><b>模考成绩</b><div class="muted" style="font-size:12px">' + h(r.d) + ' · ' + (r.mode === 'full' ? '全真卷' : '快速卷') + ' · 额定 ' + Math.round((r.limit || 0) / 60) + ' 分钟</div></span></div>' +
      '<div class="card center"><div class="bigpct">' + pct + '%</div>' +
      '<div class="small muted">答对 ' + r.score + ' / ' + r.total + ' 题 · 实际用时 ' + Math.round(r.used / 60) + ' 分钟</div>' +
      '<div class="small muted" style="margin-top:4px">' + tip + '</div></div>' +
      (mods ? '<div class="card"><div class="block-title">分模块得分 / 用时</div>' + mods + '</div>' : '') +
      (rows ? '<div class="card"><div class="block-title">逐题结果</div>' + rows + '</div>' : '') +
      (recs ? '<div class="card"><div class="block-title">模考记录（最近 8 次）</div>' + recs + '</div>' : '') +
      '<div class="row" style="gap:10px;margin-bottom:24px"><button class="btn ghost grow" data-act="wrong">🧯 去错题本</button>' +
      '<button class="btn grow" data-act="exam">回到模考</button></div>';
    dropFooter();
  }
  function renderExamHome() {
    var recs = examRecs(), open = isWeekend(), pool = examPool(), best = 0;
    recs.forEach(function (r) { var p = Math.round(r.score / Math.max(r.total, 1) * 100); if (p > best) best = p; });
    var list = recs.slice(0, 10).map(function (r) {
      var p = Math.round(r.score / Math.max(r.total, 1) * 100);
      return '<button class="issue" data-exrec="' + r.at + '"><span class="idx">模<br>' + (r.mode === 'full' ? '全' : '快') + '</span>' +
        '<span class="meta"><h3>' + h(r.d) + ' · ' + (r.mode === 'full' ? '全真卷' : '快速卷') + '</h3>' +
        '<p>用时 ' + Math.round(r.used / 60) + ' 分钟 · ' + r.total + ' 题</p>' +
        '<span class="bar"><i style="width:' + p + '%"></i></span></span>' +
        '<span class="side"><span class="tag ' + (p >= 70 ? 'ok' : (p >= 50 ? '' : 'gray')) + '">' + p + '%</span>' +
        '<div class="small muted" style="margin-top:6px">' + r.score + '/' + r.total + '</div></span></button>';
    }).join('');
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small"><b>⏱️ 限时模考</b><div class="muted" style="font-size:12px">每周末开放（周六 · 周日）· 考场模式，到点自动交卷</div></span></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + (open ? '开放中' : '未开放') + '</b><span>本周末</span></div>' +
      '<div class="stat"><b>' + recs.length + '</b><span>已考次数</span></div>' +
      '<div class="stat"><b>' + (best ? best + '%' : '—') + '</b><span>最好成绩</span></div></div>' +
      (open ? '<div class="card"><div class="kptitle">🔓 今天是周末，模考开放中</div>' +
        '<div class="small muted" style="margin-top:6px">题库现有 ' + pool.length + ' 题，选一种卷子开考（中途退出算放弃）。周六、周日两天都能考，这两天之内考完就行。</div>' +
        '<div class="row" style="gap:10px;margin-top:14px">' +
        '<button class="btn grow" data-act="ex-start" data-mode="quick">快速卷 ' + Math.min(pool.length, 20) + ' 题 / ' + Math.round(Math.min(pool.length, 20) * 2) + ' 分钟</button>' +
        '<button class="btn ghost grow" data-act="ex-start" data-mode="full">全真卷 ' + Math.min(pool.length, 30) + ' 题 / 120 分钟</button></div></div>'
        : '<div class="card center"><div class="kptitle">🔒 今天不是周末</div>' +
        '<div class="small muted" style="margin-top:6px">模考只在<b>周末（周六、周日）</b>开放，下一次：<b>' + nextWeekendTxt() + '</b></div>' +
        '<div class="small muted" style="margin-top:6px">一次模考胜过三次刷题 —— 周末上来考一场，两天内考完就算。</div></div>') +
      '<div class="card small muted">考场规则：不显示对错、不给解析；剩 5 分钟倒计时变红；到点自动交卷。交卷后给总分、分模块用时、逐题对错，做错的自动进错题本。</div>' +
      (list ? '<div class="block-title">模考记录</div>' + list : '<div class="card center muted">还没考过，周末来第一场 🏁</div>') +
      '<div style="height:20px"></div>';
    dropFooter();
  }

  /* ================= 备份：导出 / 导入 ================= */
  function backupExport() {
    var id = ACCT.id || (curProfile() ? curProfile().id : 'anon');
    var o = { app: 'kaogong', v: 1, at: Date.now(), id: id, space: localSpace() };
    try {
      var blob = new Blob([JSON.stringify(o)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'kaogong-backup-' + ymd() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('备份已下载');
    } catch (e) { toast('导出失败：' + e.message); }
  }
  function backupImport(txt) {
    var o = null;
    try { o = JSON.parse(txt); } catch (e) { return toast('这个文件不是备份文件（解析失败）'); }
    var sp = o && o.space;
    if (!sp || !sp.data || !sp.accounts) return toast('备份内容不对，少数据');
    var before = localSpace();
    var merged = mergeSpace(before, sp);
    applySpace(merged); loadAll(); wBackfill(); iBackfill();
    toast('导入完成，已合并');
    render();
    scheduleSync();
  }
  function backupPick() {
    var inp = document.getElementById('bkpfile');
    if (inp) { inp.value = ''; inp.click(); }
  }

  /* ================= 英语听写（听发音拼单词） ================= */
  function dictStart(b) {
    b = (b === undefined || b === null) ? S.batch : b;
    var ws = mergeWords(b);
    if (!ws.length) { toast('这天还没有内容'); return; }
    S.batch = b;
    S.dict = { list: ws, i: 0, right: 0, wrong: [], just: '', typed: '' };
    S.subject = 'vocab'; S.view = 'dict';
    syncHash(); render(); speak(ws[0].w);
  }
  function dictCheck() {
    var d = S.dict; if (!d) return;
    var el = document.getElementById('dinput');
    var typed = el ? el.value : '';
    d.typed = typed;
    if (!String(typed).trim()) { toast('先拼一个再检查'); return; }
    var w = d.list[d.i];
    var ok = String(typed).trim().toLowerCase() === String(w.w).trim().toLowerCase();
    if (ok) {
      d.right++;
      if (!((vstore.w[w.w] || 0) >= 1)) setLvl(w.w, 1);
    } else {
      d.wrong.push(w.w);
      setLvl(w.w, 0);
    }
    d.just = ok ? 'ok' : 'no';
    render();
  }
  function dictNext() {
    var d = S.dict; if (!d) return;
    d.i++; d.just = ''; d.typed = '';
    if (d.i < d.list.length) speak(d.list[d.i].w);
    render();
  }
  function renderDict() {
    var d = S.dict;
    if (!d) { S.view = 'day'; return renderDay(); }
    if (d.i >= d.list.length) return renderDictDone();
    var w = d.list[d.i], fb = '';
    if (d.just === 'ok') fb = '<div class="card okcard"><div class="block-title">✅ 拼对了</div><div class="small muted">' + h(w.w) + ' /' + h(String(w.ph || '').replace(/^\/|\/$/g, '')) + '/ ' + h(w.cn || '') + '</div></div>';
    if (d.just === 'no') fb = '<div class="card badcard"><div class="block-title">❌ 拼错了：' + h(w.w) + '</div><div class="small muted">' + h(w.cn || '') + ' · 已自动加进生词本，明天复习它</div></div>';
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="dict-exit">‹</button>' +
      '<span class="grow small"><b>听写 ' + (d.i + 1) + ' / ' + d.list.length + '</b><div class="muted" style="font-size:12px">听发音拼单词 · 已拼对 ' + d.right + ' 个</div></span>' +
      '<button class="iconbtn" data-act="dict-say" title="再听一遍">🔊</button></div>' +
      '<div class="card center"><div class="small muted" style="margin-bottom:8px">听发音，把单词拼出来（' + h(w.cn || '') + '）</div>' +
      '<input id="dinput" class="dinput" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="在这里拼写…" value="' + h(d.typed || '') + '">' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn ghost" data-act="dict-say">🔊 再听</button>' +
      (d.just ? '<button class="btn grow" data-act="dict-next">' + (d.i + 1 >= d.list.length ? '看结果' : '下一个 →') + '</button>'
        : '<button class="btn grow" data-act="dict-check">检查（回车）</button>') +
      '</div></div>' + fb +
      '<div class="card small muted">错了会自动进生词本 → 明天在「复习」里以选择题形式考你。</div>';
    dropFooter();
    var el = document.getElementById('dinput');
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
  }
  function renderDictDone() {
    var d = S.dict, n = d.list.length, pct = Math.round(d.right / Math.max(n, 1) * 100);
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="dict-exit">‹</button>' +
      '<span class="grow small"><b>听写完成</b><div class="muted" style="font-size:12px">' + fmtDate(vDateOf(S.batch)) + ' 这 ' + n + ' 词</div></span></div>' +
      '<div class="card center"><div class="bigpct">' + pct + '%</div><div class="small muted">拼对 ' + d.right + ' / ' + n + ' 个</div>' +
      '<div class="small muted" style="margin-top:4px">' + (pct >= 80 ? '拼写基本过关，听力也顺了 👍' : '拼错的都在生词本里了，明天回来收拾它们') + '</div></div>' +
      (d.wrong.length ? '<div class="card"><div class="block-title">这些拼错了（已进生词本）</div>' + d.wrong.map(function (w) { return '<div class="wrow"><b class="sayw" data-say="' + h(w) + '">' + h(w) + '</b></div>'; }).join('') + '</div>' : '') +
      '<div class="row" style="gap:10px;margin-bottom:24px">' +
      '<button class="btn ghost grow" data-act="dict-again">再听写一遍</button>' +
      '<button class="btn grow" data-act="open-day">回到这天</button></div>';
    dropFooter();
  }

  /* ================= 申论动笔 ================= */
  function drills() { return (window.KG_DRILLS && window.KG_DRILLS.length) ? window.KG_DRILLS : []; }
  function drillOfDay(ds) {
    var n = drills(); if (!n.length) return null;
    var day = Math.floor((new Date(ds + 'T00:00:00').getTime() - new Date('2026-09-27T00:00:00').getTime()) / DAY);
    return n[((day % n.length) + n.length) % n.length];
  }
  function drillRec(ds) { return drill.d[ds] || null; }
  function drillSave(silent) {
    var ds = S.drillDs || ymd();
    var el = document.getElementById('drtext');
    var txt = el ? String(el.value || '') : '';
    var rec = drillRec(ds) || { hits: [] };
    if (!txt.trim()) { drill.d[ds] = { t: '', u: Date.now() }; saveDrill(); render(); if (!silent) toast('已清空这天的动笔'); return; }
    drill.d[ds] = { t: txt, u: Date.now(), hits: rec.hits || [] };
    saveDrill();
    if (!silent) toast('已保存（自动同步）');
    render();
  }
  function drillHit(i) {
    var ds = S.drillDs || ymd(), rec = drillRec(ds) || { t: '', hits: [] };
    rec.hits = rec.hits || [];
    rec.hits[i] = !rec.hits[i];
    rec.u = Date.now();
    drill.d[ds] = rec;
    saveDrill();
    render();
  }
  function renderDrill() {
    var ds = S.drillDs || ymd(), dl = drillOfDay(ds), rec = drillRec(ds), txt = (rec && rec.t) || '';
    var chars = txt.replace(/\s/g, '').length;
    var hitN = ((rec && rec.hits) || []).filter(Boolean).length;
    var total = dl ? (dl.frame || []).length : 0;
    var score = total ? Math.round(hitN / total * 100) : 0;
    if (!dl) { appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="tab-gold">‹</button><span class="grow small muted">申论动笔</span></div><div class="card center muted">题库还没准备好，等下次更新。</div>'; dropFooter(); return; }
    var frame = S.drillOpen ? '<div class="card"><div class="block-title">🧭 参考框架（对照着改）</div>' +
      (dl.frame || []).map(function (f, i) {
        var on = ((rec && rec.hits) || [])[i];
        return '<button class="hitrow' + (on ? ' on' : '') + '" data-hit="' + i + '"><span class="hitbox">' + (on ? '✓' : '') + '</span><div><b>' + h(f.k) + '</b><div class="small muted">' + h(f.d || '') + '</div></div></button>';
      }).join('') +
      '<div class="small muted" style="margin-top:8px">写到了就点一下勾上 → 自动算自评分（' + hitN + '/' + total + '）</div>' +
      (dl.words && dl.words.length ? '<div class="small" style="margin-top:8px">关键词：' + dl.words.map(function (w) { return '<span class="tag gray">' + h(w) + '</span>'; }).join(' ') + '</div>' : '') + '</div>' : '';
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="tab-gold">‹</button>' +
      '<span class="grow small"><b>✍️ 申论动笔</b><div class="muted" style="font-size:12px">' + fmtDate(ds) + ' · 每天一道小题</div></span>' +
      (score ? '<span class="tag ok">自评 ' + score + '%</span>' : '') + '</div>' +
      '<div class="card"><div class="rtags"><span class="tag">' + h(dl.topic || '申论') + '</span>' + (dl.type ? '<span class="tag gray">' + h(dl.type) + '</span>' : '') + (dl.score ? '<span class="tag gray">' + dl.score + ' 分</span>' : '') + '</div>' +
      '<div class="block-title" style="margin-top:8px">📄 材料</div><div class="small" style="line-height:1.75">' + h(dl.mat || '') + '</div>' +
      '<div class="block-title" style="margin-top:12px">✏️ 作答要求</div><div class="small" style="line-height:1.75">' + h(dl.req || '') + '</div></div>' +
      '<div class="card"><div class="block-title">你自己写</div>' +
      '<textarea id="drtext" class="dtext" placeholder="在材料里找点、按「总—分—总」写要点；写不动先列 3 条关键词也行。">' + h(txt) + '</textarea>' +
      '<div class="row between" style="margin-top:8px"><span class="small muted" id="drcnt">' + chars + ' 字</span>' +
      '<span class="small muted">Ctrl/⌘ + Enter 保存</span></div>' +
      '<div class="row" style="gap:10px;margin-top:10px">' +
      '<button class="btn grow" data-act="drill-save">保存</button>' +
      '<button class="btn ghost grow" data-act="drill-key">' + (S.drillOpen ? '收起参考框架' : '看参考框架') + '</button></div>' +
      (txt ? '<button class="btn ghost ghost-danger small" data-act="drill-del" style="margin-top:10px">清空这天</button>' : '') +
      '</div>' + frame +
      '<div class="card small muted">申论提分靠<b>动笔 + 对照</b>，不是靠看。写完先自己勾踩分点，再回去看一眼参考框架里你漏掉的那一条 —— 漏掉的那类点，就是你下次考试的失分点。</div>' +
      '<div style="height:24px"></div>';
    dropFooter();
    var el = document.getElementById('drtext');
    if (el && !txt) el.focus();
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
  function nDow(d) { if (!d) return ''; return '周' + DOWS[new Date(String(d) + 'T00:00:00').getDay()]; }
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
      return { n: x.n, w: e.w || x.w, ph: e.ph || x.ph, cn: e.cn || x.cn, eg: e.eg, egCn: e.egCn, rel: e.rel || {} };
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
  /* ---------- 考试倒计时（省考 / 四六级） ---------- */
  var CDEF = [
    { k: 'shengkao', id: '省考', ico: '🏛', date: '2026-12-05', note: '省考笔试：12 月第一个周末（西瓜给的，先按周六；若是周日就改成 12-06）' },
    { k: 'cet', id: '四六级', ico: '📘', date: '2026-12-12', note: 'CET 下半年考试：12 月 12 日（西瓜确认）' }
  ];
  function cdKeyOf(k) { return 'kg_cd_' + k; }
  function cdDateOf(def) {
    try { var v = localStorage.getItem(cdKeyOf(def.k)); if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v; } catch (e) {}
    return def.date;
  }
  function cdDaysTo(ds) {
    var a = new Date(ymd() + 'T00:00:00');
    var b = new Date(ds + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }
  function cdText(n) {
    if (n > 0) return n + ' 天';
    if (n === 0) return '就是今天';
    return '已过 ' + (-n) + ' 天';
  }
  function cdHtml() {
    var items = CDEF.map(function (d) {
      var ds = cdDateOf(d), n = cdDaysTo(ds);
      var cls = 'cdchip' + (n >= 0 && n <= 30 ? ' soon' : '') + (n < 0 ? ' past' : '');
      return '<button class="' + cls + '" data-cd="' + d.k + '" title="' + d.id + '：' + ds + '（点一下改日期）">' +
        d.ico + ' ' + d.id + ' <b>' + cdText(n) + '</b></button>';
    });
    return '<div class="cdbar">' + items.join('') + '</div>';
  }
  function editCd(k) {
    var def = null;
    CDEF.forEach(function (d) { if (d.k === k) def = d; });
    if (!def) return;
    var cur = cdDateOf(def);
    var v = window.prompt(def.id + ' 考试日期（格式 YYYY-MM-DD）\n' + def.note, cur);
    if (v == null) return;
    v = String(v).replace(/[\/\.]/g, '-').replace(/\s/g, '');
    var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) { toast('日期格式不对，例：' + cur); return; }
    var nv = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    try { localStorage.setItem(cdKeyOf(k), nv); } catch (e) {}
    toast(def.id + ' 已改为 ' + nv);
    render();
  }
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
      cdHtml() +
      '<div class="tabs">' +
      '<button class="tab' + (S.subject === 'quiz' ? ' on' : '') + '" data-act="tab-quiz">📕 考公刷题</button>' +
      '<button class="tab' + (S.subject === 'idiom' ? ' on' : '') + '" data-act="tab-idiom">📖 词语速记</button>' +
      '<button class="tab' + (S.subject === 'calc' ? ' on' : '') + '" data-act="tab-calc">🧮 速算训练</button>' +
      '<button class="tab' + (S.subject === 'vocab' ? ' on' : '') + '" data-act="tab-vocab">🎤 英语角</button>' +
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
    if (!ACCT.id) {
      owner = '<button class="offlinebar" data-act="go-gate">⚠️ 还没登录账号：数据只在这台设备 · 点这里登录 / 注册，开启全设备同步</button>' + owner;
    }
    appEl.innerHTML = tabsHtml() + owner + (
      S.subject === 'vocab' ? renderVocabHome()
        : (S.subject === 'news' ? renderNewsHome()
          : (S.subject === 'gold' ? renderGoldHome()
            : (S.subject === 'diary' ? renderDiary()
              : (S.subject === 'idiom' ? renderIdiomHome()
                : (S.subject === 'calc' ? renderCalcHome() : renderQuizHome()))))));
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
      '<div class="row" style="gap:10px;margin:0 0 12px">' +
      '<button class="btn ghost grow" data-act="wrong">🧯 错题本 ' + (wDue().length ? '· ' + wDue().length + ' 道待重做' : '') + '</button>' +
      '<button class="btn ghost grow" data-act="exam">⏱️ 限时模考' + (isWeekend() ? ' · 今天开放' : '') + '</button>' +
      '</div>' +
      '<div class="row" style="margin:0 0 12px">' +
      '<button class="btn grow" data-act="wk">📝 周末测试' + wkHomeTag() + '</button>' +
      '</div>' +
      '<div class="row between" style="margin:0 4px 10px"><span class="small muted">往期内容</span>' +
      '<span class="small muted">点卡片开始刷题</span></div>' + cards +
      '<div class="card small muted" style="text-align:center">考公每天两期：早上 8:00 · 晚上 8:00 各更新一期 · 进度存在本机浏览器</div>';
  }

  function renderVocabHome() {
    var st = vocabStats();
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    var nb = nextBatch(), due = dueWords().length, left = daysLeft();
    var days = batchCount();

    /* ---- 天列表：🔝待背/待复习 在上（刚背完的留一天复习），✅已背完 在下，⏳未发布的按周排在最后 ---- */
    var topB = [], doneB = [], futureB = [];
    for (var b = 1; b <= days; b++) {
      var cb = batchContent(b);
      if (!cb || !(cb.words || []).length) { futureB.push(b); continue; }
      var don = vDoneOn(b);
      if (don && (-cdDaysTo(don)) >= 2) doneB.push(b); else topB.push(b);
    }
    topB.sort(byNewDay); doneB.sort(byNewDay);
    var groups = '';
    if (topB.length) groups += '<div class="wkhead"><span>🔝 待背 / 待复习</span>' +
      '<span class="small muted">' + topB.length + ' 天</span></div>' + topB.map(dayCard).join('');
    if (doneB.length) groups += '<div class="wkhead"><span>✅ 已背完</span>' +
      '<span class="small muted">' + doneB.length + ' 天</span></div>' + doneB.map(dayCard).join('');
    for (var q = 0; q < futureB.length; q += 7) {
      var seg = futureB.slice(q, q + 7), finner = '';
      for (var j = 0; j < seg.length; j++) finner += dayCard(seg[j]);
      groups += '<div class="wkhead"><span>⏳ 待更新</span>' +
        '<span class="small muted">' + fmtDate(vDateOf(seg[0])) + ' – ' + fmtDate(vDateOf(seg[seg.length - 1])) + '</span></div>' + finner;
    }

    var today = ymd(), todayB = 0;
    for (var t = 1; t <= days; t++) if (vDateOf(t) === today) todayB = t;

    return '<div class="card">' +
      '<div class="between"><div><div class="kptitle">四级核心 2000 词 + 每日精读</div>' +
      '<div class="small muted">每天 50 词 + 1 篇四级风格文章 · ' + days + ' 天走完（' + fmtDate(vDateOf(days)) + '）</div></div>' +
      '<div class="bigpct">' + pct + '%</div></div>' +
      '<span class="bar lg"><i style="width:' + pct + '%"></i></span>' +
      '<div class="vstats">' +
      '<span class="vs ok">认识 ' + st.known + '</span>' +
      '<span class="vs warn">模糊 ' + st.fuzzy + '</span>' +
      '<span class="vs err">不认识 ' + st.no + '</span>' +
      '<span class="vs gray">未学 ' + (st.total - st.done) + '</span></div>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn grow" data-act="learn-next">▶ 继续背（' + fmtDate(vDateOf(nb)) + '）</button>' +
      (todayB && (batchContent(todayB) || {}).article ? '<button class="btn ghost" data-act="read-today">📖 读文章</button>' : '') +
      '<button class="btn ghost" data-act="review">复习' + (due ? ' ' + due : '') + '</button></div>' +
      '<div class="summary-box small muted" style="margin-top:10px">还剩 ' + left + ' 天到 ' + DEADLINE + ' · 还差 ' + (st.total - st.done) + ' 词 · 每天 50 词</div>' +
      '</div>' +
      '<div class="card small muted">💡 点某一天进去看这天的 50 个词 + 配套文章；点「🔊」听发音；标了「模糊 / 不认识」的词自动进生词本，复习优先考它们。</div>' +
      '<div class="row between" style="margin:0 4px 10px"><span class="small muted">按天排（🔝 待背在前 · ✅ 已背完在后）</span>' +
      '<span class="small muted">共 ' + days + ' 天</span></div>' + groups;
  }

  function vDateOf(b) {
    var c = batchContent(b);
    if (c && c.date) return c.date;
    var d = new Date(VBATCH_START + 'T00:00:00');
    d.setDate(d.getDate() + (b - 1));
    return ymd(d);
  }
  function vDowOf(b) { return '周' + DOWS[new Date(vDateOf(b) + 'T00:00:00').getDay()]; }

  function dayCard(b) {
    var ws = batchWords(b), dn = 0;
    for (var i = 0; i < ws.length; i++) if (lvlOf(ws[i].w) !== null) dn++;
    var bp = ws.length ? Math.round(dn / ws.length * 100) : 0;
    var c = batchContent(b), hasArt = !!(c && c.article);
    var ds = vDateOf(b), isToday = ds === ymd();
    var tag = dn >= ws.length ? '<span class="tag ok">背完了</span>'
      : (dn ? '<span class="tag">' + dn + '/' + ws.length + '</span>'
        : (c ? '<span class="tag gray">未开始</span>' : '<span class="tag gray">待更新</span>'));
    return '<button class="issue' + (dn >= ws.length ? ' done' : '') + (isToday ? ' nowday' : '') + '" data-dayno="' + b + '">' +
      '<span class="idx"><b>' + ds.slice(8) + '</b>' + ds.slice(5, 7) + '月</span>' +
      '<span class="meta"><h3>' + ds.slice(5, 7).replace(/^0/, '') + '月' + ds.slice(8).replace(/^0/, '') + '日 ' + vDowOf(b) + (isToday ? ' · 今天' : '') + '</h3>' +
      '<p class="small muted">' + (hasArt ? '📖 ' + h((c.article.title || '').slice(0, 26)) : '文章待更新') + '</p>' +
      '<span class="bar"><i style="width:' + bp + '%"></i></span></span>' +
      '<span class="side">' + tag + '<div class="small muted" style="margin-top:6px">50 词' + (hasArt ? ' + 文章' : '') + '</div></span>' +
      '</button>';
  }

  /* 某天「背完」的日期（YYYY-MM-DD）；没背完返回 null。
     用这批词最后一次标记的时间推算，没有时间戳就退回这天自己的日期。 */
  function vDoneOn(b) {
    var ws = batchWords(b), mx = 0;
    if (!ws.length) return null;
    for (var i = 0; i < ws.length; i++) {
      if (lvlOf(ws[i].w) === null) return null;
      var t = (vstore.t || {})[String(ws[i].w).toLowerCase()] || 0;
      if (t > mx) mx = t;
    }
    return mx ? ymd(new Date(mx)) : vDateOf(b);
  }
  /* 新的在前 */
  function byNewDay(a, b) { var x = vDateOf(a), y = vDateOf(b); return x === y ? 0 : (x > y ? -1 : 1); }

  /* ---- 某一天：词表 + 文章入口 ---- */
  function renderDay() {
    var b = S.batch, ws = mergeWords(b), c = batchContent(b), ds = vDateOf(b);
    var dn = 0;
    for (var i = 0; i < ws.length; i++) if (lvlOf(ws[i].w) !== null) dn++;
    var pct = ws.length ? Math.round(dn / ws.length * 100) : 0;
    var isToday = ds === ymd();

    var rows = ws.map(function (x, i) {
      var lv = lvlOf(x.w);
      var cls = lv === 2 ? 'ok' : (lv === 1 ? 'warn' : (lv === 0 ? 'err' : 'gray'));
      var txt = lv === null ? '未学' : ['不认识', '模糊', '认识'][lv];
      return '<div class="wrow dayrow" data-batch="' + b + '" data-wi="' + i + '"><b>' + h(x.w) + '</b>' +
        '<span class="small muted">' + h(String(x.cn || '').slice(0, 14)) + '</span>' +
        '<span class="wdot ' + cls + '">' + txt + '</span></div>';
    }).join('');

    appEl.innerHTML = '<div class="topbar solid">' +
      '<button class="iconbtn" data-act="tab-vocab">‹</button>' +
      '<span class="grow small"><b>' + fmtDate(ds) + ' ' + vDowOf(b) + (isToday ? ' · 今天' : '') + '</b>' +      '<div class="muted" style="font-size:12px">第 ' + b + ' 天 / 共 ' + batchCount() + ' 天 · 50 词' + (c && c.article ? ' + 1 篇阅读' : '') + '</div></span>' +
      '<span class="small muted">' + dn + '/50</span></div>' +
      '<div class="card"><span class="bar lg"><i style="width:' + pct + '%"></i></span>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn grow" data-act="learn-day">' + (dn ? '继续背这 50 词' : '开始背这 50 词') + '</button>' +
      (c && c.article ? '<button class="btn ghost" data-act="open-read">📖 读文章</button>' : '') + '</div>' +
      '<div class="row" style="gap:10px;margin-top:10px">' +
      '<button class="btn ghost grow" data-act="dict-start">⌨️ 听写模式（听发音拼单词）</button></div>' +
      (c && c.article ? '<div class="small muted" style="margin-top:10px">📖 ' + h(c.article.title || '') + '（' + h(c.article.topic || '') + '）</div>' : '') +
      '</div>' +
      '<div class="card"><div class="block-title">📋 这天的 50 词</div>' + rows + '</div>' +
      '<div class="card small muted">点任意一个词 → 进卡片式背诵；点「🔊」听发音。标「模糊 / 不认识」的词会自动进生词本。</div>';
  }

  /* ---- 每日文章 ---- */
  function renderRead() {
    var b = S.batch, c = batchContent(b);
    if (!c || !c.article) { return goDay(b); }
    var a = c.article, g = a.glossary || {};
    var paras = (a.paras || []).map(function (p) { return '<p class="rpar">' + h(p) + '</p>'; }).join('');
    if (!paras && a.body) paras = String(a.body).split(/\n+/).map(function (p) { return '<p class="rpar">' + h(p) + '</p>'; }).join('');
    var hard = (a.hard || []).map(function (x) {
      return '<div class="hardrow"><div class="hen">' + h(x.en || '') + '</div>' +
        (x.cn ? '<div class="hcn">' + h(x.cn) + '</div>' : '') +
        (x.why ? '<div class="small muted">💡 ' + h(x.why) + '</div>' : '') + '</div>';
    }).join('');
    var gw = (g.words || []).map(function (x) {
      return '<div class="wrow"><b class="sayw" data-say="' + h(x.w) + '">' + h(x.w) + '</b>' +
        '<span class="small muted">' + (x.ph ? '/' + h(String(x.ph).replace(/^\/|\/$/g, '')) + '/ ' : '') + h(x.cn || '') + '</span>' +
        '<button class="mini" data-addw="' + h(x.w) + '" title="加入生词本">＋生词本</button></div>';
    }).join('');
    var gp = (g.phrases || []).map(function (x) {
      return '<div class="wrow"><b>' + h(x.p) + '</b><span class="small muted">' + h(x.cn || '') + '</span></div>';
    }).join('');
    var q = (a.quotes || []).map(function (x, i) {
      return '<div class="quotecard"><div class="qen">“' + h(x.en || '') + '”</div>' +
        '<div class="qcn">' + h(x.cn || '') + (x.who ? ' —— ' + h(x.who) : '') + '</div>' +
        '<button class="btn ghost small" data-copy="' + (b + '-' + i) + '">复制这句</button></div>';
    }).join('');

    appEl.innerHTML = '<div class="topbar solid">' +
      '<button class="iconbtn" data-act="open-day">‹</button>' +
      '<span class="grow small"><b>每日精读</b><div class="muted" style="font-size:12px">' + fmtDate(vDateOf(b)) + ' ' + vDowOf(b) + ' · ' + h(a.topic || '四级素材') + '</div></span></div>' +
      '<div class="card"><div class="rtitle">' + h(a.title || '') + '</div>' +
      '<div class="rtags"><span class="tag">' + h(a.topic || '') + '</span><span class="tag gray">' + h(a.level || 'CET-4') + '</span>' +
      (a.words ? '<span class="tag gray">约 ' + a.words + ' 词</span>' : '') + '</div>' + paras +
      (a.zh ? '<div class="rzh"><b>中文大意</b>' + h(a.zh) + '</div>' : '') + '</div>' +
      (hard ? '<div class="card"><div class="block-title">🧩 长难句拆解</div>' + hard + '</div>' : '') +
      '<div class="card"><div class="block-title">📌 重点难点词汇</div>' + (gw || '<div class="small muted">暂无</div>') +
      '<div class="small muted" style="margin-top:8px">点单词可听发音</div></div>' +
      '<div class="card"><div class="block-title">🔗 重点短语搭配</div>' + (gp || '<div class="small muted">暂无</div>') + '</div>' +
      (q ? '<div class="card"><div class="block-title">🧠 名言积累（可直接搬进作文）</div>' + q + '</div>' : '') +
      '<div class="row" style="gap:10px;margin-bottom:20px">' +
      '<button class="btn ghost grow" data-act="open-day">← 回到这天</button>' +
      '<button class="btn grow" data-act="open-read-next">下一篇 →</button></div>';
  }

  function copyQuote(id) {
    var p = String(id).split('-'), b = parseInt(p[0], 10), i = parseInt(p[1], 10);
    var c = batchContent(b), q = c && c.article && (c.article.quotes || [])[i];
    if (!q) return;
    copyText('“' + q.en + '” —— ' + (q.who || '') + '／' + (q.cn || ''), '名言已复制');
  }

  function copyText(txt, msg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { toast(msg || '已复制'); }, function () { fallbackCopy(txt, msg); });
      } else fallbackCopy(txt, msg);
    } catch (e) { fallbackCopy(txt, msg); }
  }
  function fallbackCopy(txt, msg) {
    try {
      var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove(); toast(msg || '已复制');
    } catch (e) { toast('复制失败，长按选中手动复制'); }
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
        '<span class="meta"><h3>' + fmtDate(n.date) + ' ' + nDow(n.date) + '</h3>' +
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
      '<div class="card small muted" style="text-align:center">新闻一天一期（早上 8:00 更新）· 只挑 2~3 条精读，末尾附可直接上考场的申论金句</div>';
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
        return '<div class="card" data-nsi="' + o.i + '">' +
          '<div class="between" style="margin-bottom:8px"><span class="tag gray">' + h(n.cat || '要闻') + '</span>' +
          '<span class="small muted"><button class="btn gray nsjump" data-nsjump="' + o.i + '">▶ 听这条</button>' +
          '<span style="margin-left:6px">' + (o.i + 1) + ' / ' + list.length + '</span></span></div>' +
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
      '<div class="muted" style="font-size:12px">' + fmtDate(it.date) + ' ' + nDow(it.date) + ' · ' + list.length + ' 条 · 金句 ' + sl.length + ' 条</div></span>' +
      (NEWS.length > 1 ? '<button class="iconbtn" data-act="news-older" title="往期">📚</button>' : '') + '</div>' +
      naRow(it) + nsBar(it) + nav + (it.brief ? '<div class="card small muted">🗞 ' + h(it.brief) + '</div>' : '') + body +
      '<div class="sechead">📝 申论金句（' + sl.length + ' 条）</div>' +
      '<div class="card small muted">每句话都能直接搬进考场：<b>句式</b>给你骨架，<b>案例</b>给你血肉（可随手替换）；「怎么引用」说落笔位置，「背后的故事」把新闻读成论证材料。</div>' +
      slHtml +
      '<button class="btn ghost block" data-act="home" style="margin-bottom:24px">← 返回新闻列表</button>';
    dropFooter();
  }

  /* ================= 新闻朗读（听新闻 · 像听新闻联播） ================= */
  var NSP = { on: false, i: -1, rate: 1, resume: undefined, vname: '', anchor: true };
  function nsPref(k, d) { try { var v = localStorage.getItem(k); return (v === null || v === undefined) ? d : v; } catch (e) { return d; } }
  function nsSavePref(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  NSP.vname = nsPref('kg_ns_vox', '');
  NSP.anchor = nsPref('kg_ns_anchor', '1') !== '0';
  function nsZhVoices() {
    if (!window.speechSynthesis) return [];
    var vs = []; try { vs = speechSynthesis.getVoices() || []; } catch (e) { return []; }
    var out = [];
    for (var i = 0; i < vs.length; i++) {
      var L = vs[i].lang || '', N = vs[i].name || '';
      if (/^zh/i.test(L) || /Chinese|中文|普通话|Mandarin|Xiaoxiao|Yunxi|Yunjian|婷婷|晓晓|云希|云健/i.test(N)) out.push(vs[i]);
    }
    return out;
  }
  function nsVoice() {
    var vs = nsZhVoices();
    if (!vs.length) return null;
    var i;
    if (NSP.vname) { for (i = 0; i < vs.length; i++) { if (vs[i].name === NSP.vname) return vs[i]; } }
    for (i = 0; i < vs.length; i++) {
      var n = vs[i].name || '';
      if (/Natural|Online|Neu|Xiaoxiao|Yunxi|Yunjian|晓晓|云希|云健|婷婷|播音|新闻/i.test(n)) return vs[i];
    }
    for (i = 0; i < vs.length; i++) { if (/^zh[-_]?CN/i.test(vs[i].lang || '')) return vs[i]; }
    return vs[0];
  }
  function nsPitch() { return NSP.anchor ? 0.85 : 1; }
  function nsChunks(it) {
    var a = [];
    a.push({ i: -1, t: '第 ' + it.id + ' 期，' + fmtDate(it.date) + '，新闻精读，共 ' + ((it.news || []).length) + ' 条。听个大概，再去下面看申论金句。' });
    (it.news || []).forEach(function (n, i) {
      a.push({ i: i, t: (n.cat ? n.cat + '，' : '') + (n.h || '') + '。' + (n.p || '') + (n.why ? ' 为什么重要：' + n.why : '') });
    });
    return a;
  }
  function nsSeconds(it) {
    var s = nsChunks(it).map(function (c) { return c.t; }).join('');
    var n = s.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').length;
    return Math.max(20, Math.round(n / (4.3 * NSP.rate)));
  }
  function nsIntro(it) {
    var sec = nsSeconds(it), m = Math.floor(sec / 60), s = sec % 60;
    return '👂 连播 ' + ((it.news || []).length) + ' 条精读 · 约 ' + (m ? m + ' 分 ' : '') + s + ' 秒 · 听个大概，金句自己看更快';
  }
  function nsSetBtn(txt) { var b = document.querySelector('[data-act="ns-play"]'); if (b) b.innerHTML = txt; }
  function nsCards() { return document.querySelectorAll('[data-nsi]'); }
  function nsClearHi() {
    var cs = nsCards();
    for (var k = 0; k < cs.length; k++) cs[k].className = cs[k].className.replace(' ns-on', '');
  }
  function nsMark(i) {
    nsClearHi();
    var cs = nsCards();
    for (var k = 0; k < cs.length; k++) {
      if (String(i) === cs[k].getAttribute('data-nsi')) {
        cs[k].className += ' ns-on';
        try { cs[k].scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
      }
    }
    var ln = document.getElementById('nsline');
    if (ln) ln.textContent = i < 0 ? '🔊 正在播报本期概要…' : ('🔊 正在读第 ' + (i + 1) + ' 条 · 听完往下看金句 👇');
    nsSetBtn('⏸ 暂停');
  }
  function nsStop(msg) {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { }
    NSP.on = false; NSP.i = -1;
    nsClearHi();
    var ln = document.getElementById('nsline');
    if (ln && msg !== undefined) ln.textContent = msg;
    nsSetBtn('🔊 听新闻');
  }
  function nsPlay(fromItem) {
    if (!window.speechSynthesis) return toast('这个浏览器不支持朗读，换 Chrome / Edge 或手机自带浏览器试试');
    var it = newsById(S.newsId); if (!it) return;
    var ch = nsChunks(it);
    try { speechSynthesis.cancel(); } catch (e) { }
    naPause();
    NSP.on = true;
    var start = (fromItem === undefined || fromItem === null) ? 0 : fromItem + 1;
    (function next(k) {
      if (!NSP.on) return;
      if (k >= ch.length) {
        NSP.on = false; NSP.resume = undefined;
        nsClearHi(); nsSetBtn('🔁 再听一遍');
        var ln = document.getElementById('nsline');
        if (ln) ln.textContent = '✅ 本期读完了 · 往下翻看申论金句，记两句就够本';
        return;
      }
      NSP.i = ch[k].i; NSP.resume = ch[k].i;
      nsMark(ch[k].i);
      var u = new SpeechSynthesisUtterance(ch[k].t);
      u.lang = 'zh-CN'; u.rate = NSP.rate; u.pitch = nsPitch();
      var v = nsVoice(); if (v) u.voice = v;
      u.onend = function () { if (NSP.on) next(k + 1); };
      u.onerror = function () { if (NSP.on) next(k + 1); };
      try { speechSynthesis.speak(u); } catch (e) { NSP.on = false; nsSetBtn('🔊 听新闻'); }
    })(start);
  }
  function nsToggle() {
    if (NSP.on) {
      NSP.on = false;
      try { speechSynthesis.cancel(); } catch (e) { }
      nsClearHi(); nsSetBtn('▶ 继续');
      var ln = document.getElementById('nsline');
      if (ln) ln.textContent = '⏸ 已暂停 · 点「继续」从这条重读';
      return;
    }
    var it = newsById(S.newsId); if (!it) return;
    var from = (NSP.resume === undefined || NSP.resume === null) ? null : NSP.resume;
    if (NSP.resume === -1) from = null;
    nsPlay(from);
  }
  function nsRate(r) {
    NSP.rate = r;
    var cs = document.querySelectorAll('[data-nsrate]');
    for (var k = 0; k < cs.length; k++) {
      cs[k].className = 'nsrate' + (parseFloat(cs[k].getAttribute('data-nsrate')) === r ? ' on' : '');
    }
    var it = newsById(S.newsId);
    var ln = document.getElementById('nsline');
    if (!NSP.on) { if (ln && it) ln.textContent = nsIntro(it); return; }
    nsPlay(NSP.i === -1 ? null : NSP.i);
  }
  function nsSay(text) {
    if (!window.speechSynthesis) return toast('这个浏览器不支持朗读');
    try { speechSynthesis.cancel(); } catch (e) { }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = NSP.rate; u.pitch = nsPitch();
    var v = nsVoice(); if (v) u.voice = v;
    try { speechSynthesis.speak(u); } catch (e) { }
  }
  function nsVoxOpts() {
    var vs = nsZhVoices();
    var o = '<option value="">自动挑选（推荐）</option>';
    for (var i = 0; i < vs.length; i++) {
      var nm = vs[i].name || ('音色' + (i + 1));
      if (vs[i].lang) nm += ' · ' + vs[i].lang;
      o += '<option value="' + h(vs[i].name || '') + '"' + (NSP.vname === vs[i].name ? ' selected' : '') + '>' + h(nm) + '</option>';
    }
    return o;
  }
  function nsFillVoices() {
    var s = document.getElementById('nsvox');
    if (!s) return;
    s.innerHTML = nsVoxOpts();
    var tip = document.getElementById('nsvoxn');
    if (tip) tip.textContent = nsZhVoices().length ? (nsZhVoices().length + ' 个中文音色') : '正在加载音色…';
  }
  function nsVoiceRow() {
    var n = nsZhVoices().length;
    return '<div class="nsvrow">' +
      '<span class="small muted">🎙 音色</span>' +
      '<select id="nsvox" class="nsvsel">' + nsVoxOpts() + '</select>' +
      '<span class="small muted" id="nsvoxn">' + (n ? n + ' 个中文音色' : '正在加载音色…') + '</span>' +
      '<button class="nsrate" data-act="ns-vox-preview">🎧 试听</button>' +
      '<button class="nsrate' + (NSP.anchor ? ' on' : '') + '" data-act="ns-anchor">🎙 播音腔</button>' +
      '</div>';
  }
  function nsSetVox(name) {
    NSP.vname = name || '';
    nsSavePref('kg_ns_vox', NSP.vname);
    if (NSP.on) nsPlay(NSP.i === -1 ? null : NSP.i);
    else nsSay('音色已切换，' + (NSP.anchor ? '播音腔开。' : '自然音。') + '这里是每日新闻精读。');
  }
  function nsAnchorToggle() {
    NSP.anchor = !NSP.anchor;
    nsSavePref('kg_ns_anchor', NSP.anchor ? '1' : '0');
    var b = document.querySelector('[data-act="ns-anchor"]');
    if (b) b.className = 'nsrate' + (NSP.anchor ? ' on' : '');
    if (NSP.on) nsPlay(NSP.i === -1 ? null : NSP.i);
    else nsSay(NSP.anchor ? '播音腔已开启，各位听众朋友，这里是每日新闻精读。' : '已切回自然音。');
  }
  function nsBar(it) {
    return '<div class="nsbar">' +
      '<button class="btn" data-act="ns-play" style="padding:9px 16px">🔊 听新闻</button>' +
      '<button class="btn gray" data-act="ns-stop" title="停止">⏹</button>' +
      '<span class="nsrates">' + [0.8, 1, 1.25, 1.5].map(function (r) {
        return '<button class="nsrate' + (NSP.rate === r ? ' on' : '') + '" data-nsrate="' + r + '">' + r + '×</button>';
      }).join('') + '</span>' + nsVoiceRow() + '</div>' +
      '<div class="small muted nsline" id="nsline">' + nsIntro(it) + '</div>';
  }

  /* ---- 播音腔 MP3（服务端预合成，edge-tts 云扬/晓晓） ---- */
  function naCur(it) {
    var a = it && it.audio;
    if (!a || !a.v || !a.v.length) return null;
    var want = nsPref('kg_na_vox', a.v[0].k);
    for (var i = 0; i < a.v.length; i++) { if (a.v[i].k === want) return a.v[i]; }
    return a.v[0];
  }
  function naRow(it) {
    var a = it && it.audio;
    if (!a || !a.v || !a.v.length) return '';
    var cur = naCur(it);
    var m = Math.floor((cur.sec || 0) / 60), s = (cur.sec || 0) % 60;
    return '<div class="narow">' +
      '<div class="between" style="margin-bottom:6px">' +
      '<span class="small"><b>🎧 播音腔朗读</b><span class="muted"> · 约 ' + (m ? m + ' 分 ' : '') + s + ' 秒</span></span>' +
      '<span class="nsrates">' + a.v.map(function (x) {
        return '<button class="nsrate' + (x.k === cur.k ? ' on' : '') + '" data-navox="' + h(x.k) + '">' + h(x.n) + '</button>';
      }).join('') + '</span></div>' +
      '<audio id="naudio" class="naudio" controls preload="none" src="' + h(cur.src) + '"></audio>' +
      '<div class="small muted" style="margin-top:6px">🎙 真人感播报（云扬/晓晓）· 可拖动进度、可后台播 · 听个大概，金句自己看</div>' +
      '</div>';
  }
  function naVox(k) {
    nsSavePref('kg_na_vox', k);
    var it = newsById(S.newsId); if (!it || !it.audio) return;
    var src = '', label = k, vs = it.audio.v || [];
    for (var i = 0; i < vs.length; i++) { if (vs[i].k === k) { src = vs[i].src; label = vs[i].n; } }
    var au = document.getElementById('naudio');
    if (au && src) { au.src = src; try { au.play(); } catch (e) { } }
    if (NSP.on) nsStop();
    var cs = document.querySelectorAll('[data-navox]');
    for (var j = 0; j < cs.length; j++) cs[j].className = 'nsrate' + (cs[j].getAttribute('data-navox') === k ? ' on' : '');
    toast('已切到 ' + label);
  }
  function naPause() {
    var au = document.getElementById('naudio');
    if (au) { try { au.pause(); } catch (e) { } }
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
    var drillCard = '<button class="btn ghost grow" data-act="drill" style="margin-bottom:12px">✍️ 今天动笔写一道申论小题' + (drillRec(ymd()) && String(drillRec(ymd()).t || '').trim() ? '（今天已写 ✓）' : '') + '</button>';
    var all = goldList();
    if (!all.length) return drillCard + '<div class="card center muted">还没有金句，等第一期新闻发布后就有了～</div>';
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
      drillCard +
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
      '<div class="card small muted">📌 记录会跟着你的 <b>ID</b> 走：登录同一个 ID，手机 / 平板 / 电脑看到的是同一份日志（改完约 2 秒自动同步）。日历上<b>蓝底</b>=有记录，<b>方框</b>=今天。想每天留点痕迹，就写两句：今天刷了什么、哪儿卡住了、明天先干什么。</div>';
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

  function ymdhms(d) {
    d = d ? new Date(d) : new Date();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return ymd(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
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
    var now = Date.now(), today = ymd(now), stamp = ymdhms(now);
    /* 防重复：同一次打开（含 Service Worker 自动刷新）60 秒内只记一次 */
    try {
      var lastT = parseInt(localStorage.getItem('kg_stat_t') || '0', 10) || 0;
      if (lastT && now - lastT < 60000) return;
      localStorage.setItem('kg_stat_t', String(now));
    } catch (e) {}
    statGet().then(function (d) {
      if (!d) return;
      var pr = curProfile();
      var e = d.u[uid] || { f: today, l: today, n: 0, names: [] };
      var isNew = !e.f;
      e.n = (e.n || 0) + 1;               /* n = 打开次数（每次打开 +1） */
      e.l = today;
      e.lt = stamp;                        /* 最近时间：精确到秒 */
      if (isNew) { e.f = today; e.ft = stamp; }   /* 首次时间：精确到秒 */
      e.days = e.days || [];               /* 来过哪些天（去重） */
      if (e.days.indexOf(today) < 0) e.days.push(today);
      e.names = e.names || [];
      if (pr && pr.name && e.names.indexOf(pr.name) < 0) e.names.push(pr.name);
      d.u[uid] = e;
      /* 全局每日活跃（谁在哪天来过 → 图表/活跃数才准） */
      d.d = d.d || {};
      var g = d.d[today] || { us: [], neu: 0 };
      g.us = g.us || [];
      if (g.us.indexOf(uid) < 0) {
        g.us.push(uid);
        if (isNew) g.neu = (g.neu || 0) + 1;
      }
      d.d[today] = g;
      d.v = 2;
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
      var names = [], visits = 0, act = 0, act7 = 0;
      function daysOfE(e) { return (e.days && e.days.length) ? e.days : (e.l ? [e.l] : []); }
      uids.forEach(function (k) {
        var e = d.u[k] || {}, ds = daysOfE(e);
        if (ds.indexOf(today) >= 0) act++;
        for (var i = 0; i < last7.length; i++) { if (ds.indexOf(last7[i]) >= 0) { act7++; break; } }
        visits += (e.n || 0);
        (e.names || []).forEach(function (nm) { if (nm && names.indexOf(nm) < 0) names.push(nm); });
      });
      var rows = uids.map(function (k) { return { k: k, e: d.u[k] || {} }; })
        .sort(function (a, b) { return String(b.e.l || '').localeCompare(String(a.e.l || '')); });

      var hist = last14.map(function (day) {
        var g = (d.d || {})[day];
        if (g) return { day: day, act: (g.us || []).length, neu: (g.neu || 0) };
        var cnt = 0, neu = 0;
        uids.forEach(function (k) {
          var e = d.u[k] || {}, ds = daysOfE(e);
          if (ds.indexOf(day) >= 0) cnt++;
          if (String(e.ft || e.f || '').slice(0, 10) === day) neu++;
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
          '<span class="small muted">' + h(r.k.slice(-6)) + ' · 首次 ' + h(e.ft || e.f || '-') + ' · 最近 ' + h(e.lt || e.l || '-') + ' · 来过 ' + (daysOfE(e).length || 1) + ' 天</span></span>' +
          '<span class="un">' + (e.n || 0) + ' 次</span></div>';
      }).join('') || '<div class="center muted small">还没有用户数据</div>';

      box.outerHTML =
        '<div class="stats">' +
        '<div class="stat"><b>' + uids.length + '</b><span>累计用户</span></div>' +
        '<div class="stat"><b>' + act + '</b><span>今日活跃</span></div>' +
        '<div class="stat"><b>' + act7 + '</b><span>近7日活跃</span></div></div>' +
        '<div class="row between" style="margin:0 4px 10px"><span class="small muted">近 14 天活跃（+N = 当日新增）</span>' +
        '<span class="small muted">累计打开 ' + visits + ' 次 · 档案 ' + names.length + ' 个</span></div>' +
        '<div class="card">' + bars + '</div>' +
        '<div class="row between" style="margin:0 4px 10px"><span class="small muted">用户明细（按最近活跃排序）</span></div>' +
        '<div class="card">' + list + '</div>' +
        '<div class="card small muted">统计口径：按<b>浏览器</b>去重（清缓存/换设备＝新用户）——「累计用户」＝去重后的浏览器数；「N 次」＝打开次数（每次打开 +1，同一分钟内只记一次）；「今日/近 7 日活跃」＝当天 / 近 7 天来过的浏览器数；<b>时间取设备本地时间，精确到秒</b>（首次 / 最近）。不记录任何学习内容、密码或同步码。数据存在公共 KV（textdb.dev），知道地址的人理论上都能读，所以只用来数人头，别当安全系统。</div>' +
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
    } else if (S.view === 'idiom') {
      var iitems = idiomQueue(), ii = S.idx;
      if (!iitems[ii]) return;
      if (!S.judged) {
        inner = '<div class="btn lg block gray" style="cursor:default">点击选项即可判定 · 四选一</div>';
      } else {
        var ilast = ii >= iitems.length - 1;
        inner = (ii > 0 ? '<button class="btn lg ghost" data-act="i-prev">上一个</button>' : '') +
          '<button class="btn lg grow" data-act="i-next">' + ((ilast && S.iMode === 'rw') ? '复习完成 →' : (ilast ? '完成，看总结 →' : '下一个 →')) + '</button>';
      }
    } else if (S.view === 'calc') {
      var cit = calcCur(); if (!cit) return;
      var citems = cit.items || [], ci = S.idx;
      if (!citems[ci]) return;
      if (!S.judged) {
        inner = '<div class="btn lg block gray" style="cursor:default">点击选项即可判定 · 单选</div>';
      } else {
        var clast = ci >= citems.length - 1;
        inner = (ci > 0 ? '<button class="btn lg ghost" data-act="c-prev">上一题</button>' : '') +
          '<button class="btn lg grow" data-act="c-next">' + (clast ? '完成，看总结 →' : '下一题 →') + '</button>';
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
      '<div class="between" style="margin-bottom:6px"><span class="tag">' + fmtDate(vDateOf(S.batch)) + ' · 第 ' + w.n + ' 词</span>' +
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

    appEl.innerHTML = '<div class="topbar"><button class="iconbtn" data-act="open-day">‹</button>' +
      '<span class="grow small muted">' + fmtDate(vDateOf(S.batch)) + ' · ' + total + ' 词</span></div>' +
      '<div class="card"><div class="score">' +
      '<div class="ring" style="background:conic-gradient(' + color + ' ' + deg + 'deg,#e9edf7 ' + deg + 'deg)">' +
      '<div class="inner"><b>' + pct + '%</b><span>认识率</span></div></div>' +
      '<div class="verdict">' + (pct >= 80 ? '这天很稳，明天快速过一遍就行' : pct >= 50 ? '一半以上有印象，模糊词多滚两轮' : '生词偏多，建议今天就再刷一遍这天的词') + '</div>' +
      '<div class="small muted">认识 ' + known + ' · 模糊 ' + fuzzy + ' · 不认识 ' + no + '</div></div></div>' +
      '<div class="card"><div class="block-title">📋 这天词表</div>' + list + '</div>' +
      '<div class="row" style="gap:10px;margin-bottom:20px">' +
      '<button class="btn ghost grow" data-act="redo-batch">重背这 50 词</button>' +
      '<button class="btn grow" data-act="learn-next">下一天 →</button></div>';
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
        '<button class="btn grow" data-act="go-gate">登录 / 注册（同步本机数据）</button>' +
        '<button class="btn ghost" data-act="wipe-local">清除本机数据</button></div></div>' +
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
      '<div class="wrow"><b>错题本</b><span class="small muted">在册 ' + wAll().length + ' 道 · 已毕业 ' + (wrong.grad || 0) + ' 道</span></div>' +
      '<div class="wrow"><b>错词本</b><span class="small muted">在册 ' + iAll().length + ' 个 · 已毕业 ' + (iwrong.grad || 0) + ' 个</span></div>' +
      '<div class="wrow"><b>模考</b><span class="small muted">考过 ' + examRecs().length + ' 次</span></div>' +
      '<div class="small muted" style="margin-top:10px">这些数据每次改动会自动上传（约 2 秒后），登录其他设备时自动合并 —— 两边都改也不会互相盖掉，按条目取新的那一份。</div></div>' +
      '<div class="card"><div class="block-title">💾 备份（保险用）</div>' +
      '<div class="small muted">云端同步是"实时互备"，但它依赖第三方免费存储。留一份本地文件更稳：换设备、清缓存、将来换后端都能导回来。</div>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn grow" data-act="bk-export">⬇️ 导出备份</button>' +
      '<button class="btn ghost grow" data-act="bk-import">⬆️ 导入备份</button></div>' +
      '<input id="bkpfile" type="file" accept=".json,application/json" style="display:none">' +
      '<div class="small muted" style="margin-top:10px">导入是<b>合并</b>（不会清掉现在的东西），不是覆盖。</div></div>' +
      '<div class="card small muted">⚠️ 再提醒一次：密码在浏览器里校验、数据存在免费公开存储上，属于「够用级的门」。别用其他账号的密码，别放敏感内容。</div>' +
      '<div class="row" style="gap:10px;margin-bottom:24px">' +
      '<button class="btn ghost grow" data-act="logout">退出登录</button>' +
      '<button class="btn ghost grow danger" data-act="wipe-local">清除本机数据</button></div>';
    dropFooter();
  }


  function render() {
    if (!PID) { renderGate(); window.scrollTo(0, 0); return; }
    if (S.view !== 'news' && NSP && NSP.on) nsStop('已停止朗读');
    if (S.view === 'home') { dropFooter(); renderHome(); }
    else if (S.view === 'quiz') renderQuiz();
    else if (S.view === 'idiom') renderIdiom();
    else if (S.view === 'iwrong') { dropFooter(); iWrongHome(); }
    else if (S.view === 'idiomdone') { dropFooter(); renderIdiomDone(); }
    else if (S.view === 'calc') renderCalc();
    else if (S.view === 'calcdone') { dropFooter(); renderCalcDone(); }
    else if (S.view === 'result') renderResult();
    else if (S.view === 'learn') renderLearn();
    else if (S.view === 'batchdone') renderBatchDone();
    else if (S.view === 'review') renderReview();
    else if (S.view === 'revdone') renderReviewDone();
    else if (S.view === 'sync') renderSync();
    else if (S.view === 'stat') renderStats();
    else if (S.view === 'day') renderDay();
    else if (S.view === 'read') renderRead();
    else if (S.view === 'wrong') renderWrongHome();
    else if (S.view === 'wredo') renderWrongQ();
    else if (S.view === 'exam') renderExamHome();
    else if (S.view === 'examq') renderExamQ();
    else if (S.view === 'examdone') renderExamDone();
    else if (S.view === 'wkhome') { dropFooter(); renderWeekendHome(); }
    else if (S.view === 'wkq') renderWeekendQ();
    else if (S.view === 'wkdone') { dropFooter(); renderWeekendDone(); }
    else if (S.view === 'dict') renderDict();
    else if (S.view === 'dictdone') renderDictDone();
    else if (S.view === 'drill') renderDrill();
    else if (S.view === 'diaryday') renderDiaryDayView();
    else if (S.view === 'news') renderNewsDetail();
    else { dropFooter(); renderHome(); }
    window.scrollTo(0, 0);
  }

  function hashOf() {
    if (S.view === 'quiz') return '#/q/' + S.issueId + '/' + (S.idx + 1);
    if (S.view === 'idiom') {
      if (S.iMode === 'rw') return '#/iw';
      if (S.iMix && S.iMix.length) return '#/i/' + S.idioId;   /* 混入了错词时队列和期号错位，不给深链定位 */
      return '#/i/' + S.idioId + '/' + (S.idx + 1);
    }
    if (S.view === 'iwrong') return '#/iw';
    if (S.view === 'idiomdone') return '#/i/' + S.idioId;
    if (S.view === 'calcdone') return '#/c/' + S.calcId;
    if (S.view === 'calc') return '#/c/' + S.calcId + '/' + (S.idx + 1);
    if (S.view === 'home' && S.subject === 'idiom') return '#/i';
    if (S.view === 'home' && S.subject === 'calc') return '#/c';
    if (S.view === 'result') return '#/r/' + S.issueId;
    if (S.view === 'learn') return '#/v/b/' + S.batch;
    if (S.view === 'batchdone') return '#/v/b/' + S.batch + '/done';
    if (S.view === 'review' || S.view === 'revdone') return '#/v/rev';
    if (S.view === 'day') return '#/v/day/' + S.batch;
    if (S.view === 'read') return '#/v/read/' + S.batch;
    if (S.view === 'dict') return '#/v/dict/' + S.batch;
    if (S.view === 'wrong' || S.view === 'wredo') return '#/wrong';
    if (S.view === 'exam' || S.view === 'examq' || S.view === 'examdone') return '#/exam';
    if (S.view === 'wkhome') return '#/wk';
    if (S.view === 'wkq') return '#/wk/' + S.wkId + '/' + (S.wkI + 1);
    if (S.view === 'wkdone') return '#/wk/' + S.wkId;
    if (S.view === 'drill') return '#/w';
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
    if (NSP && NSP.on) nsStop('已停止朗读');
    NSP.resume = undefined;
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
  function goDay(b) {
    S.subject = 'vocab'; S.view = 'day'; S.batch = b; dropFooter(); syncHash(); render();
  }
  function goRead(b) {
    S.subject = 'vocab'; S.view = 'read'; S.batch = b; dropFooter(); syncHash(); render();
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
    } else if (parts[0] === 'i') {
      S.iMode = 'set'; S.iMix = null; S.iList = null;
      if (parts[1]) {
        var iid = parseInt(parts[1], 10);
        if (setOf(IDIOMS, iid)) {
          var iit = setOf(IDIOMS, iid);
          S.subject = 'idiom'; S.view = 'idiom'; S.idioId = iid;
          S.idx = Math.min(Math.max(parts[2] ? parseInt(parts[2], 10) - 1 : 0, 0), (iit.items || []).length - 1);
          S.picked = []; S.judged = false; return;
        }
      }
      S.subject = 'idiom'; S.view = 'home'; return;
    } else if (parts[0] === 'iw') {
      S.subject = 'idiom'; S.view = 'iwrong'; S.iMode = 'set'; S.iMix = null; S.iList = null; return;
    } else if (parts[0] === 'c') {
      if (parts[1]) {
        var cid = parseInt(parts[1], 10);
        if (setOf(CALCS, cid)) {
          var cit = setOf(CALCS, cid);
          S.subject = 'calc'; S.view = 'calc'; S.calcId = cid;
          S.idx = Math.min(Math.max(parts[2] ? parseInt(parts[2], 10) - 1 : 0, 0), (cit.items || []).length - 1);
          S.picked = []; S.judged = false; return;
        }
      }
      S.subject = 'calc'; S.view = 'home'; return;
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
    } else if (parts[0] === 'wk') {
      S.subject = 'quiz';
      var wid = parts[1] ? parseInt(parts[1], 10) : 0, wobj = wid ? weekOf(wid) : null;
      if (wobj) {
        S.wkId = wid;
        if (wkProg(wid).done) { S.view = 'wkdone'; S.wkI = 0; return; }
        S.view = 'wkq';
        S.wkI = parts[2] ? Math.min(Math.max(parseInt(parts[2], 10) - 1, 0), wkAll(wobj).length - 1) : wkFirstOpen(wobj, wkProg(wid));
        return;
      }
      S.view = 'wkhome'; S.wkId = null; return;
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
      if (parts[1] === 'day' && parts[2]) {
        var bd = parseInt(parts[2], 10);
        S.subject = 'vocab';
        S.batch = (bd >= 1 && bd <= batchCount()) ? bd : 1;
        S.view = 'day';
        return;
      }
      if (parts[1] === 'read' && parts[2]) {
        var br = parseInt(parts[2], 10);
        S.subject = 'vocab';
        S.batch = (br >= 1 && br <= batchCount()) ? br : 1;
        S.view = 'read';
        return;
      }
      if (parts[1] === 'dict' && parts[2]) {
        var bd2 = parseInt(parts[2], 10);
        S.subject = 'vocab';
        S.batch = (bd2 >= 1 && bd2 <= batchCount()) ? bd2 : 1;
        dictStart(S.batch);
        return;
      }
    } else if (parts[0] === 'wrong') {
      S.subject = 'quiz'; S.view = 'wrong'; S.wList = null; return;
    } else if (parts[0] === 'exam') {
      S.subject = 'quiz'; S.view = 'exam'; S.ex = null; return;
    } else if (parts[0] === 'w') {
      S.subject = 'gold'; S.view = 'drill'; S.drillDs = parts[1] || ymd(); return;
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
    wMark(it.issue, S.idx, ok);   /* 答错自动进错题本；答对则推进回收计时 */
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

  function addWord(w) {
    if (!w) return;
    var k = String(w).toLowerCase();
    if ((vstore.w[k] || 0) >= 1) { toast(w + ' 已经在背了'); return; }
    setLvl(w, 0);
    toast('已加入生词本：' + w);
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
    var t = e.target.closest('[data-cd],[data-issue],[data-idiom],[data-calc],[data-iopt],[data-copt],[data-batch],[data-dayno],[data-copy],[data-say],[data-opt],[data-ropt],[data-pid],[data-mark],[data-act],[data-news],[data-sl],[data-gcat],[data-day],[data-wopt],[data-eopt],[data-hit],[data-addw],[data-exrec],[data-nsjump],[data-nsrate],[data-navox],[data-wk],[data-wkopt],[data-wkpt]');
    if (!t) return;

    if (t.hasAttribute('data-nsjump')) { NSP.resume = undefined; return nsPlay(parseInt(t.getAttribute('data-nsjump'), 10)); }
    if (t.hasAttribute('data-navox')) return naVox(t.getAttribute('data-navox'));
    if (t.hasAttribute('data-nsrate')) return nsRate(parseFloat(t.getAttribute('data-nsrate')));

    if (t.hasAttribute('data-cd')) return editCd(t.getAttribute('data-cd'));
    if (t.hasAttribute('data-say')) return speak(t.getAttribute('data-say'));
    if (t.hasAttribute('data-copy')) return copyQuote(t.getAttribute('data-copy'));
    if (t.hasAttribute('data-dayno')) return goDay(parseInt(t.getAttribute('data-dayno'), 10));

    if (t.hasAttribute('data-day')) { S.view = 'diaryday'; S.subject = 'diary'; S.diaryDate = t.getAttribute('data-day'); syncHash(); return render(); }

    if (t.hasAttribute('data-gcat')) { S.subject = 'gold'; S.goldCat = t.getAttribute('data-gcat'); return renderHome(); }
    if (t.hasAttribute('data-news')) return goNews(parseInt(t.getAttribute('data-news'), 10));
    if (t.hasAttribute('data-sl')) {
      var sp = t.getAttribute('data-sl').split('-');
      return copySl(parseInt(sp[0], 10), parseInt(sp[1], 10));
    }
    if (t.hasAttribute('data-issue')) return goQuiz(parseInt(t.getAttribute('data-issue'), 10), 0);
    if (t.hasAttribute('data-idiom')) return goIdiom(parseInt(t.getAttribute('data-idiom'), 10), 0);
    if (t.hasAttribute('data-calc')) return goCalc(parseInt(t.getAttribute('data-calc'), 10), 0);
    if (t.hasAttribute('data-iopt')) return iPick(t.getAttribute('data-iopt'));
    if (t.hasAttribute('data-copt')) return cPick(t.getAttribute('data-copt'));
    if (t.hasAttribute('data-mark')) return markWord(parseInt(t.getAttribute('data-mark'), 10));
    if (t.hasAttribute('data-batch')) return goLearn(parseInt(t.getAttribute('data-batch'), 10), parseInt(t.getAttribute('data-wi') || '0', 10));
    if (t.hasAttribute('data-opt')) return pickOpt(t.getAttribute('data-opt'));
    if (t.hasAttribute('data-ropt')) return answerReview(t.getAttribute('data-ropt'));
    if (t.hasAttribute('data-pid')) return enter(t.getAttribute('data-pid'));
    if (t.hasAttribute('data-wopt')) return wPick(t.getAttribute('data-wopt'));
    if (t.hasAttribute('data-eopt')) return exPick(t.getAttribute('data-eopt'));
    if (t.hasAttribute('data-wk')) return goWkEnter(parseInt(t.getAttribute('data-wk'), 10));
    if (t.hasAttribute('data-wkopt')) return wkPick(t.getAttribute('data-wkopt'));
    if (t.hasAttribute('data-wkpt')) {
      var wp = t.getAttribute('data-wkpt').split('-');
      return wkSelf(parseInt(wp[0], 10), parseInt(wp[1], 10));
    }
    if (t.hasAttribute('data-hit')) return drillHit(parseInt(t.getAttribute('data-hit'), 10));
    if (t.hasAttribute('data-addw')) return addWord(t.getAttribute('data-addw'));
    if (t.hasAttribute('data-exrec')) return (function () { S.exResult = exam.e[t.getAttribute('data-exrec')] || null; S.view = 'examdone'; syncHash(); render(); })();

    var act = t.getAttribute('data-act');
    if (!act) return;

    if (act === 'wrong') { S.view = 'wrong'; syncHash(); return render(); }
    if (act === 'w-start') return wStart();
    if (act === 'w-back') { S.view = 'wrong'; S.wList = null; syncHash(); return render(); }
    if (act === 'w-judge') return wJudgeNow();
    if (act === 'w-next') return wNext();
    if (act === 'exam') { S.view = 'exam'; syncHash(); return render(); }
    if (act === 'ex-start') return examStart(t.getAttribute('data-mode'));
    if (act === 'ex-prev') return exNav(-1);
    if (act === 'ex-next') return exNav(1);
    if (act === 'ex-quit') return exQuit();
    if (act === 'wk') return goWeekend();
    if (act === 'wk-back') { S.view = 'wkhome'; S.wkId = null; S.wkI = 0; syncHash(); return render(); }
    if (act === 'wk-prev') return wkNav(-1);
    if (act === 'wk-next') {
      var wk1 = weekOf(S.wkId);
      if (wk1 && S.wkI + 1 >= wkAll(wk1).length) return wkSubmit();
      return wkNav(1);
    }
    if (act === 'wk-submit') return wkSubmit();
    if (act === 'wk-write') return wkWrite();
    if (act === 'wk-redo') return wkRedo();
    if (act === 'dict-start') return dictStart(S.batch);
    if (act === 'dict-say') { if (S.dict) speak(S.dict.list[S.dict.i].w); return; }
    if (act === 'dict-check') return dictCheck();
    if (act === 'dict-next') return dictNext();
    if (act === 'dict-again') return dictStart(S.batch);
    if (act === 'dict-exit') { S.dict = null; S.view = 'day'; syncHash(); return render(); }
    if (act === 'drill') { S.view = 'drill'; S.drillDs = S.drillDs || ymd(); syncHash(); return render(); }
    if (act === 'drill-save') return drillSave();
    if (act === 'drill-key') { S.drillOpen = !S.drillOpen; return render(); }
    if (act === 'drill-del') { drill.d[S.drillDs || ymd()] = { t: '', u: Date.now() }; saveDrill(); toast('已清空'); return render(); }
    if (act === 'bk-export') return backupExport();
    if (act === 'bk-import') return backupPick();
    if (act === 'home') return goHome();
    if (act === 'submit') return judge();
    if (act === 'prev') { if (S.idx > 0) { S.idx--; S.picked = []; S.judged = false; render(); } return; }
    if (act === 'next') { if (S.idx < (currentIssue().items || []).length - 1) { S.idx++; S.picked = []; S.judged = false; render(); } return; }
    if (act === 'result') return goResult();
    if (act === 'retry') {
      resetProg(progOf(S.issueId)); saveStore();
      goQuiz(S.issueId, 0); toast('已重置，重新开始'); return;
    }
    if (act === 'tab-quiz') { S.subject = 'quiz'; return renderHome(); }
    if (act === 'tab-idiom') { S.subject = 'idiom'; S.view = 'home'; S.iMode = 'set'; S.iMix = null; S.iList = null; syncHash(); return render(); }
    if (act === 'iwrong') { S.subject = 'idiom'; S.view = 'iwrong'; S.iMode = 'set'; S.iMix = null; syncHash(); return render(); }
    if (act === 'iw-back') { S.subject = 'idiom'; S.view = 'home'; S.iMode = 'set'; S.iMix = null; S.iList = null; syncHash(); return render(); }
    if (act === 'iw-start') return iwsStart();
    if (act === 'tab-calc') { S.subject = 'calc'; S.view = 'home'; syncHash(); return render(); }
    if (act === 'i-next') return setStep('i', 1);
    if (act === 'i-prev') return setStep('i', -1);
    if (act === 'c-next') return setStep('c', 1);
    if (act === 'c-prev') return setStep('c', -1);
    if (act === 'i-retry') return setRetry('i');
    if (act === 'c-retry') return setRetry('c');
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
    if (act === 'ns-play') return nsToggle();
    if (act === 'ns-stop') { var nit = newsById(S.newsId); return nsStop(nit ? nsIntro(nit) : '已停止'); }
    if (act === 'ns-anchor') return nsAnchorToggle();
    if (act === 'ns-vox-preview') { if (NSP.on) nsStop(); return nsSay((NSP.anchor ? '各位听众朋友，' : '嗨，') + '这里是每日新闻精读，本期为您带来三条要闻。'); }
    if (act === 'learn-next') return goDay(Math.min(batchCount(), nextBatch()));
    if (act === 'learn-day') return goLearn(S.batch, 0);
    if (act === 'open-day') return goDay(S.batch);
    if (act === 'open-read') return goRead(S.batch);
    if (act === 'open-read-next') return goRead(Math.min(batchCount(), S.batch + 1));
    if (act === 'read-today') {
      var tb = 0, td = ymd();
      for (var qb = 1; qb <= batchCount(); qb++) if (vDateOf(qb) === td) tb = qb;
      return tb ? goRead(tb) : goDay(nextBatch());
    }
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
    if (act === 'wipe-local') return wipeLocal();
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
    if (e.target && e.target.id === 'drtext') {
      var c2 = document.getElementById('drcnt');
      if (c2) c2.textContent = e.target.value.replace(/\s/g, '').length + ' 字';
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'nsvox') { nsSetVox(e.target.value); return; }
    if (!e.target || e.target.id !== 'bkpfile') return;
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { backupImport(String(rd.result || '')); };
    rd.onerror = function () { toast('读文件失败'); };
    rd.readAsText(f);
  });

  document.addEventListener('keydown', function (e) {
    if (S.view === 'diaryday' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); return diarySave(); }
    if (S.view === 'drill' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); return drillSave(); }
    if (S.view === 'dict' && e.key === 'Enter') {
      e.preventDefault();
      var dd = S.dict;
      if (dd && dd.just) return dictNext();
      return dictCheck();
    }
    if (!PID) {
      if (e.key === 'Enter') {
        var el = document.getElementById('accpwd') || document.getElementById('accid');
        if (el === document.activeElement) { if (GATE.mode === 'register') doRegister(); else doLogin(); }
      }
      return;
    }
    if (S.view === 'idiom') {
      var ic = iCurItem(); if (!ic) return;
      var sn = parseInt(e.key, 10);
      if (!S.judged && sn >= 1 && sn <= (ic.item.options || []).length) return iPick(LETTERS[sn - 1]);
      if (e.key === 'Enter' && S.judged) return setStep('i', 1);
      if (e.key === 'ArrowLeft' && S.idx > 0) return setStep('i', -1);
      if (e.key === 'ArrowRight' && S.judged) return setStep('i', 1);
      return;
    }
    if (S.view === 'calc') {
      var cit0 = calcCur(); var sitem = (cit0 && cit0.items) ? cit0.items[S.idx] : null; if (!sitem) return;
      var sn2 = parseInt(e.key, 10);
      if (!S.judged && sn2 >= 1 && sn2 <= (sitem.options || []).length) return cPick(LETTERS[sn2 - 1]);
      if (e.key === 'Enter' && S.judged) return setStep('c', 1);
      if (e.key === 'ArrowLeft' && S.idx > 0) return setStep('c', -1);
      if (e.key === 'ArrowRight' && S.judged) return setStep('c', 1);
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
    if (S.view === 'wredo') {
      var wx = (S.wList || [])[S.wIdx]; if (!wx) return;
      var wn = parseInt(e.key, 10);
      if (!S.wJudged && wn >= 1 && wn <= (wx.item.q.options || []).length) return wPick(LETTERS[wn - 1]);
      if (e.key === 'Enter') {
        if (!S.wJudged && wx.item.q.type === 'multi') return wJudgeNow();
        if (S.wJudged) return wNext();
      }
      return;
    }
    if (S.view === 'wkq') {
      var wkw = weekOf(S.wkId); if (!wkw) return;
      var wki = wkItemAt(wkw, S.wkI); if (!wki) return;
      var kkn = parseInt(e.key, 10);
      if (wkIsXz(wkw, S.wkI) && kkn >= 1 && kkn <= (wki.options || []).length) return wkPick(LETTERS[kkn - 1]);
      if (e.key === 'ArrowLeft') return wkNav(-1);
      if (e.key === 'ArrowRight') return wkNav(1);
      return;
    }
    if (S.view === 'examq') {
      var ex = S.ex; if (!ex) return;
      var cur = ex.list[ex.i];
      var en = parseInt(e.key, 10);
      if (en >= 1 && en <= (cur.item.q.options || []).length) return exPick(LETTERS[en - 1]);
      if (e.key === 'ArrowLeft') return exNav(-1);
      if (e.key === 'ArrowRight') return exNav(1);
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

  /* ================= 词语速记（成语 · 四字词语） =================
     玩法：给一个词语 → 从四个释义里挑对的那个 → 判定后立刻出例句 + 出处 + 易错点，加深理解。
     数据：kaogong/data/idiom-NNN.json（跟考公同频：一天两期，一期 10 个词语） */
  var IDIOMS = (window.KG_IDIOMS || []).slice().sort(function (a, b) { return b.set - a.set; });
  /* ================= 速算训练（资料分析速算） =================
     玩法：出题（纯计算 / 资料分析应用）→ 四个选项选答案 → 判定后给解析 + 计算方法 + 易错点 + 难点。
     数据：kaogong/data/calc-NNN.json（一天一批，一批 20 题） */
  var CALCS = (window.KG_CALC || []).slice().sort(function (a, b) { return b.set - a.set; });
  /* 周末测试：一周一张卷（行测客观 + 申论主观），做题不给答案，交卷才出答案/踩分点/技巧 */
  var WEEKS = (window.KG_WEEKEND || []).slice().sort(function (a, b) { return b.id - a.id; });
  function setOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i].set === id) return list[i]; return null; }
  function idiomCur() { return setOf(IDIOMS, S.idioId); }
  function calcCur() { return setOf(CALCS, S.calcId); }
  function iProg(id) { if (!istore.p[id]) istore.p[id] = { ans: {}, updated: Date.now() }; return istore.p[id]; }
  function cProg(id) { if (!cstore.p[id]) cstore.p[id] = { ans: {}, updated: Date.now() }; return cstore.p[id]; }
  function setStat(p, n) {
    var dn = 0, rt = 0;
    for (var i = 0; i < n; i++) { var a = p.ans[i]; if (a) { dn++; if (a.ok) rt++; } }
    return { dn: dn, rt: rt, pct: n ? Math.round(dn / n * 100) : 0 };
  }
  function oneRight(ansArr, picked) {
    var a = (ansArr || []).slice().sort().join(''), p = (picked || []).slice().sort().join('');
    return a === p && p.length > 0;
  }

  /* ================= 错词本（成语/四字词语）· 答错自动收 · 隔 3/7 天回收 · 连对两次毕业 =================
     规则跟考公错题本一致，只是键是「期号|题号」：
       答错 → 立刻进错词本，3 天后回来复习
       复习答对 → 7 天后再来一次
       连对两次 → 毕业（移出错词本）
     复习入口有两处：① 错词本页手动刷；② 每次开始背某一期时，自动在前面「热身混入」最多 3 个到期错词。 */
  function ikey(s, x) { return s + '|' + x; }
  function iEntry(s, x) { return iwrong.w[ikey(s, x)] || null; }
  function iInt(e) { return ((e && e.ok) >= 1) ? 7 * DAY : 3 * DAY; }
  function iDueAt(e) { return (e.u || e.d || 0) + iInt(e); }
  function iIsDue(e, now) { return (!e.gone) && iDueAt(e) <= (now || Date.now()); }
  function iMark(s, x, ok) {
    var k = ikey(s, x), e = iwrong.w[k], now = Date.now();
    if (!ok) {
      iwrong.w[k] = { n: (((e && !e.gone) ? e.n : 0) || 0) + 1, ok: 0, d: (e && e.d) || now, u: now };
      saveIWrong(); return;
    }
    if (!e || e.gone) return;
    var nok = (e.ok || 0) + 1;
    if (nok >= 2) { iwrong.w[k] = { gone: 1, u: now }; iwrong.grad = (iwrong.grad || 0) + 1; }
    else iwrong.w[k] = { n: e.n || 1, ok: nok, d: e.d || now, u: now };
    saveIWrong();
  }
  function iAll() {
    var out = [];
    Object.keys(iwrong.w).forEach(function (k) {
      var e = iwrong.w[k]; if (!e || e.gone) return;
      var p = k.split('|');
      out.push({ set: parseInt(p[0], 10), idx: parseInt(p[1], 10), e: e });
    });
    out.sort(function (a, b) { return iDueAt(a.e) - iDueAt(b.e); });
    return out;
  }
  function iDue() { var n = Date.now(); return iAll().filter(function (x) { return iIsDue(x.e, n); }); }
  function iItemOf(x) {
    var it = setOf(IDIOMS, x.set); if (!it) return null;
    var item = (it.items || [])[x.idx];
    return item ? { set: x.set, idx: x.idx, item: item } : null;
  }
  function iDaysTxt(e) {
    if (!e) return '';
    var n = Math.round((iDueAt(e) - Date.now()) / DAY);
    if (n > 0) return n + ' 天后回来';
    if (n === 0) return '今天该复习';
    return '已到期 ' + (-n) + ' 天';
  }
  /* 当前批次的出题队列：普通背词 = [混入的错词…] + 本期全部词语；错词复习 = 到期错词 */
  function iEnt(set, idx, rev) { return { set: set, idx: idx, rev: !!rev }; }
  function idiomQueue() {
    if (S.iMode === 'rw') return (S.iList || []).slice();
    var it = idiomCur(); if (!it) return [];
    var base = (it.items || []).map(function (_, i) { return iEnt(it.set, i, false); });
    return (S.iMix || []).concat(base);
  }
  function iCurEnt() { return idiomQueue()[S.idx] || null; }
  function iCurItem() {
    var e = iCurEnt(); if (!e) return null;
    var it = setOf(IDIOMS, e.set); if (!it) return null;
    var item = (it.items || [])[e.idx];
    return item ? { ent: e, item: item, set: it } : null;
  }
  /* 开始背某期时，把到期的错词混 3 个到最前面（不重复放本期的词） */
  function iMixPick(setId, cap) {
    var out = [], n = Date.now();
    iAll().forEach(function (x) {
      if (out.length >= (cap || 3)) return;
      if (x.set === setId) return;
      if (!iIsDue(x.e, n)) return;
      var it = setOf(IDIOMS, x.set);              /* 源词若已不存在就跳过，别把坏条目混进来 */
      if (!it || !(it.items || [])[x.idx]) return;
      out.push(iEnt(x.set, x.idx, true));
    });
    return out;
  }
  function iwsStart(list) {
    var src = list || iDue();
    var q = src.map(function (x) { return iEnt(x.set, x.idx, true); }).filter(function (e) { var it = setOf(IDIOMS, e.set); return it && (it.items || [])[e.idx]; });
    if (!q.length) { toast('现在没有到期的错词'); return; }
    S.subject = 'idiom'; S.iMode = 'rw'; S.iList = q; S.iMix = null; S.idx = 0;
    S.view = 'idiom'; S.picked = []; S.judged = false; syncHash(); render();
  }
  function iWrongHome() {
    var all = iAll(), due = iDue(), nxt = null;
    all.forEach(function (x) { if (!nxt && !iIsDue(x.e)) nxt = x; });
    var list = all.map(function (x) {
      var it = iItemOf(x); if (!it) return '';
      var o = (it.item.options || [])[LETTERS.indexOf((it.item.answer || ['A'])[0])] || '';
      return '<div class="wq"><div class="wqhead"><span class="tag gray">第 ' + x.set + ' 期 · 第 ' + (x.idx + 1) + ' 个</span>' +
        '<span class="tag ' + (iIsDue(x.e) ? 'warn2' : 'gray') + '">' + iDaysTxt(x.e) + '</span></div>' +
        '<div style="font-size:18px;font-weight:700;letter-spacing:1px">' + h(it.item.w || '') + '</div>' +
        '<div class="small muted">' + h(String(o).slice(0, 30)) + (String(o).length > 30 ? '…' : '') + '</div>' +
        '<div class="small muted">错过 ' + (x.e.n || 1) + ' 次' + (x.e.ok ? ' · 已连对 ' + x.e.ok + ' 次' : '') + '</div></div>';
    }).join('');
    appEl.innerHTML = '<div class="topbar solid"><button class="iconbtn" data-act="iw-back">‹</button>' +
      '<span class="grow small"><b>🧯 错词本</b><div class="muted" style="font-size:12px">答错自动收 · 隔 3 / 7 天回来复习</div></span></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + due.length + '</b><span>今天该复习</span></div>' +
      '<div class="stat"><b>' + all.length + '</b><span>在错词本里</span></div>' +
      '<div class="stat"><b>' + (iwrong.grad || 0) + '</b><span>已毕业</span></div></div>' +
      '<div class="card small muted">规则：答错 → 立刻进错词本；<b>隔 3 天</b>回来复习；答对后<b>隔 7 天</b>再看一次；<b>连对两次</b>才算毕业（移出去）。中途再错就重新计时。开始背某一期时，到期的错词会<b>自动混到最前面</b>热身。</div>' +
      (due.length ? '<button class="btn grow" data-act="iw-start" style="margin-bottom:12px">开始复习（' + due.length + ' 个）</button>'
        : '<div class="card center muted">今天没有到期的错词 🎉 ' + (nxt ? '下一批 ' + iDaysTxt(nxt.e) : '（错词本是空的）') + '</div>') +
      (list ? '<div class="block-title">错词清单（' + all.length + '）</div>' + list : '') +
      '<div style="height:20px"></div>';
    dropFooter();
  }
  function iBackfill() {
    var changed = false, now = Date.now();
    IDIOMS.forEach(function (it) {
      var p = istore.p[it.set]; if (!p) return;
      Object.keys(p.ans || {}).forEach(function (k) {
        var a = p.ans[k];
        if (!a || a.ok !== false) return;
        var kk = ikey(it.set, parseInt(k, 10));
        if (!iwrong.w[kk]) { iwrong.w[kk] = { n: 1, ok: 0, d: a.ts || now, u: a.ts || now, bf: 1 }; changed = true; }
      });
    });
    if (changed) saveIWrong();
  }
  function setListCards(list, attr, unit) {
    if (!list.length) return '<div class="card center muted">还没有内容，等下次推送后刷新本页～</div>';
    return list.map(function (it) {
      var p = (attr === 'data-idiom') ? iProg(it.set) : cProg(it.set);
      var n = (it.items || []).length, st = setStat(p, n);
      var badge = st.dn >= n ? '<span class="tag ok">已完成 ' + st.rt + '/' + n + '</span>'
        : (st.dn ? '<span class="tag">继续 ' + st.dn + '/' + n + '</span>' : '<span class="tag gray">未开始</span>');
      return '<button class="issue" ' + attr + '="' + it.set + '">' +
        '<span class="idx">第<br>' + it.set + '期</span>' +
        '<span class="meta"><h3>' + fmtDate(it.date) + ' · ' + (it.session === 'pm' ? '晚间' : (it.session === 'day' ? '' : '早间')) + '</h3>' +
        '<p>' + h(it.title || '') + '</p>' +
        '<span class="bar"><i style="width:' + st.pct + '%"></i></span></span>' +
        '<span class="side">' + badge + '<div class="small muted" style="margin-top:6px">' + n + ' ' + unit + '</div></span>' +
        '</button>';
    }).join('');
  }
  function renderIdiomHome() {
    var total = 0, done = 0, rt = 0;
    IDIOMS.forEach(function (it) {
      var p = iProg(it.set);
      (it.items || []).forEach(function (_, i) { total++; var a = p.ans[i]; if (a) { done++; if (a.ok) rt++; } });
    });
    var rate = done ? Math.round(rt / done * 100) : 0;
    var iDueN = iDue().length, iAllN = iAll().length;
    return '<div class="stats">' +
      '<div class="stat"><b>' + IDIOMS.length + '</b><span>已更新期数</span></div>' +
      '<div class="stat"><b>' + done + '/' + total + '</b><span>已背词语</span></div>' +
      '<div class="stat"><b>' + rate + '%</b><span>正确率</span></div></div>' +
      (iDueN
        ? '<button class="btn grow" data-act="iw-start" style="margin-bottom:8px">🔁 错词复习（' + iDueN + ' 个到期）</button>'
        : (iAllN ? '<div class="card small muted" style="text-align:center">错词本在册 ' + iAllN + ' 个，暂时没有到期的 · 下一批过几天来</div>' : '')) +
      '<button class="statentry" data-act="iwrong">🧯 错词本（在册 ' + iAllN + ' · 已毕业 ' + (iwrong.grad || 0) + '）</button>' +
      '<div class="row between" style="margin:10px 4px 10px"><span class="small muted">往期内容</span>' +
      '<span class="small muted">点卡片开始背词（到期错词会自动混进来）</span></div>' +
      setListCards(IDIOMS, 'data-idiom', '个词语') +
      '<div class="card small muted" style="text-align:center">词语速记每天两期：早上 8:00 · 晚上 8:00 各 10 个词语（成语 / 四字词语）<br>背错的词自动进「错词本」，隔 3 / 7 天回来复习，连对两次毕业</div>';
  }
  function renderCalcHome() {
    var total = 0, done = 0, rt = 0;
    CALCS.forEach(function (it) {
      var p = cProg(it.set);
      (it.items || []).forEach(function (_, i) { total++; var a = p.ans[i]; if (a) { done++; if (a.ok) rt++; } });
    });
    var rate = done ? Math.round(rt / done * 100) : 0;
    return '<div class="stats">' +
      '<div class="stat"><b>' + CALCS.length + '</b><span>已更新批数</span></div>' +
      '<div class="stat"><b>' + done + '/' + total + '</b><span>已练题数</span></div>' +
      '<div class="stat"><b>' + rate + '%</b><span>正确率</span></div></div>' +
      '<div class="card small muted">资料分析常用的估算 / 直除 / 增长率换算都在这里：纯计算题练手感，应用题按材料算结果。</div>' +
      '<div class="row between" style="margin:10px 4px 10px"><span class="small muted">往期内容</span>' +
      '<span class="small muted">点卡片开始刷题</span></div>' +
      setListCards(CALCS, 'data-calc', '题') +
      '<div class="card small muted" style="text-align:center">速算训练一天一批：每批 20 题（纯计算 + 资料分析应用）</div>';
  }
  function renderIdiomDone() {
    var it = idiomCur(); if (!it) return goHome();
    var p = iProg(it.set), n = (it.items || []).length, st = setStat(p, n);
    var ws = (it.items || []).map(function (x, i) { return (p.ans[i] && !p.ans[i].ok) ? x.w : null; }).filter(Boolean);
    appEl.innerHTML = '<div class="card center"><div class="bigpct">' + (st.dn ? Math.round(st.rt / st.dn * 100) : 0) + '%</div>' +
      '<div class="muted">第 ' + it.set + ' 期 · 答对 ' + st.rt + ' / ' + st.dn + ' 个词语</div></div>' +
      '<div class="card"><div class="block-title">📌 没记住的词语</div>' +
      (ws.length ? '<div class="tips">' + ws.map(function (w) { return h(w); }).join('　·　') + '</div><div class="small muted" style="margin-top:8px">以上都自动进了「错词本」，隔 3 天会回来找你 🔁</div>' : '<div class="explain">全对，漂亮！</div>') + '</div>' +
      (iDue().length ? '<button class="btn grow" data-act="iw-start" style="margin-bottom:10px">🔁 顺手复习 ' + iDue().length + ' 个到期错词</button>' : '') +
      '<div class="row" style="gap:10px;margin-bottom:24px"><button class="btn lg ghost grow" data-act="i-retry">重背这一期</button>' +
      '<button class="btn lg grow" data-act="tab-idiom">回列表</button></div>';
  }
  function renderCalcDone() {
    var it = calcCur(); if (!it) return goHome();
    var p = cProg(it.set), n = (it.items || []).length, st = setStat(p, n);
    var ws = (it.items || []).map(function (x, i) { return (p.ans[i] && !p.ans[i].ok) ? ('第 ' + (i + 1) + ' 题') : null; }).filter(Boolean);
    appEl.innerHTML = '<div class="card center"><div class="bigpct">' + (st.dn ? Math.round(st.rt / st.dn * 100) : 0) + '%</div>' +
      '<div class="muted">第 ' + it.set + ' 批 · 答对 ' + st.rt + ' / ' + st.dn + ' 题</div></div>' +
      '<div class="card"><div class="block-title">📌 做错的题</div>' +
      (ws.length ? '<div class="tips">' + ws.join('　') + '</div>' : '<div class="explain">全对，手感不错！</div>') + '</div>' +
      '<div class="row" style="gap:10px;margin-bottom:24px"><button class="btn lg ghost grow" data-act="c-retry">重做这一批</button>' +
      '<button class="btn lg grow" data-act="tab-calc">回列表</button></div>';
  }
  /* 🔍 四个选项对比卡：每个选项对应哪个词 + 例句，方便横向对比复习 */
  function iCmpCard(item, picked) {
    var cmpArr = item.cmp || [];
    var opts = item.options || [];
    var ansKey = (item.answer || ['A'])[0];
    var rows = opts.map(function (o, k) {
      var key = LETTERS[k], isAns = (key === ansKey), mine = (picked || []).indexOf(key) >= 0;
      var c = cmpArr[k] || {};
      var word = c.self ? item.w : (c.w || '（未标注）');
      var eg = c.self ? (item.eg || '') : (c.eg || '');
      var color = isAns ? 'var(--ok)' : 'var(--err)';
      return '<div style="margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid ' +
        (isAns ? 'rgba(34,197,94,.35)' : 'rgba(148,163,184,.35)') + ';background:' +
        (isAns ? 'rgba(34,197,94,.07)' : 'rgba(148,163,184,.07)') + '">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<span class="k">' + key + '</span>' +
        '<b style="color:' + color + '">' + (isAns ? '✓ 正确' : '✗ 干扰') + '</b>' +
        '<b>' + h(word) + '</b>' +
        (c.self ? '<span class="small muted">（本题干词）</span>' : '') +
        (mine ? '<span class="tag warn2">你选的</span>' : '') + '</div>' +
        '<div class="small muted" style="margin-top:4px">释义：' + h(o) + '</div>' +
        (eg ? '<div class="small" style="margin-top:4px">例句：' + h(eg) + '</div>' : '') +
        (c.note ? '<div class="small muted" style="margin-top:4px">⚠️ ' + h(c.note) + '</div>' : '') +
        '</div>';
    }).join('');
    if (!rows) return '';
    var hasCmp = cmpArr.length > 0;
    return '<div class="card"><div class="block-title">🔍 选项对比（每个选项对应哪个词）</div>' + rows +
      '<div class="small muted" style="margin-top:8px">' +
      '✓ 是本词的意思；✗ 是别的词的意思（干扰项）。' +
      (hasCmp ? '把四个词放一起横向对比，比单记一个更牢。' : '') + '</div></div>';
  }
  function renderIdiom() {
    var rw = (S.iMode === 'rw');
    var items = idiomQueue(), i = S.idx, cur = iCurItem();
    if (!cur) {
      if (rw) { S.iMode = 'set'; S.iList = null; S.idx = 0; S.picked = []; S.judged = false; S.view = 'iwrong'; syncHash(); return render(); }
      return goHome();
    }
    var item = cur.item, setId = cur.ent.set, idx = cur.ent.idx, rev = !!cur.ent.rev;
    var p = iProg(setId), prev = p.ans[idx];
    if (prev && !rev && !S.judged && !S.picked.length) { S.picked = prev.pick.slice(); S.judged = true; }
    var pct = Math.round((i + (S.judged ? 1 : 0)) / items.length * 100);

    var opts = (item.options || []).map(function (o, k) {
      var key = LETTERS[k], cls = 'opt', picked = S.picked.indexOf(key) >= 0;
      var isAns = (item.answer || []).indexOf(key) >= 0;
      if (S.judged) { if (isAns) cls += ' ok'; else if (picked) cls += ' err'; }
      else if (picked) cls += ' sel';
      return '<button class="' + cls + '" data-iopt="' + key + '"' + (S.judged ? ' disabled' : '') + '>' +
        '<span class="k">' + key + '</span><span class="grow">' + h(o) + '</span></button>';
    }).join('');

    var fb = '';
    if (S.judged) {
      var ok = oneRight(item.answer, S.picked);
      var iwNow = iEntry(setId, idx), iwOld = S.iPrev;
      var grad = rev && ok && iwOld && ((iwOld.ok || 0) + 1 >= 2);
      fb = '<div class="fb ' + (ok ? 'good' : 'bad') + '">' +
        '<h4>' + (ok ? '✅ 选对了' : '❌ 选错了') + (rev ? '（错词复习）' : '') + '</h4>' +
        '<div class="ans">你的选择：' + (S.picked.join('') || '未作答') + '　｜　正确释义：' + (item.answer || []).join('') + '　' + h(item.options[LETTERS.indexOf((item.answer || ['A'])[0])] || '') + '</div></div>' +
        (!ok ? '<div class="card small muted">🧯 已收进<b>错词本</b>：' + (iwNow ? '已错过 ' + (iwNow.n || 1) + ' 次' : '') + '，3 天后回来复习。</div>'
          : (rev ? '<div class="card small muted">' + (grad ? '🎓 连对两次，已从错词本<b>毕业</b>！' : '答对了，7 天后再来一次就能毕业。') + '</div>' : '')) +
        '<div class="card"><div class="block-title">📖 释义</div><div class="explain">' + h(item.mean || '') + '</div></div>' +
        (item.eg ? '<div class="card"><div class="block-title">✍️ 例句（加深理解）</div><div class="eg">' + h(item.eg) + '</div>' +
          (item.egFrom ? '<div class="small muted" style="margin-top:6px">—— ' + h(item.egFrom) + '</div>' : '') + '</div>' : '') +
        iCmpCard(item, S.picked) +
        (item.src ? '<div class="card"><div class="block-title">📜 出处 / 典故</div><div class="tips">' + h(item.src) + '</div></div>' : '') +
        (item.tip ? '<div class="card"><div class="block-title">⚠️ 易错点</div><div class="tips">' + h(item.tip) + '</div></div>' : '') +
        (item.recap ? '<div class="card"><div class="block-title">🧠 一句话记住</div><div class="recap">' + h(item.recap) + '</div></div>' : '');
    }

    appEl.innerHTML = '<div class="topbar">' +
      '<button class="iconbtn" data-act="' + (rw ? 'iwrong' : 'home') + '">‹</button>' +
      '<span class="progress-line"><i style="width:' + pct + '%"></i></span>' +
      '<span class="count">' + (i + 1) + ' / ' + items.length + '</span></div>' +
      '<div class="card"><div class="qhead"><span class="qno">' + (rw ? '错词复习 · 第 ' + (i + 1) + ' 个' : (rev ? '🔁 错词热身 · 第 ' + (i + 1) + ' 个' : '第 ' + (i + 1) + ' 个词语')) + '</span>' +
      '<span class="tag ' + (rev ? '' : 'gray') + '">' + (rev ? '错词本' : h(item.kind || '成语')) + '</span>' +
      (rev ? '<span class="small muted">来自第 ' + setId + ' 期</span>' : (cur.set.difficulty ? '<span class="small muted">' + h(cur.set.difficulty) + '</span>' : '')) + '</div>' +
      '<div style="font-size:26px;font-weight:700;letter-spacing:2px;margin:6px 0 2px">' + h(item.w) + '</div>' +
      '<div class="small muted" style="margin-bottom:12px">' + h(item.py || '') + '</div>' +
      '<div class="small muted" style="margin-bottom:8px">下面哪一项是它的正确意思？</div>' +
      '<div class="opts">' + opts + '</div></div>' + fb;
    renderFooter();
  }
  function renderCalc() {
    var it = calcCur(); if (!it) return goHome();
    var items = it.items || [], i = S.idx, item = items[i];
    if (!item) { S.view = 'calcdone'; syncHash(); return render(); }
    var p = cProg(it.set), prev = p.ans[i];
    if (prev && !S.judged && !S.picked.length) { S.picked = prev.pick.slice(); S.judged = true; }
    var pct = Math.round((i + (S.judged ? 1 : 0)) / items.length * 100);

    var opts = (item.options || []).map(function (o, k) {
      var key = LETTERS[k], cls = 'opt', picked = S.picked.indexOf(key) >= 0;
      var isAns = (item.answer || []).indexOf(key) >= 0;
      if (S.judged) { if (isAns) cls += ' ok'; else if (picked) cls += ' err'; }
      else if (picked) cls += ' sel';
      return '<button class="' + cls + '" data-copt="' + key + '"' + (S.judged ? ' disabled' : '') + '>' +
        '<span class="k">' + key + '</span><span class="grow">' + h(o) + '</span></button>';
    }).join('');

    var fb = '';
    if (S.judged) {
      var ok = oneRight(item.answer, S.picked);
      fb = '<div class="fb ' + (ok ? 'good' : 'bad') + '">' +
        '<h4>' + (ok ? '✅ 算对了' : '❌ 算错了') + '</h4>' +
        '<div class="ans">你的答案：' + (S.picked.join('') || '未作答') + '　｜　正确答案：' + (item.answer || []).join('') + '</div></div>' +
        (item.method ? '<div class="card"><div class="block-title">🧮 计算方法</div><div class="explain" style="white-space:pre-wrap">' + h(item.method) + '</div></div>' : '') +
        '<div class="card"><div class="block-title">📖 解析</div><div class="explain">' + h(item.explain || '') + '</div></div>' +
        (item.tip ? '<div class="card"><div class="block-title">⚠️ 易错点</div><div class="tips">' + h(item.tip) + '</div></div>' : '') +
        (item.hard ? '<div class="card"><div class="block-title">🧱 难点提醒</div><div class="tips">' + h(item.hard) + '</div></div>' : '');
    }

    appEl.innerHTML = '<div class="topbar">' +
      '<button class="iconbtn" data-act="home">‹</button>' +
      '<span class="progress-line"><i style="width:' + pct + '%"></i></span>' +
      '<span class="count">' + (i + 1) + ' / ' + items.length + '</span></div>' +
      '<div class="card"><div class="qhead"><span class="qno">第 ' + (i + 1) + ' 题</span>' +
      '<span class="tag ' + (item.type === 'applied' ? '' : 'gray') + '">' + (item.type === 'applied' ? '资料分析' : '速算') + '</span>' +
      (item.level ? '<span class="small muted">' + h(item.level) + '</span>' : '') + '</div>' +
      (item.data ? '<div class="card" style="background:#f7f8fc;border:1px dashed var(--line);margin-bottom:10px"><div class="block-title">📊 材料</div><div class="explain" style="white-space:pre-wrap">' + h(item.data) + '</div></div>' : '') +
      '<p class="stem">' + h(item.stem || '') + '</p>' +
      '<div class="opts">' + opts + '</div></div>' + fb;
    renderFooter();
  }
  function iPick(key) {
    if (S.judged) return;
    S.picked = [key];
    var cur = iCurItem(); if (!cur) return;
    var item = cur.item, ent = cur.ent;
    var ok = oneRight(item.answer, S.picked);
    S.iPrev = ent.rev ? iEntry(ent.set, ent.idx) : null;   /* 记录作答前状态，用于判断是否毕业 */
    if (!ent.rev) {   /* 错词复习不改动原期进度，只更新错词本 */
      var p = iProg(ent.set);
      p.ans[ent.idx] = { pick: S.picked.slice(), ok: ok, ts: Date.now() };
      p.updated = Date.now();
      saveIStore();
    }
    iMark(ent.set, ent.idx, ok);
    S.judged = true;
    if (!ok) toast('❌ 已收进错词本');
    else if (ent.rev) toast('✅ 复习通过');
    render();
  }
  function cPick(key) {
    if (S.judged) return;
    S.picked = [key];
    var it = calcCur(), item = (it.items || [])[S.idx];
    if (!item) return;
    var ok = oneRight(item.answer, S.picked);
    var p = cProg(it.set);
    p.ans[S.idx] = { pick: S.picked.slice(), ok: ok, ts: Date.now() };
    p.updated = Date.now();
    saveCStore();
    S.judged = true;
    render();
  }
  function setStep(kind, d) {
    if (kind === 'i') {
      var q = idiomQueue(), n = q.length;
      if (d > 0 && S.idx >= n - 1) {
        if (S.iMode === 'rw') { S.iMode = 'set'; S.iList = null; S.idx = 0; S.picked = []; S.judged = false; toast('这一轮错词清完了'); S.view = 'iwrong'; syncHash(); return render(); }
        S.view = 'idiomdone'; syncHash(); return render();
      }
      S.idx = Math.max(0, Math.min(n - 1, S.idx + d));
      S.picked = []; S.judged = false; render(); return;
    }
    var it = calcCur();
    if (!it) return;
    var cn = (it.items || []).length;
    if (d > 0 && S.idx >= cn - 1) { S.view = 'calcdone'; syncHash(); return render(); }
    S.idx = Math.max(0, Math.min(cn - 1, S.idx + d));
    S.picked = []; S.judged = false; render();
  }
  /* 重做一期：已作答的记录不直接删，而是转成「墓碑」del[题号]=清空时刻。
     直接删的话，云端/备份按条目合并（mergeQuizObj）时会把旧答案又合回来，
     表现就是"点了重做只重置一题、其余还是旧的"。 */
  function resetProg(p) {
    if (!p) return;
    var now = Date.now();
    p.del = p.del || {};
    Object.keys(p.ans || {}).forEach(function (i) { p.del[i] = now; });
    p.ans = {}; p.updated = now;
  }
  function setRetry(kind) {
    if (kind === 'i') {
      var it = idiomCur(); resetProg(iProg(it.set)); saveIStore();
      S.subject = 'idiom'; S.iMode = 'set'; S.iList = null; S.iMix = null;
      S.view = 'idiom'; S.idx = 0; S.picked = []; S.judged = false; syncHash(); render();
    } else {
      var c = calcCur(); resetProg(cProg(c.set)); saveCStore();
      S.subject = 'calc'; S.view = 'calc'; S.idx = 0; S.picked = []; S.judged = false; syncHash(); render();
    }
    toast('已重置，重新开始');
  }
  function goIdiom(id, idx) {
    S.subject = 'idiom'; S.view = 'idiom'; S.idioId = id; S.idx = idx || 0; S.picked = []; S.judged = false;
    S.iMode = 'set'; S.iList = null;
    S.iMix = (idx ? [] : iMixPick(id, 3));   /* 从头开始背时，把到期错词混 3 个到最前面热身 */
    if (S.iMix.length) toast('先复习 ' + S.iMix.length + ' 个到期错词 🔁');
    syncHash(); render();
  }
  function goCalc(id, idx) {
    S.subject = 'calc'; S.view = 'calc'; S.calcId = id; S.idx = idx || 0; S.picked = []; S.judged = false;
    syncHash(); render();
  }

  /* ================= 启动 ================= */
  var saved = null;
  try { saved = localStorage.getItem(CU_KEY); } catch (e) {}
  loadSession();
  if (saved && curProfileById(saved) && (!ACCT.id || saved === ACCT.id)) {
    PID = saved;
    loadAll();
    wBackfill();
    iBackfill();
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

  /* 中文音色异步加载：系统 TTS 列表可能晚于页面就绪 */
  try {
    if (window.speechSynthesis) {
      speechSynthesis.onvoiceschanged = function () { nsFillVoices(); };
      setTimeout(function () { nsFillVoices(); }, 600);
      setTimeout(function () { nsFillVoices(); }, 2000);
    }
  } catch (e) { }
})();
