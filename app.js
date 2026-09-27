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

  /* ================= 云同步（跨设备，只认账号不认设备） =================
     存储：textdb.dev 公开 KV，key = kg-<同步码>，CORS 全开，无需注册。
     结构：{ v:1, updated, accounts:[档案...], data:{ 档案id: { quiz:{p:{}}, vocab:{w:{},t:{}} } } }
     同步策略：本地与云端按条目合并（每条带时间戳，取新的那一条），最后写入云端。
     注意：这是「够用级」同步，不是账号系统；PIN 仅本地区分，请勿放敏感内容。 */
  var SYNC_API = 'https://textdb.dev/api/data/';
  var SYNC = { code: null, status: '', at: 0, busy: false };
  var pushTimer = null;

  function syncKeyOf(code) { return 'kg-' + String(code || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function loadSyncCfg() {
    try {
      var o = JSON.parse(localStorage.getItem('kg_sync') || 'null');
      if (o && o.code) { SYNC.code = o.code; SYNC.at = o.at || 0; }
    } catch (e) {}
  }
  function saveSyncCfg() { try { localStorage.setItem('kg_sync', JSON.stringify({ code: SYNC.code, at: SYNC.at })); } catch (e) {} }
  function genCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 12; i++) s += A[Math.floor(Math.random() * A.length)];
    return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
  }
  function apiGet(code) {
    return fetch(SYNC_API + syncKeyOf(code), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('GET ' + r.status);
      return r.text();
    }).then(function (t) {
      t = (t || '').trim();
      if (!t || t === 'null' || t.charAt(0) !== '{') return null;
      return JSON.parse(t);
    });
  }
  function apiPut(code, obj) {
    return fetch(SYNC_API + syncKeyOf(code), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(obj)
    }).then(function (r) {
      if (!r.ok) throw new Error('POST ' + r.status);
      return true;
    });
  }

  function readLocal(p) {
    var q = null, v = null;
    try { q = JSON.parse(localStorage.getItem('kg_quiz_v2::' + p) || 'null'); } catch (e) {}
    try { v = JSON.parse(localStorage.getItem('kg_vocab_v1::' + p) || 'null'); } catch (e) {}
    return { quiz: (q && q.p) ? q : { p: {} }, vocab: (v && v.w) ? { w: v.w, t: v.t || {} } : { w: {}, t: {} } };
  }

  function localSpace() {
    var accs = loadProfiles(), data = {};
    accs.forEach(function (p) { data[p.id] = readLocal(p.id); });
    if (PID && !data[PID]) { data[PID] = { quiz: store, vocab: { w: vstore.w, t: vstore.t || {} } }; }
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
  function mergeSpace(a, b) {
    var out = { v: 1, updated: Date.now(), accounts: [], data: {} };
    var byId = {};
    [a, b].forEach(function (sp) {
      if (!sp) return;
      (sp.accounts || []).forEach(function (p) {
        if (!p || !p.id) return;
        if (!byId[p.id]) { byId[p.id] = p; out.accounts.push(p); }
        else if (!byId[p.id].pin && p.pin) byId[p.id].pin = p.pin;
      });
    });
    var ids = {};
    [a, b].forEach(function (sp) { if (sp) Object.keys(sp.data || {}).forEach(function (k) { ids[k] = 1; }); });
    Object.keys(ids).forEach(function (pid) {
      var da = ((a || {}).data || {})[pid] || {}, db = ((b || {}).data || {})[pid] || {};
      out.data[pid] = {
        quiz: mergeQuizObj(da.quiz, db.quiz),
        vocab: mergeVocabObj(da.vocab, db.vocab)
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
      else if (!hit.pin && p.pin) { hit.pin = p.pin; changed = true; }
    });
    if (changed) saveProfiles(ps);
    Object.keys(sp.data || {}).forEach(function (pid) {
      var cur = readLocal(pid), nx = sp.data[pid];
      var q = mergeQuizObj(cur.quiz, nx.quiz), v = mergeVocabObj(cur.vocab, nx.vocab);
      try {
        localStorage.setItem('kg_quiz_v2::' + pid, JSON.stringify(q));
        localStorage.setItem('kg_vocab_v1::' + pid, JSON.stringify(v));
      } catch (e) {}
    });
  }

  function syncNow(then) {
    if (!SYNC.code || SYNC.busy) { if (then) then(); return; }
    SYNC.busy = true; SYNC.status = '同步中…'; render();
    var local = localSpace();
    apiGet(SYNC.code).then(function (remote) {
      var merged = mergeSpace(local, remote);
      applySpace(merged);
      return apiPut(SYNC.code, merged).then(function () {
        SYNC.busy = false; SYNC.at = Date.now(); SYNC.status = '已同步';
        saveSyncCfg(); loadAll(); render(); if (then) then();
      });
    }).catch(function (e) {
      SYNC.busy = false; SYNC.status = '同步失败（离线或服务不可用）'; render(); if (then) then();
    });
  }
  function scheduleSync() {
    if (!SYNC.code) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { syncNow(); }, 2500);
  }

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
  function renderGate(creating) {
    var ps = loadProfiles();
    var listHtml = ps.map(function (p) {
      return '<button class="pcard" data-pid="' + h(p.id) + '">' +
        '<span class="pav">' + h((p.name || '?').slice(0, 1)) + '</span>' +
        '<span class="grow" style="text-align:left"><b>' + h(p.name) + '</b>' +
        '<div class="small muted">' + (p.pin ? '🔒 需要密码 · ' : '') + '创建于 ' + String(p.created || '').slice(0, 10) + '</div></span>' +
        '<span class="small muted">进入 ›</span></button>';
    }).join('');

    var body;
    if (creating || !ps.length) {
      body = '<div class="card">' +
        '<div class="block-title">' + (ps.length ? '新建学习档案' : '第一次使用，先建个档案') + '</div>' +
        '<label class="fld"><span>昵称</span><input id="pname" maxlength="12" placeholder="如：西瓜" autocomplete="off"></label>' +
        '<label class="fld"><span>4 位数字密码（可留空）</span><input id="ppin" maxlength="4" inputmode="numeric" placeholder="留空 = 免密进入" autocomplete="off"></label>' +
        '<div class="summary-box small muted" style="margin-bottom:14px">每个档案的刷题进度、单词掌握度、生词本都独立保存，互不干扰。密码只做本地区分，不是账号系统。</div>' +
        '<button class="btn lg block" data-act="create">创建并开始</button>' +
        (ps.length ? '<button class="btn lg block ghost" data-act="cancel-create" style="margin-top:8px">返回档案列表</button>' : '') +
        '</div>';
    } else {
      body = '<div class="gate-tip small muted">选一个档案进入（数据各自独立）</div>' + listHtml +
        '<button class="btn lg block ghost" data-act="new-profile" style="margin-top:14px">+ 新建档案</button>' +
        '<button class="btn lg block ghost" data-act="sync-join" style="margin-top:8px">☁ 我已有同步码（换设备 / 换手机）</button>';
    }

    appEl.innerHTML = '<div class="gate">' +
      '<div class="hero"><h1>学习工作台 🧠</h1>' +
      '<div class="sub">考公政治常识刷题 ｜ 四级核心 2000 词</div></div>' + body + '</div>';
    dropFooter();
  }

  function doCreate() {
    var nEl = document.getElementById('pname'), pEl = document.getElementById('ppin');
    var n = (nEl && nEl.value ? nEl.value : '').trim();
    var pin = (pEl && pEl.value ? pEl.value : '').trim();
    if (!n) return toast('昵称不能为空');
    if (pin && !/^\d{4}$/.test(pin)) return toast('密码要 4 位数字');
    var ps = loadProfiles();
    var id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    ps.push({ id: id, name: n, pin: pin, created: new Date().toISOString() });
    saveProfiles(ps);
    if (ps.length === 1) {
      try {
        var old = localStorage.getItem('kg_quiz_v2');
        if (old && !localStorage.getItem('kg_quiz_v2::' + id)) localStorage.setItem('kg_quiz_v2::' + id, old);
      } catch (e) {}
    }
    enter(id);
    toast('档案「' + n + '」已创建');
  }

  function enter(id) {
    var ps = loadProfiles(), p = null;
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) p = ps[i];
    if (!p) return;
    if (p.pin) {
      var v = window.prompt('「' + p.name + '」的 4 位密码');
      if (v === null) return;
      if (String(v) !== String(p.pin)) return toast('密码不对');
    }
    PID = id;
    try { localStorage.setItem(CU_KEY, id); } catch (e) {}
    loadAll();
    location.hash = '#/';
    applyHash(); render();
    if (SYNC.code) syncNow();
  }

  function switchProfile() {
    PID = null; store = { p: {} }; vstore = { w: {} };
    try { localStorage.removeItem(CU_KEY); } catch (e) {}
    location.hash = '#/';
    renderGate(false);
  }

  /* ================= 首页 ================= */
  function tabsHtml() {
    var p = curProfile() || { name: '?' };
    return '<div class="topbar solid">' +
      '<span class="pav sm">' + h((p.name || '?').slice(0, 1)) + '</span>' +
      '<span class="grow small"><b>' + h(p.name) + '</b></span>' +
      '<button class="iconbtn" data-act="sync" title="云同步">☁</button>' +
      '<button class="iconbtn" data-act="switch" title="切换档案">⇄</button></div>' +
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
    try { var o = JSON.parse(localStorage.getItem(diaryKey()) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function saveDiary(o) { try { localStorage.setItem(diaryKey(), JSON.stringify(o)); } catch (e) {} }
  function dsOf(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function cnDate(ds) { var a = ds.split('-'); return (+a[0]) + '年' + (+a[1]) + '月' + (+a[2]) + '日'; }
  function dowOf(ds) { return '星期' + DOWS[new Date(ds + 'T00:00:00').getDay()]; }

  function diaryStats(d) {
    var keys = Object.keys(d).filter(function (k) { return String(d[k] || '').trim(); });
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
      var txt = String(d[ds] || '').trim();
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
    var d = loadDiary(), txt = d[ds] || '';
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
    if (v.trim()) d[S.diaryDate] = v; else delete d[S.diaryDate];
    saveDiary(d);
    toast(v.trim() ? '已记下 ' + cnDate(S.diaryDate) + ' ✅' : '已清空这天的记录');
    S.view = 'home'; S.subject = 'diary'; syncHash(); render();
  }
  function diaryDel() {
    if (!window.confirm('删除 ' + cnDate(S.diaryDate) + ' 的记录？')) return;
    var d = loadDiary(); delete d[S.diaryDate]; saveDiary(d);
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
    var ps = loadProfiles();
    var head = '<div class="topbar"><button class="iconbtn" data-act="home">‹</button>' +
      '<span class="grow small muted">云同步 · 跨设备同账号</span></div>';

    if (!SYNC.code) {
      appEl.innerHTML = head +
        '<div class="card"><div class="kptitle">开一个同步空间</div>' +
        '<div class="small muted" style="margin-top:6px">同步空间用「同步码」识别，跟设备无关：' +
        '在电脑上生成的码，填到手机 / 平板 / 另一台电脑上，就能看到同一个账号和同一份进度。</div>' +
        '<div class="summary-box small" style="margin:12px 0">当前本机档案：' +
        (ps.length ? ps.map(function (p) { return h(p.name); }).join('、') : '（还没有档案）') + '</div>' +
        '<button class="btn lg block" data-act="sync-create">生成同步码（把本机档案传上去）</button>' +
        '<button class="btn lg block ghost" data-act="sync-join" style="margin-top:8px">我已有同步码，填进去</button>' +
        '</div>' +
        '<div class="card small muted">⚠️ 同步码就是钥匙，别随便发人；这是轻量同步（公开 KV 存储 + 客户端合并），' +
        '不适合放敏感内容。</div>';
      dropFooter(); return;
    }

    var st = SYNC.busy ? '同步中…' : (SYNC.status || (SYNC.at ? '上次同步 ' + new Date(SYNC.at).toLocaleString() : '尚未同步'));
    appEl.innerHTML = head +
      '<div class="card"><div class="kptitle">同步码</div>' +
      '<div class="synccode" data-act="sync-copy">' + h(SYNC.code) + '</div>' +
      '<div class="small muted">在任何设备打开本页 → 点「我已有同步码」→ 填这个码 → 用同一个昵称和密码登录，进度就是同一份。</div>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn grow" data-act="sync-now">' + (SYNC.busy ? '同步中…' : '立即同步') + '</button>' +
      '<button class="btn ghost" data-act="sync-copy">复制同步码</button></div>' +
      '<div class="small muted" style="margin-top:10px">状态：' + h(st) + '</div></div>' +
      '<div class="card"><div class="block-title">这个空间里的档案</div>' +
      (ps.map(function (p) {
        return '<div class="wrow"><b>' + h(p.name) + '</b><span class="small muted">' + (p.pin ? '有密码' : '免密') +
          '</span><span class="wdot">' + (p.id === PID ? '当前' : '') + '</span></div>';
      }).join('') || '<div class="small muted">暂无</div>') +
      '<div class="small muted" style="margin-top:10px">想让别人用自己的账号在这里学习？让他新建档案 → 他的进度会一起同步，但和你的互不干扰。</div></div>' +
      '<div class="row" style="margin-bottom:24px"><button class="btn ghost grow" data-act="sync-leave">退出同步空间</button></div>';
    dropFooter();
  }

  function syncCreate() {
    SYNC.code = genCode();
    SYNC.status = '正在上传…';
    saveSyncCfg();
    renderSync();
    syncNow(function () { toast('同步码已生成，抄到别的设备上就能用'); });
  }
  function syncJoin() {
    var c = window.prompt('输入同步码（形如 ABCD-EFGH-JKLM）');
    if (!c) return;
    c = c.trim().toUpperCase();
    if (c.replace(/[^A-Z0-9]/g, '').length < 8) return toast('同步码看起来不对');
    SYNC.code = c; SYNC.status = '正在拉取…'; saveSyncCfg();
    apiGet(c).then(function (remote) {
      if (!remote) { SYNC.status = '这个同步码上还没有数据（可以是新空间）'; saveSyncCfg(); renderSync(); return; }
      var merged = mergeSpace(localSpace(), remote);
      applySpace(merged);
      return apiPut(c, merged).then(function () {
        SYNC.at = Date.now(); SYNC.status = '已拉取云端数据';
        saveSyncCfg(); loadAll();
        if (!PID) renderGate(false); else { render(); toast('云端数据已合并'); }
      });
    }).catch(function () { SYNC.status = '同步码无效或网络不通'; renderSync(); });
  }
  function syncLeave() {
    if (!window.confirm('退出同步空间？本机数据会保留，之后不再自动同步。')) return;
    SYNC.code = null; SYNC.status = ''; SYNC.at = 0;
    try { localStorage.removeItem('kg_sync'); } catch (e) {}
    toast('已退出同步空间'); goHome();
  }
  function syncCopy() {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(SYNC.code);
      toast('同步码已复制：' + SYNC.code);
    } catch (e) { toast('同步码：' + SYNC.code); }
  }


  function render() {
    if (!PID) { renderGate(false); window.scrollTo(0, 0); return; }
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
    if (act === 'create') return doCreate();
    if (act === 'new-profile') return renderGate(true);
    if (act === 'cancel-create') return renderGate(false);
    if (act === 'switch') return switchProfile();
    if (act === 'sync') return goSync();
    if (act === 'sync-create') return syncCreate();
    if (act === 'sync-join') return syncJoin();
    if (act === 'sync-now') return syncNow(function () { toast('同步完成'); });
    if (act === 'sync-leave') return syncLeave();
    if (act === 'sync-copy') return syncCopy();
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
      if (e.key === 'Enter') { var el = document.getElementById('pname'); if (el === document.activeElement) doCreate(); }
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
  loadSyncCfg();
  if (saved && curProfileById(saved)) {
    PID = saved;
    loadAll();
    applyHash();
    render();
    statReport();
    if (SYNC.code) syncNow();
  } else {
    renderGate(false);
    if (SYNC.code) syncNow(function () { if (!PID) renderGate(false); });
  }

  function curProfileById(id) {
    var ps = loadProfiles();
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return true;
    return false;
  }
})();
