import { useEffect, useRef } from 'react';
import { Icon, Toasts } from './components.jsx';
import { Modals } from './modals.jsx';
import { NavProvider, useIndicator, useNav } from './nav.jsx';
import { AppProvider, useApp } from './store.jsx';
import Devlogs from './views/Devlogs.jsx';
import Games from './views/Games.jsx';
import Home from './views/Home.jsx';
import Me from './views/Me.jsx';
import People from './views/People.jsx';
import Teams from './views/Teams.jsx';
import Game from './views/Game.jsx';
import Messages from './views/Messages.jsx';

const TABS = [
  ['home', 'house', 'Главная'],
  ['games', 'gamepad-2', 'Игры'],
  ['teams', 'users', 'Команды'],
  ['devlogs', 'book-open', 'Дневники'],
  ['people', 'sparkles', 'Биржа'],
  ['messages', 'message-square', 'Сообщения']
];

function Header() {
  const { S, openModal } = useApp();
  const { view, show } = useNav();
  const activeView = view === 'game' ? 'games' : view;
  const unread = S.user ? (S.notifications || []).filter((n) => n.user === S.user && !n.read).length : 0;
  const navRef = useRef(null);
  useIndicator(navRef, view);

  const go = (name) => (e) => { e.preventDefault(); show(name); };
  /* аватарка: гость — открывает вход, участник — личный кабинет */
  const avatar = () => (S.user ? show('me') : openModal({ type: 'auth', tab: 'in' }));
  return (
    <header className="nav">
      <a className="brand" href="#/home" onClick={go('home')} aria-label="CFU JAM — главная"><img className="brand-crest" src="brand/cfu-crest-original.png" alt="" width="128" height="128" /><span className="bt">CFU <span>JAM</span></span></a>
      <nav className="tabsnav" aria-label="Разделы" ref={navRef}>
        <i className="ind" />
        {TABS.map(([id, ic, label]) => (
          <a key={id} href={'#/' + id} data-go={id} className={activeView === id ? 'on' : ''} aria-current={activeView === id ? 'page' : undefined} title={label} onClick={go(id)}>
            <Icon n={ic} /><span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="nav-r">
        <button className="btn secondary header-notifications" type="button" aria-label={'Уведомления' + (unread ? `: ${unread} непрочитанных` : '')} title="Уведомления" onClick={() => openModal({ type: 'notifications' })}><Icon n="bell" />{unread > 0 && <span className="notification-dot">{unread}</span>}</button>
        <button className={'btn secondary header-account' + (view === 'me' ? ' on' : '')} type="button" aria-label={S.user ? 'Личный кабинет' : 'Войти'} title={S.user ? 'Личный кабинет' : 'Войти'} onClick={avatar}>
          {!S.user && <Icon n="user" />}<span>{S.user ? 'Кабинет' : 'Войти'}</span>
        </button>
      </div>
    </header>
  );
}

function Shell() {
  const { S, update, toast, openModal } = useApp();
  const { view, show } = useNav();

  /* вход / выход */
  useEffect(() => {
    window.CFU_logout = () => { update((d) => { d.user = null; }); toast('Вы вышли из аккаунта'); };
  }, [update, toast]);

  /* настройки внешнего вида читают legacy-скрипты через классы на body */
  useEffect(() => {
    document.body.classList.toggle('nosnow', !S.opts.snow);
    document.body.classList.toggle('noanim', !S.opts.anim);
  }, [S.opts.snow, S.opts.anim]);

  /* карусель, физика наведения и пиксельная волна — отдельные скрипты, подключаются после первой отрисовки */
  useEffect(() => {
    const load = () => import('./legacy-ui12.js').then(() => import('./legacy-ui14.js'));
    if (window.requestIdleCallback) window.requestIdleCallback(load, { timeout: 1500 }); else setTimeout(load, 300);
  }, []);

  const section = (name, node) => <section className="view" data-view={name} hidden={view !== name}>{node}</section>;
  return (
    <>
      <Header />
      <main>
        {section('home', <Home user={S.user} onRegister={() => (S.user ? show('teams') : openModal({ type: 'auth', tab: 'reg' }))} />)}
        {section('games', <Games />)}
        {section('game', <Game />)}
        {section('teams', <Teams />)}
        {section('devlogs', <Devlogs />)}
        {section('people', <People />)}
        {section('messages', <Messages />)}
        {section('me', <Me />)}
      </main>
      <Toasts />
      <Modals />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavProvider>
        <Shell />
      </NavProvider>
    </AppProvider>
  );
}
