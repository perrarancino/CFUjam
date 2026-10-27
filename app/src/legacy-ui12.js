/* CFU Game Jam — плавные анимации интерфейса, карусель и «камера» между страницами */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var body = document.body;
  function anim() { return !body.classList.contains('noanim'); }

  /* ================= появление блоков ================= */
  var SEL = '.gal-head>*,.stage,.gal-steps li,.count>div,.facts>div,.big,.news,.card,.prof,.gcard,.vb-in>*,.empty';
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    var k = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target, d = k++ * 85;
      io.unobserve(el);
      el.style.setProperty('--rd', d + 'ms');
      requestAnimationFrame(function () { el.classList.add('in'); });
      setTimeout(function () { el.classList.remove('rv', 'in'); el.style.removeProperty('--rd'); }, 1400 + d);
    });
  }, { threshold: .1, rootMargin: '0px 0px -5% 0px' }) : null;

  function countUp(view) {
    $$('.facts b', view).forEach(function (b) {
      var src = b.dataset.t || (b.dataset.t = b.textContent), m = src.match(/^(\d+)(.*)$/);
      if (!m) return;
      var to = +m[1], suf = m[2], t0 = performance.now();
      b.textContent = '0' + suf;
      (function f(now) {
        var p = Math.min(1, (now - t0) / 1500), e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(to * e) + suf;
        if (p < 1) requestAnimationFrame(f);
      })(t0);
    });
  }
  var ioFacts = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { ioFacts.unobserve(en.target); countUp(en.target.closest('.view')); } });
  }, { threshold: .4 }) : null;

  /* на переключении страниц элементы больше не анимируются поодиночке: только общий переход */
  function play(view) {
    if (view && !view.classList.contains('play')) view.classList.add('play');
  }
  window.CFU_play = play;

  /* ================= «пружинная» физика наведения ================= */
  var TILT = '.gcard,.prof,.big,.card.link', BTN = '.btn,.wide,.icbtn,.tag[role=button]', SLIDE = '.slide .in';
  var P = {
    tilt: { rx: 0, ry: 0, tx: 0, ty: -8, tz: 0, sc: 1 },
    btn: { rx: 0, ry: 0, tx: 0, ty: -2, tz: 0, sc: 1 },
    slide: { rx: 5, ry: 7, tx: 10, ty: 10, tz: 190, sc: 1.32 }
  };
  var ST = new Map(), loopOn = false, lastT = 0, PX = null, PY = null;
  function overEl(el) { if (PX === null) return false; var t = document.elementFromPoint(PX, PY); return !!t && el.contains(t); }
  function kind(el) { return el.matches(SLIDE) ? 'slide' : el.matches(BTN) ? 'btn' : 'tilt'; }
  function hold(el) {
    var s = ST.get(el);
    if (!s) {
      s = { el: el, k: kind(el), press: false, v: { rx: 0, ry: 0, tx: 0, ty: 0, tz: 0, sc: 1 }, t: { rx: 0, ry: 0, tx: 0, ty: 0, tz: 0, sc: 1 } };
      ST.set(el, s); el.classList.add('hv');
      if (s.k === 'slide') aim(s, .5, .5);
      if (!loopOn) { loopOn = true; lastT = performance.now(); requestAnimationFrame(tick); }
    }
    return s;
  }
  function aim(s, x, y) {
    var p = P[s.k], t = s.t, btn = s.k === 'btn';
    t.rx = btn ? 0 : (.5 - y) * p.rx * 2;
    t.ry = btn ? 0 : (x - .5) * p.ry * 2 + (s.k === 'slide' && window.CFU_slideAngle ? -window.CFU_slideAngle(s.el.parentNode) * .94 : 0);
    t.tx = (x - .5) * p.tx * 2;
    t.ty = btn ? p.ty + (s.press ? 3 : 0) : (s.k === 'slide' ? (y - .5) * p.ty * 2 : p.ty);
    t.tz = p.tz; t.sc = p.sc;
  }
  window.CFU_hold = hold;
  function rest(s) { var t = s.t; t.rx = t.ry = t.tx = t.ty = t.tz = 0; t.sc = 1; }
  function tick(now) {
    var dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    ST.forEach(function (s, el) {
      var hovered = overEl(el) && !body.classList.contains('camming') && anim();
      if (!hovered) rest(s);
      var k = 1 - Math.exp(-dt * (hovered ? (s.k === 'slide' ? 6.2 : 9) : 4.2)), settled = true, v = s.v, t = s.t;
      for (var key in v) { v[key] += (t[key] - v[key]) * k; if (Math.abs(t[key] - v[key]) > (key === 'sc' ? .0006 : .015)) settled = false; }
      if (!hovered && settled) {
        el.classList.remove('hv');
        ['--rx', '--ry', '--tx', '--ty', '--tz', '--sc'].forEach(function (n) { el.style.removeProperty(n); });
        ST.delete(el); return;
      }
      var st = el.style;
      st.setProperty('--rx', v.rx.toFixed(3) + 'deg'); st.setProperty('--ry', v.ry.toFixed(3) + 'deg');
      st.setProperty('--tx', v.tx.toFixed(2) + 'px'); st.setProperty('--ty', v.ty.toFixed(2) + 'px');
      st.setProperty('--tz', v.tz.toFixed(1) + 'px'); st.setProperty('--sc', v.sc.toFixed(4));
    });
    if (ST.size) requestAnimationFrame(tick); else loopOn = false;
  }
  if (window.matchMedia && matchMedia('(hover:hover)').matches) {
    document.addEventListener('pointerover', function (e) {
      if (!anim() || body.classList.contains('camming') || !e.target.closest) return;
      [TILT, BTN, SLIDE].forEach(function (sel) {
        var el = e.target.closest(sel);
        if (el && !el.classList.contains('rv') && !el.disabled) hold(el);
      });
    }, true);
    document.addEventListener('pointermove', function (e) { PX = e.clientX; PY = e.clientY; }, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', function () { PX = null; PY = null; });
    document.addEventListener('pointermove', function (e) {
      if (!anim() || body.classList.contains('camming') || !e.target.closest) return;
      [TILT, BTN, SLIDE].forEach(function (sel) {
        var el = e.target.closest(sel); if (!el) return;
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (x * 100) + '%'); el.style.setProperty('--my', (y * 100) + '%');
        var s = ST.get(el); if (s) aim(s, Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
      });
    }, { passive: true });
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest(BTN), s = el && ST.get(el);
      if (s) { s.press = true; s.t.ty = P.btn.ty + 3; }
    }, true);
    document.addEventListener('pointerup', function () {
      ST.forEach(function (s) { if (s.press) { s.press = false; s.t.ty = P[s.k].ty; } });
    }, true);
  }

  /* ================= волна от нажатия ================= */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn,.wide,.icbtn');
    if (!b || !anim()) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, d = document.createElement('span');
    d.className = 'rip';
    d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(d); setTimeout(function () { d.remove(); }, 700);
  });

  /* ================= 3D-карусель ================= */
  (function () {
    var stage = $('.stage'), ring = $('.ring');
    if (!stage || !ring) return;
    var MOB = window.matchMedia && matchMedia('(max-width:700px)').matches;
    if (MOB) {
      $$('.slide', ring).forEach(function (s, i) { if (i % 2) s.remove(); else s.style.setProperty('--i', i / 2); });
      stage.style.setProperty('--step', '18deg'); stage.style.setProperty('--R', 'calc(var(--w) * 3.45)');
    }
    var slides = $$('.slide', ring), N = slides.length, step = 360 / N;
    var angle = 0, vel = 4.2, AUTO = 4.2, dragging = false, hov = false, lastX = 0, lastTm = 0, moved = 0;
    function paused() { return body.classList.contains('nosnow'); }
    stage.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; lastX = e.clientX; lastTm = performance.now(); stage.classList.add('grab');
      if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (x) {} }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, now = performance.now(), dt = Math.max(1, now - lastTm);
      moved += Math.abs(dx); angle -= dx * .2; vel = vel * .6 + .4 * (dx * .2 / dt * 1000); lastX = e.clientX; lastTm = now;
    });
    function end(e) {
      if (!dragging) return; dragging = false; stage.classList.remove('grab');
      if (moved < 6 && e.target.closest && e.target.closest('.slide')) { var l = $('.tabsnav [data-go=games]'); if (l) l.click(); }
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    var frameNo = 0;
    function probe() {
      if (PX === null || dragging) { hov = false; return; }
      var el = document.elementFromPoint(PX, PY), inn = el && el.closest && el.closest('.slide .in');
      hov = !!inn;
      if (inn && !inn.classList.contains('hv') && window.CFU_hold && anim() && !body.classList.contains('camming')) window.CFU_hold(inn);
    }
    var angles = new Array(N), dcache = new Array(N);
    window.CFU_slideAngle = function (s) { var i = slides.indexOf(s); return i < 0 ? 0 : angles[i]; };
    var last = performance.now(), visible = true, running = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      }, { rootMargin: '120px' }).observe(stage);
    }
    function frame(now) {
      if (!visible || !stage.offsetParent || document.hidden) { running = false; return; }
      if (MOB && (frameNo & 1)) { frameNo++; requestAnimationFrame(frame); return; }
      var dt = Math.min(.25, (now - last) / 1000); last = now;
      if ((frameNo++ & 3) === 0) probe();
      if (!dragging) {
        var target = (paused() || hov) ? 0 : AUTO;
        vel += (target - vel) * Math.min(1, dt * (Math.abs(vel) > 12 ? 1.5 : 2.4));
        angle -= vel * dt;
      }
      ring.style.transform = 'rotateY(' + angle.toFixed(3) + 'deg)';
      for (var i = 0; i < N; i++) {
        var a = ((i * step + angle) % 360 + 540) % 360 - 180, d = Math.min(1, Math.abs(a) / 75);
        angles[i] = a;
        if (!window.CFU_NODIM && (dcache[i] === undefined || Math.abs(d - dcache[i]) > .012)) { dcache[i] = d; slides[i].style.setProperty('--d', d.toFixed(2)); }
      }
      requestAnimationFrame(frame);
    }
    running = true; requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !running && visible) { running = true; last = performance.now(); requestAnimationFrame(frame); } });
    window.CFU_wakeCarousel = function () { if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  })();

  /* ================= переход между страницами =================
     Страницы никуда не переносятся: main гаснет, пока невидимо меняется вкладка и прокрутка, затем проявляется.
     Анимируется только прозрачность одного элемента — без пересчёта вёрстки, поэтому без рывков. */
  var cam = null;
  var MOBILE = window.matchMedia && matchMedia('(max-width:700px)').matches;
  function camSwap(st) {
    if (st.swapped) return;
    st.swapped = true;
    st.done();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function camFinish() {
    if (!cam) return;
    var st = cam; cam = null;
    clearTimeout(st.t1); clearTimeout(st.t2);
    st.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    camSwap(st);
    body.classList.remove('camming');
  }
  window.CFU_camFinish = camFinish;
  window.CFU_camBusy = function () { return !!cam; };
  window.CFU_cam = function (cur, nxt, dir, done) {
    camFinish();
    var main = cur.parentNode, st = { done: done, swapped: false, anims: [] };
    cam = st; body.classList.add('camming');
    /* страховка: если вкладка в фоне и анимации не идут, всё равно переключаем */
    st.t1 = setTimeout(function () { if (cam === st) camSwap(st); }, 450);
    st.t2 = setTimeout(function () { if (cam === st) camFinish(); }, 1300);
    var out = main.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOBILE ? 130 : 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    st.anims.push(out);
    out.onfinish = function () {
      if (cam !== st) return;
      camSwap(st);
      var inn = main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOBILE ? 260 : 340, easing: 'cubic-bezier(0,0,.2,1)', fill: 'forwards' });
      st.anims.push(inn);
      inn.onfinish = function () {
        if (cam !== st) return;
        cam = null; st.anims.forEach(function (x) { try { x.cancel(); } catch (e) {} });
        body.classList.remove('camming');
      };
    };
  };

  /* заранее подгружаем картинки остальных страниц, чтобы поворот не «мигал» */
  setTimeout(function () {
    if ((navigator.connection && navigator.connection.saveData) || innerWidth < 900) return;   /* на телефонах чужие вкладки заранее не грузим */
    $$('.view[hidden] img').forEach(function (i) { var im = new Image(), ss = i.getAttribute('srcset'), src = i.currentSrc || i.getAttribute('src');
      if (ss) { var best = null; ss.split(',').forEach(function (c) { var p = c.trim().split(/\s+/), w = parseInt(p[1], 10) || 0; if (!best || (w >= 480 && (best.w < 480 || w < best.w)) || (best.w < 480 && w > best.w)) best = { u: p[0], w: w }; }); if (best) src = best.u; }
      im.src = src; });
    $$('[style*="--img"]').forEach(function (e) {
      var m = (e.getAttribute('style') || '').match(/url\(([^)]+)\)/); if (m) { var im = new Image(); im.src = m[1]; }
    });
  }, 900);

  if (window.matchMedia && matchMedia('(max-width:700px)').matches) {
    $$('[style*="--img"]').forEach(function (e) { e.setAttribute('style', e.getAttribute('style').replace(/url\(([^)]*?)img\/(w\d+\.jpg)\)/g, 'url($1img/m/$2)')); });
  }

  /* первый показ активной вкладки */
  play($('.view:not([hidden])'));
})();
