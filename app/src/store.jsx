import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* Состояние всего приложения. Данные хранятся в localStorage браузера (прототип без сервера).
   В демо-входе (VK / Google) ничего не пишется — см. S.demo. */

const KEY = 'cfujam11';
export const DEF_OPTS = { notify: true, team: false, snow: true, look: true, mentor: false, anim: true };

function load() {
  let S = { user: null, users: [], teams: {}, games: [], likes: {}, prog: {}, opts: DEF_OPTS, role: 'Программист', msgs: 3, reqs: 12, reqIdx: 0, demo: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      S = { ...S, ...d, opts: { ...DEF_OPTS, ...d.opts }, demo: null };
    }
  } catch (e) { /* пусто */ }
  return S;
}

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [S, setS] = useState(load);
  const ref = useRef(S);
  ref.current = S;

  /* сохранение (кроме демо-сессии) */
  useEffect(() => {
    if (S.demo) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* пусто */ }
  }, [S]);

  /* update(fn): fn изменяет копию состояния */
  const update = useCallback((fn) => {
    setS((prev) => { const n = structuredClone(prev); fn(n); return n; });
  }, []);

  /* всплывающие подсказки */
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type, out: false }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, out: true } : x))), 3400);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3750);
  }, []);

  /* окна */
  const [modal, setModal] = useState(null);
  const openModal = useCallback((m) => setModal(m), []);
  const closeModal = useCallback(() => setModal(null), []);
  const needAuth = useCallback((msg) => { toast(msg || 'Сначала войдите в аккаунт', 'warn'); setModal({ type: 'auth', tab: 'in' }); }, [toast]);

  /* опыт и уровни */
  const progOf = (s) => (s.user ? s.prog[s.user] || { xp: 0, lvl: 1 } : { xp: 88, lvl: 12 });
  const gainXp = useCallback((n) => {
    const s = ref.current;
    if (!s.user) return;
    let { xp, lvl } = progOf(s);
    xp += n;
    let up = 0;
    while (xp >= 100) { xp -= 100; lvl++; up = lvl; }
    update((d) => { d.prog[d.user] = { xp, lvl }; });
    if (up) toast('Новый уровень: LVL ' + up, 'ok');
  }, [update, toast]);

  const value = useMemo(() => ({ S, update, toast, toasts, modal, openModal, closeModal, needAuth, gainXp, progOf, ref }), [S, update, toast, toasts, modal, openModal, closeModal, needAuth, gainXp]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
