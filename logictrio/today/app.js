/* Logic Trio, today's puzzles on the web (D-233 step 5, D-249).
 * The same three boards the app shows that day, from the game's own pack
 * (days.json is written by tool/web_today/build.py). No sign-in, no tracker:
 * the browser keeps today's boards and times in localStorage, nothing else. */
(function () {
  'use strict';
  var ROOT = document.documentElement.getAttribute('data-root') || './';
  var VIEW = document.documentElement.getAttribute('data-view') || 'home';
  var MODES = ['crowns', 'suns', 'paths'];
  var NAMES = { crowns: 'Crowns', suns: 'Suns & Moons', paths: 'Paths' };
  var SLUG = { crowns: 'crowns', suns: 'suns-and-moons', paths: 'paths' };
  var TIER = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
  var RULE = {
    crowns: 'One crown in every row, column and colour.\nCrowns never touch, not even diagonally.',
    suns: 'As many suns as moons in every row and column.\nNo three alike in a row. Between cells: = same, × different.',
    paths: 'Draw one line from 1 to the last number, through the numbers in order, filling every cell.'
  };
  var PLAY = 'https://play.google.com/store/apps/details?id=com.nimbleknot.logictrio&referrer=utm_source%3Dwebsite%26utm_medium%3Dtoday%26utm_campaign%3D';
  var SITE = 'https://nimbleknot.github.io/logictrio/today/';
  var $ = function (id) { return document.getElementById(id); };

  // ---------- the visit counter (GoatCounter, D-250): no cookies, no IP kept, nothing stored for it.
  // Our own few lines in place of count.js, so the page loads no code from elsewhere.
  var GC = document.documentElement.getAttribute('data-gc') || '';
  function gc(path, title, isEvent) {
    if (!GC || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) || document.visibilityState === 'prerender') return;
    if (navigator.webdriver) return;
    var d = { p: path, t: title || document.title, e: isEvent ? 'true' : '', s: String(screen.width), rnd: Math.random().toString(36).slice(2, 7) };
    if (!isEvent) { d.r = document.referrer; d.q = location.search; }
    var q = [];
    for (var k in d) if (d[k]) q.push(k + '=' + encodeURIComponent(d[k]));
    var url = GC + '?' + q.join('&');
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) { /* fall back */ }
    var img = new Image(); img.src = url;
  }
  // Where the visitor came from (?utm_source=instagram on our profile links), kept for this visit only,
  // so the app button's Play link says which profile sent the store visit.
  var SRC = '';
  try {
    var m = /[?&](?:utm_source|source)=([a-z0-9_-]{1,24})/i.exec(location.search);
    if (m) sessionStorage.setItem('lt-src', m[1].toLowerCase());
    SRC = sessionStorage.getItem('lt-src') || '';
  } catch (e) { SRC = ''; }

  // ---------- storage (a convenience only: everything works without it)
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } }
  function prune(keep) {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var name = localStorage.key(i);
        if (name && name.indexOf('lt-today-') === 0 && name !== keep) localStorage.removeItem(name);
      }
    } catch (e) { /* ignore */ }
  }

  // ---------- dates
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt(ms) {
    var t = Math.floor(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return m >= 60 ? Math.floor(m / 60) + ':' + pad(m % 60) + ':' + pad(s) : m + ':' + pad(s);
  }

  // ---------- glyphs, drawn as the game draws them (lib/game/board_view.dart)
  function css(k) { return getComputedStyle(document.documentElement).getPropertyValue(k).trim(); }
  var C = {};
  function readColours() {
    ['--ink', '--accent', '--accentLine', '--primary', '--surface', '--given', '--grid', '--error', '--success'].forEach(function (k) { C[k] = css(k); });
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    C.regions = dark
      ? ['#46387E', '#7D7219', '#AD5E76', '#304429', '#4D4949', '#62699F', '#895A44', '#357365', '#095663', '#644005']
      : ['#6AA4CF', '#FEE888', '#E9BFC1', '#A99D3B', '#D3EDBA', '#95B09A', '#B1BEFC', '#8ECAD4', '#FF9577', '#C68BA8'];
    C.dark = dark;
  }
  function crownSvg(x, y, s, col) {
    var w = s * 0.62, h = s * 0.42, l = x - w / 2, t = y - h / 2;
    return '<path d="M' + l + ' ' + (t + h * 0.25) + 'L' + (l + w * 0.25) + ' ' + (t + h * 0.62) + 'L' + x + ' ' + t + 'L' + (l + w * 0.75) + ' ' + (t + h * 0.62) +
      'L' + (l + w) + ' ' + (t + h * 0.25) + 'L' + (l + w * 0.9) + ' ' + (t + h) + 'L' + (l + w * 0.1) + ' ' + (t + h) + 'Z" fill="' + col + '" stroke="' + col +
      '" stroke-width="' + s * 0.04 + '" stroke-linejoin="round"/>';
  }
  function sunSvg(x, y, s) {
    var r = '';
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4, c = Math.cos(a), d = Math.sin(a);
      r += '<line x1="' + (x + c * s * 0.27) + '" y1="' + (y + d * s * 0.27) + '" x2="' + (x + c * s * 0.34) + '" y2="' + (y + d * s * 0.34) +
        '" stroke="' + C['--accentLine'] + '" stroke-width="' + s * 0.045 + '" stroke-linecap="round"/>';
    }
    return r + '<circle cx="' + x + '" cy="' + y + '" r="' + s * 0.2 + '" fill="' + C['--accent'] + '" stroke="' + C['--accentLine'] + '" stroke-width="' + s * 0.035 + '"/>';
  }
  function moonSvg(x, y, s, id) {
    return '<mask id="' + id + '"><rect x="' + (x - s) + '" y="' + (y - s) + '" width="' + 2 * s + '" height="' + 2 * s + '" fill="#fff"/><circle cx="' + (x + s * 0.13) +
      '" cy="' + (y - s * 0.08) + '" r="' + s * 0.2 + '" fill="#000"/></mask><circle cx="' + x + '" cy="' + y + '" r="' + s * 0.26 + '" fill="' + C['--primary'] + '" mask="url(#' + id + ')"/>';
  }
  function crossSvg(x, y, s, op, col) {
    var u = s * 0.12;
    return '<path d="M' + (x - u) + ' ' + (y - u) + 'L' + (x + u) + ' ' + (y + u) + 'M' + (x + u) + ' ' + (y - u) + 'L' + (x - u) + ' ' + (y + u) +
      '" stroke="' + (col || C['--ink']) + '" stroke-width="' + s * 0.04 + '" stroke-linecap="round" opacity="' + op + '"/>';
  }
  var ICON = {
    crowns: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8.5 8 13l4-7 4 7 4.5-4.5-1.6 10H5.1Z" fill="currentColor"/></svg>',
    suns: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="10" r="5" fill="#F2A93B" stroke="#B86E00" stroke-width="1.2"/><path d="M15.5 9.5a5.5 5.5 0 1 0 4 9.3 4.4 4.4 0 0 1-4-9.3Z" style="fill:var(--primary)"/></svg>',
    paths: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h11a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11"/></svg>'
  };
  function tile(m, small, off) {
    var col = m === 'crowns' ? 'var(--ink)' : m === 'paths' ? 'var(--pathsGlyph)' : '';
    return '<span class="' + (small ? 'mk' : 'tile') + (off ? ' off' : '') + '" style="background:var(--t' + m.charAt(0).toUpperCase() + m.slice(1) + ');color:' + col + '">' + ICON[m] + '</span>';
  }

  // ---------- sounds (the game's own, assets/sfx, as mp3) and the light buzz, both behind one switch
  var AC = null, BUF = {}, SOUND = true;
  try { SOUND = localStorage.getItem('lt-sound') !== '0'; } catch (e) { SOUND = true; }
  var SFX_NAMES = ['place_crown', 'mark', 'ui_tap', 'place_sun', 'place_moon', 'path_step_1', 'path_step_2', 'path_step_3', 'path_step_4',
    'path_step_5', 'path_back', 'waypoint', 'conflict', 'check_ok', 'check_bad', 'clear', 'solve'];
  function loadSounds(base) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
    SFX_NAMES.forEach(function (n) {
      fetch(base + 'sfx/' + n + '.mp3').then(function (r) { return r.arrayBuffer(); })
        .then(function (b) { AC.decodeAudioData(b, function (buf) { BUF[n] = buf; }, function () { /* skip */ }); })
        .catch(function () { /* offline */ });
    });
  }
  function sfx(n) {
    if (!SOUND || !AC || !BUF[n]) return;
    try {
      if (AC.state === 'suspended') AC.resume();
      var src = AC.createBufferSource(); src.buffer = BUF[n]; src.connect(AC.destination); src.start(0);
    } catch (e) { /* ignore */ }
  }
  function buzz(ms) { if (SOUND && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

  // ---------- a placed piece lands (board_view.dart: a crown drops in, a sun or moon flips open)
  var POP = null; // { cell, kind: 'lt-pop' | 'lt-flip' } for the very next drawing only
  function pop(i, cx, cy, inner) {
    if (!POP || POP.cell !== i) return inner;
    return '<g class="' + POP.kind + '" style="transform-origin:' + cx + 'px ' + cy + 'px">' + inner + '</g>';
  }
  // Mistakes show 0.7 s after the last change (session.dart _conflictDelayMs), so tapping
  // through a sun on the way to a moon never flashes red.
  var SHOWBAD = true;

  // ---------- the solve celebration, as the game draws it (board_view.dart: the wave and _burst)
  var ANIM = null; // { ms, n } while a solve plays
  function wave(i, n, cx, cy, inner) {
    if (!ANIM) return inner;
    var u = (ANIM.ms - (Math.floor(i / n) + i % n) * (560 / (2 * n))) / 320;
    if (u <= 0 || u >= 1) return inner;
    var k = 1 + 0.2 * Math.sin(u * Math.PI);
    return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + k + ') translate(' + (-cx) + ' ' + (-cy) + ')">' + inner + '</g>';
  }
  function burst() {
    if (!ANIM) return '';
    var t = (ANIM.ms - 520) / 700;
    if (t <= 0 || t >= 1) return '';
    var e = 1 - Math.pow(1 - t, 3), reach = B * (0.12 + 0.5 * e), o = '';
    for (var k = 0; k < 12; k++) {
      var a = k * Math.PI / 6 + 0.26, r = reach * (k % 2 ? 0.78 : 1);
      o += '<circle cx="' + (B / 2 + Math.cos(a) * r) + '" cy="' + (B / 2 + Math.sin(a) * r) + '" r="' + B * 0.014 * (1.4 - t) + '" fill="' + C['--accent'] + '" opacity="' + (1 - t) + '"/>';
    }
    return o;
  }

  // ---------- the day
  var DAYS = window.LT_DAYS;
  var today = keyOf(new Date());
  var dayKey = today, fallback = false;
  if (!DAYS.d[dayKey]) {
    var keys = Object.keys(DAYS.d).sort();
    dayKey = today < keys[0] ? keys[0] : keys[keys.length - 1];
    fallback = true;
  }
  var day = DAYS.d[dayKey];
  var PUZ = { crowns: day.p[0], suns: day.p[1], paths: day.p[2] };
  var STORE = 'lt-today-' + dayKey;
  prune(STORE);
  var saved = load(STORE) || {};
  MODES.forEach(function (m) { if (!saved[m]) saved[m] = { st: null, t: 0, done: false }; });
  function persist() { save(STORE, saved); }
  function dateLong() {
    var p = dayKey.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return dayKey; }
  }
  function dateShort() {
    var p = dayKey.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return dayKey; }
  }
  function nextOpen(after) {
    var start = after ? MODES.indexOf(after) + 1 : 0;
    for (var i = 0; i < 3; i++) { var m = MODES[(start + i) % 3]; if (!saved[m].done) return m; }
    return null;
  }
  function allDone() { return saved.crowns.done && saved.suns.done && saved.paths.done; }
  function setText(id, t) { var el = $(id); if (el) el.textContent = t; }

  // =====================================================================
  //  The boards
  // =====================================================================
  var B = 360; // viewBox size

  function Crowns(p) {
    var n = p.n, reg = [], sol = [];
    for (var i = 0; i < n * n; i++) reg.push(parseInt(p.g.charAt(i), 36));
    for (i = 0; i < n; i++) sol.push(parseInt(p.s.charAt(i), 36));
    function clash(a, b) {
      var ra = Math.floor(a / n), rb = Math.floor(b / n), ca = a % n, cb = b % n;
      return ra === rb || ca === cb || reg[a] === reg[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
    }
    function badOf(st) {
      var crowns = [], bad = {}, i, k;
      for (i = 0; i < n * n; i++) if (st.charAt(i) === '2') crowns.push(i);
      for (i = 0; i < crowns.length; i++) for (k = i + 1; k < crowns.length; k++) if (clash(crowns[i], crowns[k])) { bad[crowns[i]] = 1; bad[crowns[k]] = 1; }
      return bad;
    }
    return {
      n: n, cells: n * n,
      hasBad: function (st) { return Object.keys(badOf(st)).length > 0; },
      kind: function (v) { return v === '2' ? 'place_crown' : v === '1' ? 'mark' : 'ui_tap'; },
      popKind: 'lt-pop',
      blank: function () { var s = ''; for (var i = 0; i < n * n; i++) s += '0'; return s; },
      // 0 empty, 1 ×, 2 crown
      tap: function (st, i) { var v = (+st.charAt(i) + 1) % 3; return st.slice(0, i) + v + st.slice(i + 1); },
      count: function (st) { var k = 0; for (var i = 0; i < st.length; i++) if (st.charAt(i) === '2') k++; return k + ' / ' + n + ' crowns'; },
      solved: function (st) {
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if ((st.charAt(r * n + c) === '2') !== (sol[r] === c)) return false;
        return true;
      },
      wrong: function (st) {
        var w = [];
        for (var i = 0; i < n * n; i++) {
          var isSol = sol[Math.floor(i / n)] === i % n;
          if ((st.charAt(i) === '2' && !isSol) || (st.charAt(i) === '1' && isSol)) w.push(i);
        }
        return w;
      },
      draw: function (st, flash, won) {
        var c = B / n, o = '', crowns = [], i, k;
        for (i = 0; i < n * n; i++) if (st.charAt(i) === '2') crowns.push(i);
        var bad = badOf(st), auto = {};
        for (i = 0; i < crowns.length; i++) for (k = 0; k < n * n; k++) if (k !== crowns[i] && st.charAt(k) !== '2' && clash(k, crowns[i])) auto[k] = 1;
        for (i = 0; i < n * n; i++) o += '<rect x="' + (i % n) * c + '" y="' + Math.floor(i / n) * c + '" width="' + (c + 0.5) + '" height="' + (c + 0.5) + '" fill="' + C.regions[reg[i] % 10] + '"/>';
        for (i = 1; i < n; i++) o += '<path d="M' + i * c + ' 0V' + B + 'M0 ' + i * c + 'H' + B + '" stroke="' + C['--grid'] + '"/>';
        for (i = 0; i < n * n; i++) {
          var x = (i % n) * c, y = Math.floor(i / n) * c;
          if (i % n < n - 1 && reg[i] !== reg[i + 1]) o += '<path d="M' + (x + c) + ' ' + y + 'V' + (y + c) + '" stroke="' + C['--ink'] + '" stroke-width="3" stroke-linecap="round"/>';
          if (Math.floor(i / n) < n - 1 && reg[i] !== reg[i + n]) o += '<path d="M' + x + ' ' + (y + c) + 'H' + (x + c) + '" stroke="' + C['--ink'] + '" stroke-width="3" stroke-linecap="round"/>';
        }
        for (i = 0; i < n * n; i++) {
          var cx = (i % n) * c + c / 2, cy = Math.floor(i / n) * c + c / 2, v = st.charAt(i);
          var hot = flash && flash.indexOf(i) >= 0;
          if (hot) o += '<rect x="' + (cx - c / 2 + 3) + '" y="' + (cy - c / 2 + 3) + '" width="' + (c - 6) + '" height="' + (c - 6) + '" rx="6" fill="none" stroke="' + C['--error'] + '" stroke-width="3"/>';
          if (v === '2') o += pop(i, cx, cy, wave(i, n, cx, cy, crownSvg(cx, cy, c, bad[i] && !won && SHOWBAD ? C['--error'] : C['--ink'])));
          else if (v === '1') o += pop(i, cx, cy, crossSvg(cx, cy, c, 0.85));
          else if (auto[i]) o += crossSvg(cx, cy, c, 0.45);
        }
        return o;
      },
      label: function (i) { return 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1); }
    };
  }

  function Suns(p) {
    var n = p.n, links = [];
    (p.l || []).forEach(function (l) {
      var m = /^(\d+)([RD])(.)$/.exec(l);
      if (m) links.push({ a: +m[1], b: +m[1] + (m[2] === 'R' ? 1 : n), right: m[2] === 'R', same: m[3] === '=' });
    });
    function given(i) { return p.g.charAt(i) !== '.'; }
    function badOf(st) {
      // rule breaks: three alike in a line, too many of one in a line, a broken = or ×
      var bad = {};
      function line(get) {
        var cnt = { 1: 0, 2: 0 }, idx = [];
        for (var k = 0; k < n; k++) { idx.push(get(k)); var v = st.charAt(get(k)); if (v !== '0') cnt[v]++; }
        for (k = 0; k + 2 < n; k++) { var a = st.charAt(idx[k]); if (a !== '0' && a === st.charAt(idx[k + 1]) && a === st.charAt(idx[k + 2])) { bad[idx[k]] = bad[idx[k + 1]] = bad[idx[k + 2]] = 1; } }
        ['1', '2'].forEach(function (v) { if (cnt[v] > n / 2) idx.forEach(function (j) { if (st.charAt(j) === v) bad[j] = 1; }); });
      }
      for (var r = 0; r < n; r++) { line(function (k) { return r * n + k; }); line(function (k) { return k * n + r; }); }
      links.forEach(function (l) {
        var a = st.charAt(l.a), b = st.charAt(l.b);
        if (a !== '0' && b !== '0' && ((a === b) !== l.same)) { bad[l.a] = 1; bad[l.b] = 1; }
      });
      return bad;
    }
    return {
      n: n, cells: n * n,
      hasBad: function (st) { return Object.keys(badOf(st)).length > 0; },
      kind: function (v) { return v === '1' ? 'place_sun' : v === '2' ? 'place_moon' : 'ui_tap'; },
      popKind: 'lt-flip',
      // 0 empty, 1 sun, 2 moon (givens S / M)
      blank: function () { var s = ''; for (var i = 0; i < n * n; i++) s += p.g.charAt(i) === 'S' ? '1' : p.g.charAt(i) === 'M' ? '2' : '0'; return s; },
      tap: function (st, i) { if (given(i)) return st; var v = (+st.charAt(i) + 1) % 3; return st.slice(0, i) + v + st.slice(i + 1); },
      count: function (st) { var k = 0; for (var i = 0; i < st.length; i++) if (st.charAt(i) !== '0') k++; return k + ' / ' + n * n + ' cells'; },
      solved: function (st) { for (var i = 0; i < n * n; i++) if (+st.charAt(i) !== +p.s.charAt(i) + 1) return false; return true; },
      wrong: function (st) { var w = []; for (var i = 0; i < n * n; i++) if (st.charAt(i) !== '0' && +st.charAt(i) !== +p.s.charAt(i) + 1) w.push(i); return w; },
      draw: function (st, flash) {
        var c = B / n, o = '', i;
        var bad = badOf(st);
        for (i = 0; i < n * n; i++) if (given(i)) o += '<rect x="' + (i % n) * c + '" y="' + Math.floor(i / n) * c + '" width="' + c + '" height="' + c + '" fill="' + C['--given'] + '"/>';
        for (i = 1; i < n; i++) o += '<path d="M' + i * c + ' 0V' + B + 'M0 ' + i * c + 'H' + B + '" stroke="' + C['--grid'] + '"/>';
        for (i = 0; i < n * n; i++) {
          var x = (i % n) * c + c / 2, y = Math.floor(i / n) * c + c / 2, v = st.charAt(i);
          if ((SHOWBAD && bad[i]) || (flash && flash.indexOf(i) >= 0)) o += '<rect x="' + (x - c / 2 + 3) + '" y="' + (y - c / 2 + 3) + '" width="' + (c - 6) + '" height="' + (c - 6) + '" rx="6" fill="none" stroke="' + C['--error'] + '" stroke-width="3"/>';
          if (v === '1') o += pop(i, x, y, wave(i, n, x, y, sunSvg(x, y, c))); else if (v === '2') o += pop(i, x, y, wave(i, n, x, y, moonSvg(x, y, c, 'mm' + i)));
        }
        links.forEach(function (l) {
          var x = (l.a % n) * c, y = Math.floor(l.a / n) * c;
          var cx = l.right ? x + c : x + c / 2, cy = l.right ? y + c / 2 : y + c, r = c * 0.14, ink = C['--ink'];
          o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + C['--surface'] + '" stroke="' + ink + '" stroke-width="1.6"/>';
          o += l.same
            ? '<path d="M' + (cx - r * 0.45) + ' ' + (cy - r * 0.25) + 'h' + r * 0.9 + 'M' + (cx - r * 0.45) + ' ' + (cy + r * 0.25) + 'h' + r * 0.9 + '" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round"/>'
            : '<path d="M' + (cx - r * 0.38) + ' ' + (cy - r * 0.38) + 'l' + r * 0.76 + ' ' + r * 0.76 + 'M' + (cx + r * 0.38) + ' ' + (cy - r * 0.38) + 'l' + (-r * 0.76) + ' ' + r * 0.76 + '" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round"/>';
        });
        return o;
      },
      label: function (i) { return 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1); }
    };
  }

  function Paths(p) {
    var n = p.n, walls = {}, sol = [];
    (p.x || []).forEach(function (w) { var m = /^(\d+)([RD])$/.exec(w); if (m) walls[+m[1] + ':' + (+m[1] + (m[2] === 'R' ? 1 : n))] = 1; });
    var parts = p.s.split(':'), cell = +parts[0];
    sol.push(cell);
    for (var k = 0; k < parts[1].length; k++) { var d = parts[1].charAt(k); cell += d === 'R' ? 1 : d === 'L' ? -1 : d === 'D' ? n : -n; sol.push(cell); }
    function wall(a, b) { return walls[Math.min(a, b) + ':' + Math.max(a, b)]; }
    function canStep(a, b) {
      if (b < 0 || b >= n * n) return false;
      var ra = Math.floor(a / n), rb = Math.floor(b / n);
      if (!((ra === rb && Math.abs(a - b) === 1) || Math.abs(a - b) === n)) return false;
      return !wall(a, b);
    }
    function wp(c) { return p.w.indexOf(c); }
    function parse(st) { return st ? st.split('.').map(Number) : []; }
    function nextNumber(path) { var k = 0; path.forEach(function (c) { if (wp(c) === k) k++; }); return k; }
    var api = {
      n: n, cells: n * n, isPaths: true,
      hasBad: function () { return false; },
      isNumber: function (c) { return wp(c) >= 0; },
      blank: function () { return String(p.w[0]); },
      parse: parse,
      wpIndex: wp,
      // add a cell to the line (or take steps back); returns the new state or null when refused
      step: function (st, to) {
        var path = parse(st);
        var at = path.indexOf(to);
        if (at >= 0) return path.slice(0, at + 1).join('.');
        if (!path.length) return to === p.w[0] ? String(to) : null;
        if (!canStep(path[path.length - 1], to)) return null;
        var w = wp(to);
        if (w >= 0 && w !== nextNumber(path)) return null;
        if (path[path.length - 1] === p.w[p.w.length - 1]) return null;
        return path.concat([to]).join('.');
      },
      count: function (st) { return parse(st).length + ' / ' + n * n + ' cells'; },
      solved: function (st) {
        var path = parse(st);
        if (path.length !== n * n || path[0] !== p.w[0] || path[path.length - 1] !== p.w[p.w.length - 1]) return false;
        var seen = {}, k = 0;
        for (var i = 0; i < path.length; i++) {
          if (seen[path[i]]) return false; seen[path[i]] = 1;
          if (i && !canStep(path[i - 1], path[i])) return false;
          var w = wp(path[i]); if (w >= 0) { if (w !== k) return false; k++; }
        }
        return k === p.w.length;
      },
      wrong: function (st) {
        var path = parse(st), i = 0;
        while (i < path.length && path[i] === sol[i]) i++;
        return path.slice(i);
      },
      draw: function (st, flash, won) {
        var c = B / n, o = '', path = parse(st), i;
        for (i = 1; i < n; i++) o += '<path d="M' + i * c + ' 0V' + B + 'M0 ' + i * c + 'H' + B + '" stroke="' + C['--grid'] + '"/>';
        Object.keys(walls).forEach(function (key) {
          var a = +key.split(':')[0], b = +key.split(':')[1], x = (a % n) * c, y = Math.floor(a / n) * c;
          o += b === a + 1
            ? '<path d="M' + (x + c) + ' ' + y + 'V' + (y + c) + '" stroke="' + C['--ink'] + '" stroke-width="5" stroke-linecap="round"/>'
            : '<path d="M' + x + ' ' + (y + c) + 'H' + (x + c) + '" stroke="' + C['--ink'] + '" stroke-width="5" stroke-linecap="round"/>';
        });
        function pt(i) { return [(i % n) * c + c / 2, Math.floor(i / n) * c + c / 2]; }
        if (flash) flash.forEach(function (f) { var q = pt(f); o += '<rect x="' + (q[0] - c / 2 + 3) + '" y="' + (q[1] - c / 2 + 3) + '" width="' + (c - 6) + '" height="' + (c - 6) + '" rx="6" fill="none" stroke="' + C['--error'] + '" stroke-width="3"/>'; });
        if (path.length > 1) o += '<polyline points="' + path.map(function (q) { return pt(q).join(','); }).join(' ') + '" fill="none" stroke="' + C['--primary'] +
          '" stroke-width="' + c * 0.42 + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>';
        else if (path.length === 1) { var q0 = pt(path[0]); o += '<circle cx="' + q0[0] + '" cy="' + q0[1] + '" r="' + c * 0.21 + '" fill="' + C['--primary'] + '" opacity="0.9"/>'; }
        var on = {}; path.forEach(function (q) { on[q] = 1; });
        p.w.forEach(function (w, k) {
          var q = pt(w), hit = on[w];
          o += wave(w, n, q[0], q[1], '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + c * 0.3 + '" fill="' + (hit ? C['--ink'] : C['--surface']) + '" stroke="' + C['--ink'] + '" stroke-width="2.4"/>' +
            '<text x="' + q[0] + '" y="' + (q[1] + c * 0.11) + '" text-anchor="middle" font-family="Mukta,sans-serif" font-weight="700" font-size="' + c * 0.32 + '" fill="' + (hit ? C['--surface'] : C['--ink']) + '">' + (k + 1) + '</text>');
        });
        if (path.length && !won) { var e = pt(path[path.length - 1]); o += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="' + c * 0.34 + '" fill="none" stroke="' + C['--accentLine'] + '" stroke-width="2.6"/>'; }
        return o;
      },
      label: function (i) { return 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1); },
      end: function (st) { var path = parse(st); return path.length ? path[path.length - 1] : -1; },
      canStep: canStep
    };
    return api;
  }

  // =====================================================================
  //  A puzzle page
  // =====================================================================
  function puzzlePage(mode) {
    var p = PUZ[mode];
    var g = mode === 'crowns' ? Crowns(p) : mode === 'suns' ? Suns(p) : Paths(p);
    var rec = saved[mode];
    var st = rec.st !== null && rec.st !== undefined && rec.st !== '' ? rec.st : g.blank();
    var undo = [], redo = [], elapsed = rec.t || 0, startedAt = null, ticker = null, flash = null, flashTimer = null, msgTimer = null;
    var boardEl = $('board'), svg;

    setText('title', NAMES[mode] + ' · ' + (TIER[p.k] || ''));
    if (fallback) setText('fallnote', 'This page holds the boards up to 15 March 2027, so here is that day. The app always has today’s page.');

    boardEl.innerHTML = '<svg viewBox="0 0 ' + B + ' ' + B + '" role="img" aria-label="' + NAMES[mode] + ' board, ' + g.n + ' by ' + g.n + '"></svg>';
    svg = boardEl.firstChild;

    function now() { return elapsed + (startedAt === null ? 0 : Date.now() - startedAt); }
    function tick() { setText('clock', fmt(now())); }
    function startClock() {
      if (rec.done || startedAt !== null) return;
      startedAt = Date.now();
      ticker = setInterval(tick, 500);
    }
    function stopClock() {
      if (startedAt !== null) { elapsed += Date.now() - startedAt; startedAt = null; }
      if (ticker) { clearInterval(ticker); ticker = null; }
      tick();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (startedAt !== null) { stopClock(); rec.t = elapsed; persist(); rec._paused = true; } }
      else if (rec._paused) { rec._paused = false; startClock(); }
    });

    function message(text) {
      var el = $('rule');
      clearTimeout(msgTimer);
      el.textContent = text; el.classList.remove('msg'); void el.offsetWidth; el.classList.add('msg');
      if (!rec.done) msgTimer = setTimeout(function () { el.textContent = RULE[mode]; el.classList.remove('msg'); }, 2000);
    }
    function render() {
      svg.innerHTML = g.draw(st, flash, rec.done) + burst();
      POP = null;
      setText('count', g.count(st));
      $('undo').disabled = rec.done || !undo.length;
      $('redo').disabled = rec.done || !redo.length;
      $('clear').disabled = rec.done || st === g.blank();
      $('check').disabled = rec.done;
    }
    var badTimer = null;
    function changed(cell) {
      if (cell >= 0 && !g.isPaths) POP = { cell: cell, kind: g.popKind };
      SHOWBAD = false;
      clearTimeout(badTimer);
      badTimer = setTimeout(function () {
        SHOWBAD = true;
        if (!rec.done && g.hasBad(st)) { sfx('conflict'); buzz(20); }
        render();
      }, 700);
    }
    function commit(next) {
      if (next === null || next === st) return false;
      undo.push(st); redo = [];
      st = next; rec.st = st;
      startClock();
      if (g.solved(st)) win(); else { rec.t = now(); persist(); }
      render();
      return true;
    }
    function win() {
      stopClock();
      clearTimeout(badTimer); SHOWBAD = true;
      sfx('solve'); buzz(30);
      rec.done = true; rec.t = elapsed; rec.st = st; persist();
      gc('solved-' + mode, 'Solved ' + NAMES[mode], true);
      if (allDone()) gc('page-complete', 'All three solved', true);
      var el = $('rule');
      el.textContent = 'Solved in ' + fmt(rec.t); el.classList.remove('msg'); void el.offsetWidth; el.classList.add('msg');
      showDone();
      celebrate();
    }
    function celebrate() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var t0 = null;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        ANIM = { ms: ts - t0 };
        render();
        if (ANIM.ms < 1260) requestAnimationFrame(frame); else { ANIM = null; render(); }
      }
      requestAnimationFrame(frame);
    }
    function showDone() {
      $('tools').hidden = true;
      $('more').hidden = false;
      var nx = nextOpen(mode), a = $('next');
      a.hidden = false;
      if (nx) { a.textContent = 'Next: ' + NAMES[nx]; a.href = ROOT + SLUG[nx] + '/'; }
      else { a.textContent = 'Today’s picture'; a.href = ROOT + '#picture'; }
    }

    // input
    function cellAt(ev) {
      var r = svg.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
      return Math.floor(y * g.n) * g.n + Math.floor(x * g.n);
    }
    if (g.isPaths) {
      // Paths input, ported from the app (session.dart _pathsTouch, pathsDragTo; F-007, F-026, F-042).
      var ENTER = 0.65, CUT_MARGIN = 0.25, CUT_REACH = 3, REFUSE_DEPTH = 0.5 + CUT_MARGIN;
      var line = function () { return g.parse(st); };
      var setLine = function (a) { st = a.join('.'); rec.st = st; };
      var gesture = null, dragFar = false, refusedAt = -1;
      var stepSound = function (a) {
        var end = a[a.length - 1];
        if (g.isNumber(end)) { sfx('waypoint'); buzz(12); }
        else { sfx('path_step_' + Math.min(5, Math.floor(a.length * 5 / g.cells) + 1)); buzz(6); }
      };
      // open | line | wall | pastEnd | wrongNumber
      var mayEnter = function (a, head, next) {
        if (a.indexOf(next) >= 0) return 'line';
        if (!g.canStep(head, next)) return 'wall';
        if (head === PUZ.paths.w[PUZ.paths.w.length - 1]) return 'pastEnd';
        var num = g.wpIndex(next);
        if (num < 0) return 'open';
        var reached = 0; a.forEach(function (c) { if (g.wpIndex(c) >= 0) reached++; });
        return num === reached ? 'open' : 'wrongNumber';
      };
      var canEnter = function (a, head, next, sayShut) {
        var e = mayEnter(a, head, next);
        if (e === 'open') return true;
        if (e !== 'wrongNumber' && !sayShut) return false;
        if (refusedAt !== next) { refusedAt = next; sfx('conflict'); buzz(20); }
        return false;
      };
      var cellOf = function (ev) {
        var r = svg.getBoundingClientRect();
        return { x: (ev.clientX - r.left) / r.width * g.n, y: (ev.clientY - r.top) / r.height * g.n };
      };
      boardEl.addEventListener('pointerdown', function (ev) {
        if (rec.done) return;
        var i = cellAt(ev); if (i < 0) return;
        if (AC && AC.state === 'suspended') AC.resume();
        try { boardEl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        gesture = st; refusedAt = -1;
        var a = line(), at = a.indexOf(i), n = g.n;
        if (at >= 0) {
          // a touch on the line cuts it back to that cell, however far back
          if (at < a.length - 1) { setLine(a.slice(0, at + 1)); sfx('path_back'); buzz(8); }
        } else {
          var head = a[a.length - 1], dr = Math.floor(i / n) - Math.floor(head / n), dc = i % n - head % n;
          if (Math.abs(dr) + Math.abs(dc) === 1 && canEnter(a, head, i, true)) { a.push(i); setLine(a); stepSound(a); }
        }
        var h = line()[line().length - 1];
        dragFar = line().indexOf(i) < 0 && (Math.abs(Math.floor(i / g.n) - Math.floor(h / g.n)) > 2 || Math.abs(i % g.n - h % g.n) > 2);
        startClock(); render();
        ev.preventDefault();
      });
      boardEl.addEventListener('pointermove', function (ev) {
        if (gesture === null || rec.done) return;
        var pos = cellOf(ev), x = pos.x, y = pos.y, n = g.n, a = line();
        var col = Math.floor(x), row = Math.floor(y);
        if (col >= 0 && row >= 0 && col < n && row < n) {
          var at = a.indexOf(row * n + col), inX = x - col, inY = y - row;
          var wellInside = inX >= CUT_MARGIN && inX <= 1 - CUT_MARGIN && inY >= CUT_MARGIN && inY <= 1 - CUT_MARGIN;
          if (at >= 0 && at < a.length - 1 && wellInside && a.length - 1 - at <= CUT_REACH) {
            setLine(a.slice(0, at + 1)); dragFar = false; sfx('path_back'); buzz(8); render();
            return;
          }
        }
        if (dragFar) return;
        var guard = 2 * n, moved = false;
        while (guard-- > 0) {
          a = line();
          var head = a[a.length - 1];
          var dx = x - (head % n + 0.5), dy = y - (Math.floor(head / n) + 0.5);
          var wantsX = Math.abs(dx) >= ENTER, wantsY = Math.abs(dy) >= ENTER;
          if (!wantsX && !wantsY) break;
          var towards = function (horizontal) {
            if (horizontal) { var c = head % n + (dx > 0 ? 1 : -1); return c < 0 || c >= n ? null : head + (dx > 0 ? 1 : -1); }
            var r2 = Math.floor(head / n) + (dy > 0 ? 1 : -1); return r2 < 0 || r2 >= n ? null : head + (dy > 0 ? n : -n);
          };
          var first = Math.abs(dx) >= Math.abs(dy), wanted = [];
          [first, !first].forEach(function (hz) { if (hz ? wantsX : wantsY) { var t = towards(hz); if (t !== null) wanted.push(t); } });
          var stepped = false;
          for (var k = 0; k < wanted.length; k++) {
            var next = wanted[k];
            if (a.length > 1 && next === a[a.length - 2]) { a.pop(); setLine(a); sfx('path_back'); buzz(8); stepped = true; break; }
            if (mayEnter(a, head, next) === 'open') { a.push(next); setLine(a); stepSound(a); refusedAt = -1; stepped = true; break; }
          }
          if (stepped) { moved = true; continue; }
          if (wanted.length) {
            var depth = Math.abs(wanted[0] - head) === 1 ? Math.abs(dx) : Math.abs(dy);
            canEnter(a, head, wanted[0], depth >= REFUSE_DEPTH);
          }
          break;
        }
        if (moved) render();
      });
      var endDrag = function () {
        if (gesture === null) return;
        var before = gesture; gesture = null; dragFar = false;
        if (st !== before) {
          undo.push(before); redo = [];
          if (g.solved(st)) win(); else { rec.t = now(); persist(); }
          render();
        }
      };
      boardEl.addEventListener('pointerup', endDrag);
      boardEl.addEventListener('pointercancel', endDrag);
    } else {
      var down = -1, gestureStart = null, painting = false, erasing = false, lastTap = { cell: -1, ms: 0 };
      var paint = function (c) {
        var v = st.charAt(c);
        if (erasing ? v !== '1' : v !== '0') return;
        st = st.slice(0, c) + (erasing ? '0' : '1') + st.slice(c + 1);
        sfx(erasing ? 'ui_tap' : 'mark'); buzz(6);
        changed(c); render();
      };
      boardEl.addEventListener('pointerdown', function (ev) {
        if (rec.done) return;
        var i = cellAt(ev); if (i < 0) return;
        down = i; gestureStart = st; painting = false;
        try { boardEl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        if (AC && AC.state === 'suspended') AC.resume();
        ev.preventDefault();
      });
      boardEl.addEventListener('pointermove', function (ev) {
        if (down < 0 || mode !== 'crowns') return;
        var i = cellAt(ev); if (i < 0) return;
        if (!painting && i !== down && st.charAt(down) !== '2') {
          painting = true; erasing = st.charAt(down) === '1';
          paint(down);
        }
        if (painting) paint(i);
      });
      var up = function (ev) {
        if (down < 0) return;
        var cell = down; down = -1;
        if (ev.type === 'pointerup' && !painting) {
          var t = Date.now();
          if (!(cell === lastTap.cell && t - lastTap.ms < 60)) { // debounce, as the app
            lastTap = { cell: cell, ms: t };
            var nx = g.tap(st, cell);
            if (nx !== st) { st = nx; sfx(g.kind(st.charAt(cell))); buzz(8); changed(cell); }
          }
        }
        painting = false;
        if (st !== gestureStart) {
          undo.push(gestureStart); redo = [];
          rec.st = st; startClock();
          if (g.solved(st)) win(); else { rec.t = now(); persist(); }
        }
        render();
      };
      boardEl.addEventListener('pointerup', up);
      boardEl.addEventListener('pointercancel', up);
    }
    // keyboard: arrows move a focus ring, Space / Enter acts (Crowns, Suns & Moons)
    boardEl.tabIndex = 0;
    boardEl.addEventListener('keydown', function (ev) {
      if (rec.done || g.isPaths) return;
      var f = boardEl._f || 0, n = g.n;
      if (ev.key === 'ArrowRight') f = Math.min(n * n - 1, f + 1);
      else if (ev.key === 'ArrowLeft') f = Math.max(0, f - 1);
      else if (ev.key === 'ArrowDown') f = Math.min(n * n - 1, f + n);
      else if (ev.key === 'ArrowUp') f = Math.max(0, f - n);
      else if (ev.key === ' ' || ev.key === 'Enter') { commit(g.tap(st, f)); }
      else return;
      boardEl._f = f; ev.preventDefault();
      render();
      var c = B / n;
      svg.innerHTML += '<rect x="' + ((f % n) * c + 2) + '" y="' + (Math.floor(f / n) * c + 2) + '" width="' + (c - 4) + '" height="' + (c - 4) + '" rx="6" fill="none" stroke="' + C['--accentLine'] + '" stroke-width="3"/>';
      boardEl.setAttribute('aria-label', g.label(f));
    });

    $('undo').onclick = function () { if (!undo.length) return; redo.push(st); st = undo.pop(); rec.st = st; persist(); render(); };
    $('redo').onclick = function () { if (!redo.length) return; undo.push(st); st = redo.pop(); rec.st = st; persist(); if (g.solved(st)) win(); render(); };
    $('clear').onclick = function () { if (commit(g.blank())) { sfx('clear'); message('Cleared · Undo brings it back'); } };
    var soundBtn = $('sound');
    var showSound = function () {
      soundBtn.classList.toggle('off', !SOUND);
      soundBtn.querySelector('span').textContent = SOUND ? 'Sound' : 'Muted';
      soundBtn.setAttribute('aria-pressed', String(SOUND));
    };
    soundBtn.onclick = function () {
      SOUND = !SOUND;
      try { localStorage.setItem('lt-sound', SOUND ? '1' : '0'); } catch (e) { /* ignore */ }
      showSound(); if (SOUND) sfx('ui_tap');
    };
    showSound();
    loadSounds(ROOT);
    $('check').onclick = function () {
      var w = g.wrong(st);
      clearTimeout(flashTimer);
      if (!w.length) { sfx('check_ok'); message('All good so far'); return; }
      sfx('check_bad'); buzz(20);
      flash = w.slice(0, 3);
      message(w.length === 1 ? '1 cell is wrong' : w.length + ' cells are wrong');
      render();
      flashTimer = setTimeout(function () { flash = null; render(); }, 2000);
    };

    if (rec.done) {
      $('rule').textContent = 'Solved in ' + fmt(rec.t); $('rule').classList.add('msg');
      showDone();
    } else {
      $('rule').textContent = RULE[mode];
    }
    tick();
    render();
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { readColours(); render(); });
  }

  // =====================================================================
  //  Today's page and the complete view
  // =====================================================================
  // ---------- the front page (row H, his "all ok but show the board filled like half", 25 Nov)
  // The small boards are YESTERDAY's, about half solved: today's half-filled would give away today's answers.
  var TAG = { crowns: 'One crown in every row, column and colour', suns: 'Balance suns and moons in every line', paths: 'One line through every number and cell' };
  function thumb(mode, p) {
    var n = p.n, c = B / n, o = '', i, k, ink = C['--ink'], grid = C['--grid'];
    var lines = function () { var s = ''; for (var j = 1; j < n; j++) s += '<path d="M' + j * c + ' 0V' + B + 'M0 ' + j * c + 'H' + B + '" stroke="' + grid + '" stroke-width="2"/>'; return s; };
    if (mode === 'crowns') {
      var reg = [], sol = [];
      for (i = 0; i < n * n; i++) reg.push(parseInt(p.g.charAt(i), 36));
      for (i = 0; i < n; i++) sol.push(parseInt(p.s.charAt(i), 36));
      for (i = 0; i < n * n; i++) o += '<rect x="' + (i % n) * c + '" y="' + Math.floor(i / n) * c + '" width="' + (c + 0.5) + '" height="' + (c + 0.5) + '" fill="' + C.regions[reg[i] % 10] + '"/>';
      o += lines();
      for (i = 0; i < n * n; i++) {
        var x = (i % n) * c, y = Math.floor(i / n) * c;
        if (i % n < n - 1 && reg[i] !== reg[i + 1]) o += '<path d="M' + (x + c) + ' ' + y + 'V' + (y + c) + '" stroke="' + ink + '" stroke-width="7" stroke-linecap="round"/>';
        if (Math.floor(i / n) < n - 1 && reg[i] !== reg[i + n]) o += '<path d="M' + x + ' ' + (y + c) + 'H' + (x + c) + '" stroke="' + ink + '" stroke-width="7" stroke-linecap="round"/>';
      }
      var half = Math.ceil(n / 2), crowns = [];
      for (i = 0; i < half; i++) crowns.push(i * n + sol[i]);
      for (i = 0; i < n * n; i++) {
        var cx = (i % n) * c + c / 2, cy = Math.floor(i / n) * c + c / 2;
        if (crowns.indexOf(i) >= 0) o += crownSvg(cx, cy, c * 1.15, ink); // crowns only: x marks are noise at this size
      }
    } else if (mode === 'suns') {
      for (i = 0; i < n * n; i++) if (p.g.charAt(i) !== '.') o += '<rect x="' + (i % n) * c + '" y="' + Math.floor(i / n) * c + '" width="' + c + '" height="' + c + '" fill="' + C['--given'] + '"/>';
      o += lines();
      var upTo = Math.floor(n / 2) * n;
      for (i = 0; i < n * n; i++) {
        var sx = (i % n) * c + c / 2, sy = Math.floor(i / n) * c + c / 2;
        var v = p.g.charAt(i) === 'S' ? '0' : p.g.charAt(i) === 'M' ? '1' : (i < upTo ? p.s.charAt(i) : null);
        if (v === '0') o += sunSvg(sx, sy, c * 1.1); else if (v === '1') o += moonSvg(sx, sy, c * 1.1, 'tm' + i);
      }
    } else {
      o += lines();
      var parts = p.s.split(':'), cell = +parts[0], path = [cell], steps = Math.round(parts[1].length * 0.45);
      for (k = 0; k < steps; k++) { var d = parts[1].charAt(k); cell += d === 'R' ? 1 : d === 'L' ? -1 : d === 'D' ? n : -n; path.push(cell); }
      var pt = function (q) { return [(q % n) * c + c / 2, Math.floor(q / n) * c + c / 2]; };
      o += '<polyline points="' + path.map(function (q) { return pt(q).join(','); }).join(' ') + '" fill="none" stroke="' + C['--primary'] + '" stroke-width="' + c * 0.42 + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>';
      p.w.forEach(function (w, j) {
        var q = pt(w), hit = path.indexOf(w) >= 0;
        o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + c * 0.32 + '" fill="' + (hit ? ink : C['--surface']) + '" stroke="' + ink + '" stroke-width="5"/>' +
          '<text x="' + q[0] + '" y="' + (q[1] + c * 0.12) + '" text-anchor="middle" font-family="Mukta,sans-serif" font-weight="700" font-size="' + c * 0.36 + '" fill="' + (hit ? C['--surface'] : ink) + '">' + (j + 1) + '</text>';
      });
    }
    return '<svg viewBox="0 0 ' + B + ' ' + B + '" aria-hidden="true">' + o + '</svg>';
  }
  function homePage() {
    setText('date', dateLong());
    if (fallback) setText('fallnote', 'This page holds the boards up to 15 March 2027, so here is that day. The app always has today’s page.');
    var keys = Object.keys(DAYS.d).sort(), at = keys.indexOf(dayKey);
    var prev = DAYS.d[keys[Math.max(0, at - 1)]];
    var tick = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    var chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
    $('cards').innerHTML = MODES.map(function (m, j) {
      var p = PUZ[m], d = saved[m].done;
      return '<a class="pcard" href="' + SLUG[m] + '/"><span class="thumb">' + thumb(m, prev.p[j]) + '</span><span class="t"><span class="nm disp">' + NAMES[m] +
        '</span><span class="tag">' + TAG[m] + '</span><span class="meta"><span class="chip">' + (TIER[p.k] || '') + ' · ' + p.n + '×' + p.n + '</span></span></span><span class="end">' +
        (d ? '<span class="ok">' + tick + '</span><b>' + fmt(saved[m].t) + '</b>' : chev) + '</span></a>';
    }).join('');
    var nx = nextOpen(), main = $('play');
    if (nx) { main.textContent = 'Play: ' + NAMES[nx]; main.href = SLUG[nx] + '/'; }
    else { main.textContent = 'Today’s picture'; main.href = '#picture'; }
    // a new picture every day: the last six, then today's
    var shown = [], j2;
    for (j2 = at - 1; j2 >= 0 && shown.length < 6; j2--) if (DAYS.d[keys[j2]].pic) shown.unshift(keys[j2]);
    var all = allDone();
    if (!shown.length && !day.pic) { $('pics').hidden = true; }
    else {
      var cells = shown.map(function (k) {
        var pc = DAYS.d[k].pic, dd = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)), lab;
        try { lab = dd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (e) { lab = k.slice(8); }
        return '<div class="day"><span class="pt"><img src="pictures/day_' + pc.key + '.png" alt="' + pc.name + '" loading="lazy"></span><small>' + lab + '</small></div>';
      });
      if (day.pic) cells.push('<div class="day today"><span class="pt">' + (all ? '<img src="pictures/day_' + day.pic.key + '.png" alt="' + day.pic.name + '">' : '?') + '</span><small>Today</small></div>');
      $('strip').style.gridTemplateColumns = 'repeat(' + cells.length + ',1fr)';
      $('strip').innerHTML = cells.join('');
      setText('picsline', !day.pic ? 'Collect every day’s picture in the app.' : all ? 'Today’s is ' + day.pic.name + '. Collect them all in the app.' : 'Solve all three to reveal today’s.');
    }
    route();
  }
  function completeView() {
    var pic = day.pic;
    var img = $('picimg');
    if (pic) {
      img.src = 'pictures/day_' + pic.key + '.png'; img.alt = pic.name;
      setText('picname', pic.name); setText('fact', pic.fact);
    } else {
      img.src = '../icon-512.png'; img.alt = 'Logic Trio';
      setText('picname', 'Page complete'); setText('fact', 'All three of today’s puzzles, solved.');
    }
    $('times').innerHTML = MODES.map(function (m) { return '<div>' + tile(m, true) + fmt(saved[m].t) + '</div>'; }).join('');
  }
  function route() {
    var showPic = location.hash === '#picture' && allDone();
    $('home').hidden = showPic;
    $('complete').hidden = !showPic;
    if (showPic) { completeView(); window.scrollTo(0, 0); }
  }
  function shareText() {
    var e = { crowns: '👑', suns: '☀️', paths: '〰️' };
    return 'Logic Trio · ' + dateShort() + '\n' + MODES.map(function (m) { return e[m] + ' ' + fmt(saved[m].t); }).join('  ') + '\n' + SITE;
  }
  function wireShare() {
    var b = $('share'); if (!b) return;
    b.onclick = function () {
      gc('share', 'Share result', true);
      var text = shareText();
      if (navigator.share) { navigator.share({ text: text }).catch(function () { /* closed */ }); return; }
      var done = function () { setText('tomorrow', 'Copied · paste it anywhere'); setTimeout(function () { setText('tomorrow', 'New puzzles at midnight'); }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { /* blocked */ });
    };
    $('close').onclick = function () { history.replaceState(null, '', location.pathname); route(); };
  }

  // ---------- go
  readColours();
  if (/[?&]selftest/.test(location.search)) window.LT_TEST = { Crowns: Crowns, Suns: Suns, Paths: Paths };
  var links = document.querySelectorAll('a[data-play]');
  for (var i = 0; i < links.length; i++) {
    (function (a) {
      var camp = (SRC ? SRC + '_' : '') + a.getAttribute('data-play');
      a.href = PLAY + camp;
      a.addEventListener('click', function () { gc('app-' + camp, 'App button', true); });
    })(links[i]);
  }
  gc(location.pathname, document.title, false);
  if (VIEW === 'home') { homePage(); wireShare(); window.addEventListener('hashchange', route); }
  else puzzlePage(VIEW);
})();
