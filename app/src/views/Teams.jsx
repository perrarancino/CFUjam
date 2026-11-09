import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Banner, Field, Icon, Range } from '../components.jsx';
import { CHK, userRec } from '../lib.js';
import { catalogGames } from '../catalog.js';
import { GameList } from '../game-components.jsx';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

export default function Teams() {
  const { S, update, toast, needAuth, openModal } = useApp();
  const { show } = useNav();
  const [f, setF] = useState({ team: '', mail: '', nick: '', dir: 'Программирование', size: 5 });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const team = S.user && S.teams[S.user];
  const games = catalogGames(S);
  useEffect(() => {
    const user = S.user && userRec(S, S.user);
    setF((x) => ({ ...x, mail: user?.email || '', nick: S.user || '' }));
    setErr({});
  }, [S.user]);
  const set = (key) => (e) => { setF((x) => ({ ...x, [key]: e.target.value })); setErr((x) => ({ ...x, [key]: '' })); };
  const create = async (event) => {
    event.preventDefault();
    if (!S.user) return needAuth('Войдите, чтобы создать команду');
    if (team || busy) return;
    const errors = { team: CHK.team(f.team), mail: CHK.email(f.mail.trim()), nick: CHK.nick(S, f.nick.trim(), S.user) };
    setErr(errors);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    const owner = S.user;
    try {
      const created = S.isOnline ? await api.createTeam('current', { name: f.team.trim(), dir: f.dir, size: f.size }) : null;
      update((d) => {
        if (d.teams[owner]) return;
        d.teams[owner] = { id: created?.id || null, name: f.team.trim(), dir: f.dir, size: f.size, members: [owner], isOpen: true };
        d.games.push({ id: 'u-' + crypto.randomUUID(), owner, title: f.team.trim(), dir: f.dir, text: 'Новый игровой проект команды «' + f.team.trim() + '».' });
      });
      toast(S.isOnline ? 'Команда создана' : 'Команда и проект сохранены в этом браузере', 'ok');
    } catch (error) { toast(error.message || 'Не удалось создать команду', 'err'); }
    finally { setBusy(false); }
  };
  const recruitment = async () => {
    if (!team || busy) return;
    const next = team.isOpen === false;
    setBusy(true);
    try {
      if (S.isOnline && team.id) await api.updateTeamRecruitment(team.id, { isOpen: next });
      update((d) => { d.teams[S.user].isOpen = next; });
      toast(next ? 'Набор открыт' : 'Набор закрыт', 'ok');
    } catch (error) { toast(error.message || 'Не удалось изменить набор', 'err'); }
    finally { setBusy(false); }
  };
  const demoNames = ['Чёрное море', 'Тихий берег', 'Неоновый рассвет'];
  const directory = [
    ...Object.entries(S.teams).map(([owner, t]) => ({ ...t, key: owner, projects: games.filter((g) => g.owner === owner), demo: false })),
    ...games.filter((g) => /^g[0-2]$/.test(g.id)).map((g, index) => ({ key: g.id, name: demoNames[index], members: g.crew, size: 5, dir: g.tags.join(' · '), projects: [g], demo: true }))
  ].filter((t) => (t.name + ' ' + t.dir).toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <Banner title="Команды" text="Собери участников, управляй своей командой и открывай игровые проекты." />
    <div className="grid g2 pull team-workspace">
      {team ? <section className="card"><div className="section-heading"><h2>Моя команда</h2><span className="badge">{team.isOpen === false ? 'Набор закрыт' : 'Набор открыт'}</span></div><h3>{team.name}</h3><p className="hintp">{team.members.length} из {team.size} мест занято · {team.dir}</p><div className="team-member-list">{team.members.map((name) => <Avatar key={name} name={name} />)}</div><div className="team-actions"><button className="btn secondary sm" disabled={busy} onClick={recruitment}>{team.isOpen === false ? 'Открыть набор' : 'Закрыть набор'}</button><button className="btn secondary sm" onClick={() => openModal({ type: 'reqs' })}>Заявки и приглашения</button><button className="btn secondary sm" onClick={() => show('people')}>Найти участников</button></div></section> : <section className="card"><h2>Создать команду</h2><form className="stack-v team-create-form" onSubmit={create} noValidate>
        <Field id="f-team" label="Название команды" hint="От 3 до 24 символов" error={err.team} value={f.team} onChange={set('team')} placeholder="Например, «Белые волки»" />
        <Field id="f-mail" label="Контактная почта" type="email" error={err.mail} value={f.mail} onChange={set('mail')} placeholder="you@cfuv.ru" />
        <Field id="f-nick" label="Контактный ник" error={err.nick} value={f.nick} onChange={set('nick')} />
        <Field id="f-dir" label="Направление"><select id="f-dir" value={f.dir} onChange={set('dir')}><option>Программирование</option><option>Графика</option><option>Звук</option><option>Геймдизайн</option></select></Field>
        <Range id="rg-team" min={1} max={5} value={f.size} onChange={(size) => setF((x) => ({ ...x, size }))} label={{ text: 'Мест в команде', out: f.size }} />
        <p className="hintp">Вместе с командой создадим страницу проекта. {!S.isOnline && 'Команда и проект сохранятся в этом браузере.'}</p><button className="btn primary" disabled={busy}><Icon n="users" />{busy ? 'Создаём…' : 'Создать команду'}</button>
      </form></section>}
      <section className="card"><h2>Проекты команды</h2>{team ? <><GameList games={games.filter((g) => g.owner === S.user)} empty="У команды пока нет проектов." /><button className="btn secondary sm" onClick={() => openModal({ type: 'devlog_compose' })}><Icon n="book-open" />Написать в дневник</button></> : <div className="team-start"><Icon n="gamepad-2" /><p>После создания команды здесь появится её игра. Страница проекта также будет доступна из каталога и кабинета.</p><button className="btn secondary sm" onClick={() => show('games')}>Посмотреть игры</button></div>}</section>
    </div>
    <section className="team-directory"><div className="section-heading"><h2>Команды джема</h2><span className="badge">{directory.length}</span></div><div className="field"><label htmlFor="team-search">Поиск команд</label><div className="game-search-input"><Icon n="search" /><input id="team-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или направление…" /></div></div>
      <div className="grid g3">{directory.map((t) => <article className="card team-directory-card" key={t.key}><div className="section-heading"><h3>{t.name}</h3>{t.demo && <span className="badge">Демо</span>}</div><p className="hintp">{t.dir}</p><div className="team-member-list">{t.members.map((name) => <Avatar name={name} key={name} cls="sm" />)}</div><p className="hintp">{t.members.length} из {t.size} мест занято</p><GameList games={t.projects} /></article>)}</div>
      {!directory.length && <p className="hintp">Команды не найдены.</p>}
    </section>
  </>;
}
