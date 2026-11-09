import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ROUTES } from './lib.js';

/* Маршруты вкладок (#/games и т.д.) и переход между ними.
   Все вкладки смонтированы всегда и просто скрываются атрибутом hidden — так старая и новая страницы
   существуют одновременно, и пиксельная волна (legacy-ui14.js) может показать «где прошла — уже новая». */

const Nav = createContext(null);
export const useNav = () => useContext(Nav);

const fromHash = () => {
  const m = location.hash.match(/^#\/(\w+)/);
  return m && ROUTES.includes(m[1]) ? m[1] : 'home';
};
const gameFromHash = () => {
  try { return decodeURIComponent(location.hash.match(/^#\/game\/([^/?#]+)/)?.[1] || ''); }
  catch { return ''; }
};

export function NavProvider({ children }) {
  const [view, setView] = useState(fromHash);
  const [gameId, setGameId] = useState(gameFromHash);
  const viewRef = useRef(view);
  viewRef.current = view;

  const show = useCallback((name, anchor, noHash) => {
    if (!ROUTES.includes(name)) name = 'home';
    const cur = viewRef.current;
    if (window.CFU_camFinish) window.CFU_camFinish();

    const curEl = document.querySelector(`.view[data-view="${cur}"]`);
    const nxtEl = document.querySelector(`.view[data-view="${name}"]`);
    const animate = false;   /* переходы между вкладками отключены */
    const selectedGame = name === 'game' ? (noHash ? gameFromHash() : anchor || '') : '';
    const apply = () => flushSync(() => { viewRef.current = name; setView(name); setGameId(selectedGame); });

    if (animate) window.CFU_cam(curEl, nxtEl, ROUTES.indexOf(name) > ROUTES.indexOf(cur) ? 1 : -1, apply);
    else {
      apply();
      if (window.CFU_play && nxtEl) window.CFU_play(nxtEl);
    }

    const path = '#/' + name + (name === 'game' && selectedGame ? '/' + encodeURIComponent(selectedGame) : '');
    if (!noHash && location.hash !== path) {
      try { history.pushState(null, '', path); } catch (e) { location.hash = path; }
    }
    const busy = window.CFU_camBusy && window.CFU_camBusy();
    const target = name !== 'game' && anchor && document.getElementById(anchor);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), busy ? 1100 : 60);
    else if (!busy) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => show(fromHash(), null, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    window.CFU_go = (n, a) => show(n, a);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, [show]);

  return <Nav.Provider value={{ view, gameId, show }}>{children}</Nav.Provider>;
}

/* индикатор активной вкладки в шапке (подсветка «перетекает») */
export function useIndicator(navRef, view) {
  useLayoutEffect(() => {
    const move = () => {
      const nav = navRef.current;
      if (!nav) return;
      const a = nav.querySelector('a.on'), ind = nav.querySelector('.ind');
      if (ind && !a) ind.style.opacity = 0;
      if (!a || !ind) return;
      ind.style.opacity = 1;
      ind.style.width = a.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + a.offsetLeft + 'px)';
      if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
    };
    move();
    window.addEventListener('resize', move);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(move);
    return () => window.removeEventListener('resize', move);
  }, [view]);
}
