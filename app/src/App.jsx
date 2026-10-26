import { useEffect, useRef } from 'react';
import { Avatar, Icon, Toasts } from './components.jsx';
import { Modals } from './modals.jsx';
import { NavProvider, useIndicator, useNav } from './nav.jsx';
import { AppProvider, useApp } from './store.jsx';
import Games from './views/Games.jsx';
import Home from './views/Home.jsx';
import Me from './views/Me.jsx';
import People from './views/People.jsx';
import Teams from './views/Teams.jsx';

const TABS = [['home', 'house', 'Главная'], ['teams', 'users', 'Команды'], ['games', 'gamepad-2', 'Игры'], ['people', 'trophy', 'Участники']];

function Header() {
  const { S, openModal } = useApp();
  const { view, show } = useNav();
  const navRef = useRef(null);
  useIndicator(navRef, view);

  const go = (name) => (e) => { e.preventDefault(); show(name); };
  /* аватарка: гость — открывает вход, участник — личный кабинет */
  const avatar = () => (S.user ? show('me') : openModal({ type: 'auth', tab: 'in' }));
  return (
    <header className="nav">
      <a className="brand" href="#/home" onClick={go('home')}><span className="logo"><Icon n="gamepad-2" /></span><span className="bt">CFU JAM</span></a>
      <nav className="tabsnav" aria-label="Разделы" ref={navRef}>
        <i className="ind" />
        {TABS.map(([id, ic, label]) => (
          <a key={id} href={'#/' + id} data-go={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} title={label} onClick={go(id)}>
            <Icon n={ic} /><span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="nav-r">
        <button className={'avbtn' + (view === 'me' ? ' on' : '')} type="button" aria-label={S.user ? 'Личный кабинет' : 'Войти'} title={S.user ? 'Личный кабинет' : 'Войти'} onClick={avatar}>
          <Avatar name={S.user || 'Гость'} cls="sm on" />
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
    import('./legacy-ui12.js').then(() => import('./legacy-ui14.js'));
  }, []);

  const section = (name, node) => <section className="view" data-view={name} hidden={view !== name}>{node}</section>;
  return (
    <>
      <Header />
      <main>
        {section('home', <Home user={S.user} onRegister={() => (S.user ? show('teams') : openModal({ type: 'auth', tab: 'reg' }))} />)}
        {section('teams', <Teams />)}
        {section('games', <Games />)}
        {section('people', <People />)}
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
