/* CFU Game Jam — волна между вкладками: плитки-«пиксели» с градиентами в палитре сайта выпрыгивают волной, за волной уже новая страница.
   Оптимизация: градиент и грани плиток рисуются один раз в заготовку; каждый кадр — по одному drawImage на плитку и только для плиток в полосе волны. */
(function () {
  'use strict';
  var body = document.body;
  window.CFU_NODIM = true;                        /* карусели не нужно пересчитывать затемнение слайдов каждый кадр */
  var pt = { x: innerWidth / 2, y: 40, t: 0 };
  var cur = null;
  var P = {
    cream: '#fff6e5', sun: '#ffc933', coral: '#ff5a4f',
    teal: '#19b5a5', sky: '#4aa3ff', lilac: '#a78bfa'
  };
  /* палитра сайта: у каждой плитки свой мягкий градиент из соседних цветов */
  var PAL = [P.teal, P.sky, P.lilac, P.coral, P.sun, P.cream].map(function (hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  });
  function tone(u) {
    u = Math.max(0, Math.min(1, u));
    var x = u * (PAL.length - 1), i = Math.min(PAL.length - 2, Math.floor(x)), f = x - i, a = PAL[i], b = PAL[i + 1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function paintTiles(g, cols, rows, s, cells) {
    cells.forEach(function (c) {
      var x = c.ci * s, y = c.cj * s;
      var u = .02 + .9 * (c.ci / (cols - 1) * .56 + (1 - c.cj / (rows - 1)) * .44) + (c.n - .5) * .08;
      var v = Math.min(1, u + .12 + c.n * .06);
      var gr = g.createLinearGradient(x, y + s, x + s, y);
      gr.addColorStop(0, tone(u));
      gr.addColorStop(1, tone(v));
      g.fillStyle = gr;
      g.fillRect(x, y, s, s);
    });
    var bv = Math.max(2, Math.round(s * .09));
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var px = i * s, py = j * s;
      g.fillStyle = 'rgba(255,246,229,.28)'; g.fillRect(px, py, s, bv);
      g.fillStyle = 'rgba(31,42,68,.22)'; g.fillRect(px, py + s - bv, s, bv);
      g.fillStyle = 'rgba(255,246,229,.12)'; g.fillRect(px, py, bv, s);
      g.fillStyle = 'rgba(31,42,68,.12)'; g.fillRect(px + s - bv, py, bv, s);
    }
  }

  document.addEventListener('pointerdown', function (e) { pt = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
  document.addEventListener('keydown', function () { pt = { x: innerWidth / 2, y: 40, t: 0 }; }, true);

  function easeOutBack(p) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }

  function swap(st) {
    if (st.swapped) return;
    st.swapped = true;
    st.done();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function finish(st) {
    if (!st || st.over) return;
    st.over = true;
    clearTimeout(st.t2);
    if (st.raf) cancelAnimationFrame(st.raf);
    swap(st);
    if (st.cv && st.cv.parentNode) st.cv.parentNode.removeChild(st.cv);
    if (st.old && st.old.parentNode) st.old.parentNode.removeChild(st.old);
    body.classList.remove('camming');
    if (cur === st) cur = null;
  }
  window.CFU_camFinish = function () { finish(cur); };
  window.CFU_camBusy = function () { return !!cur; };

  window.CFU_cam = function (from, to, dir, done) {
    finish(cur);

    var W = innerWidth, H = innerHeight, mobile = W < 700;
    /* «лёгкий» режим для телефонов и слабых устройств: крупные плитки, без снимка старой страницы и без поворотов */
    var LITE = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    var s = LITE ? (mobile ? Math.round(W / 9) : Math.max(52, Math.round(W / 26))) : Math.max(36, Math.round(W / 40));
    var cols = Math.ceil(W / s) + 1, rows = Math.ceil(H / s) + 1;
    var fresh = pt.t && performance.now() - pt.t < 1200;
    var ox = fresh ? pt.x : W / 2, oy = fresh ? pt.y : 40;

    /* волна: из точки клика, по горизонтали, по вертикали или по диагонали */
    var mode = fresh && Math.random() < .5 ? 0 : 1 + Math.floor(Math.random() * 3);
    var sx = Math.random() < .5 ? 1 : -1, sy = Math.random() < .5 ? 1 : -1;
    var wx = mode === 1 ? 1 : mode === 3 ? .7 : 0, wy = mode === 2 ? 1 : mode === 3 ? .9 : 0;
    var nrm = Math.hypot(wx, wy) || 1;
    function dist(x, y) {
      if (mode === 0) return Math.hypot(x - ox, y - oy);
      return (sx > 0 ? x : W - x) * wx + (sy > 0 ? y : H - y) * wy;
    }
    var ang = Math.atan2(sx * wx, -(sy * wy)) * 180 / Math.PI;      /* направление волны для маски */

    var offX = (W - cols * s) / 2, offY = (H - rows * s) / 2;
    var cells = [], maxD = 0, i, j;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var cx = offX + i * s + s / 2, cy = offY + j * s + s / 2, d = dist(cx, cy);
      if (d > maxD) maxD = d;
      cells.push({ ci: i, cj: j, cx: cx, cy: cy, d: d, n: hash(i, j), dir: (i + j) % 2 ? 1 : -1 });
    }
    var SP = LITE ? 230 : 340, NZ = 40, GROW = LITE ? 70 : 80, HOLD = 40, SHR = LITE ? 80 : 90;   /* HOLD >= NZ, иначе старая страница мелькнёт */
    var LIFE = GROW + HOLD + SHR, TOTAL = LITE ? SP + NZ + GROW + 20 + SP + NZ + SHR : SP + NZ + LIFE;
    var TSWAP = SP + NZ + GROW + 10;                  /* лёгкий режим: экран закрыт целиком — меняем страницу */
    cells.forEach(function (c) { c.dl = c.d / maxD * SP + c.n * NZ; });
    cells.sort(function (a, b) { return a.dl - b.dl; });

    /* заготовка: у каждой плитки свой градиент в цветах сайта и объёмные грани — рисуется один раз */
    var big = document.createElement('canvas'); big.width = cols * s; big.height = rows * s;
    paintTiles(big.getContext('2d'), cols, rows, s, cells);

    /* старая страница остаётся «снимком» поверх новой и пропадает за волной */
    var oldWrap = null, mainEl = from.parentNode;
    if (!LITE) try {
      var r = mainEl.getBoundingClientRect(), mc = mainEl.cloneNode(false), vc = from.cloneNode(true), cs = getComputedStyle(body);
      mc.removeAttribute('id');
      [].forEach.call(vc.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
      [].forEach.call(vc.querySelectorAll('.hv'), function (n) { n.classList.remove('hv'); });
      vc.hidden = false;
      mc.style.cssText = 'position:absolute;margin:0;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;box-sizing:border-box';
      mc.appendChild(vc);
      oldWrap = document.createElement('div');
      oldWrap.setAttribute('aria-hidden', 'true');
      oldWrap.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;overflow:hidden;z-index:40;pointer-events:none;background-color:' + cs.backgroundColor + ';background-image:' + cs.backgroundImage + ';background-size:' + cs.backgroundSize;
      oldWrap.appendChild(mc);
      document.body.appendChild(oldWrap);
    } catch (e) { oldWrap = null; }

    var cv = document.createElement('canvas'), dpr = mobile ? 1 : Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:9999;pointer-events:none';
    document.body.appendChild(cv);
    var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;

    var st = { done: done, swapped: false, over: false, cv: cv, old: oldWrap, raf: 0 };
    cur = st; body.classList.add('camming');
    if (!LITE) swap(st);                         /* новая страница уже лежит под волной */
    st.t2 = setTimeout(function () { if (cur === st) finish(st); }, TOTAL + 800);

    var lastD = -1e9;
    function setMask(D) {
      if (!oldWrap || Math.abs(D - lastD) < .7) return;
      lastD = D;
      var m;
      if (D <= 0) m = 'none';
      else if (mode === 0) m = 'radial-gradient(circle at ' + ox + 'px ' + oy + 'px,transparent ' + D + 'px,#000 ' + (D + .6) + 'px)';
      else { var q = D / nrm; m = 'linear-gradient(' + ang + 'deg,transparent ' + q + 'px,#000 ' + (q + .6) + 'px)'; }
      oldWrap.style.webkitMaskImage = m; oldWrap.style.maskImage = m;
    }

    var N = cells.length, lo = 0, hi = 0, t0 = performance.now();
    function liteFrame(t) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var tr = t - TSWAP - 20, k, c, p, sc, h;
      if (!st.swapped && t >= TSWAP) swap(st);
      for (k = 0; k < N; k++) {
        c = cells[k];
        if (tr < 0) {                                  /* волна закрывает экран */
          if (c.dl > t) break;
          p = Math.min(1, (t - c.dl) / GROW); sc = Math.min(1.08, easeOutBack(p));
        } else {                                       /* волна открывает новую страницу */
          p = (tr - c.dl) / SHR;
          if (p >= 1) continue;
          sc = p <= 0 ? 1 : 1 - p * p * p;
        }
        if (sc <= .01) continue;
        h = s * sc;
        g.drawImage(big, c.ci * s, c.cj * s, s, s, c.cx - h / 2 - .5, c.cy - h / 2 - .5, h + 1, h + 1);
      }
      if (t > TOTAL) { finish(st); return; }
      st.raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      if (st.over) return;
      var t = now - t0;
      if (LITE) { liteFrame(t); return; }
      setMask((t - NZ - GROW) / SP * maxD);
      while (hi < N && cells[hi].dl <= t) hi++;
      while (lo < hi && cells[lo].dl + LIFE <= t) lo++;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      for (var q2 = lo; q2 < hi; q2++) {
        var c = cells[q2], tt = t - c.dl, sc, rot, p;
        if (tt < GROW) { p = tt / GROW; sc = Math.min(1.12, easeOutBack(p)); rot = (1 - p) * 1.4 * c.dir; }
        else if (tt < GROW + HOLD) { sc = 1; rot = 0; }
        else { p = (tt - GROW - HOLD) / SHR; sc = 1 - p * p * p; rot = p * -1.1 * c.dir; }
        if (sc <= 0.01) continue;
        var h = s * sc, cosr = Math.cos(rot) * dpr, sinr = Math.sin(rot) * dpr;
        if (rot === 0) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.drawImage(big, c.ci * s, c.cj * s, s, s, Math.round(c.cx - s / 2 - .5), Math.round(c.cy - s / 2 - .5), s + 1, s + 1); }
        else { g.setTransform(cosr, sinr, -sinr, cosr, c.cx * dpr, c.cy * dpr); g.drawImage(big, c.ci * s, c.cj * s, s, s, -h / 2 - .5, -h / 2 - .5, h + 1, h + 1); }
      }
      if (t > TOTAL) { finish(st); return; }
      st.raf = requestAnimationFrame(frame);
    }
    st.raf = requestAnimationFrame(frame);
  };
})();

/* Панель вкладок: если все пункты с подписями не помещаются — оставляем только иконки, чтобы были видны все вкладки */
(function () {
  var nav = document.querySelector('.tabsnav');
  if (!nav) return;
  var busy = false;
  function fit() {
    if (busy) return; busy = true;
    nav.classList.remove('compact');
    if (nav.scrollWidth > nav.clientWidth + 1) nav.classList.add('compact');
    busy = false;
    var on = nav.querySelector('a.on'), ind = nav.querySelector('.ind');
    if (on && ind) { ind.style.width = on.offsetWidth + 'px'; ind.style.transform = 'translateX(' + on.offsetLeft + 'px)'; }
  }
  window.addEventListener('resize', fit);
  /* состав шапки меняется после входа/выхода (ник, аватарка, кнопка) — пересчитываем */
  if (window.ResizeObserver) { var ro = new ResizeObserver(fit); ['.nav-r', '.brand'].forEach(function (q) { var e = document.querySelector(q); if (e) ro.observe(e); }); }
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
})();
