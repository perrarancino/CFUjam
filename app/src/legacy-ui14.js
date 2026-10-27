/* Подгонка шапки: если подписи вкладок не помещаются — оставляем только иконки */
(function () {
  'use strict';
  window.CFU_NODIM = true;
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
  window.addEventListener('load', fit);
  if (window.ResizeObserver) { var ro = new ResizeObserver(fit); ['.nav-r', '.brand'].forEach(function (q) { var e = document.querySelector(q); if (e) ro.observe(e); }); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
})();
