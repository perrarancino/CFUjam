import { Avatar, Banner, Icon } from '../components.jsx';
import { GameList } from '../game-components.jsx';
import { belongsTo, catalogGames } from '../catalog.js';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';
import { profileOf } from '../profiles.js';
import { api } from '../api.js';

export default function Me() {
  const { S, update, toast, needAuth } = useApp();
  const { show } = useNav();
  if (!S.user) return <><Banner title="Кабинет" text="Твой профиль и игры, над которыми ты работаешь." /><div className="card pull empty"><h3>Войдите в аккаунт</h3><p>Здесь будут ваш профиль и ваши игры.</p><button className="btn primary" onClick={() => needAuth('Войдите, чтобы открыть кабинет')}>Войти</button></div></>;
  const profile = profileOf(S.user, S);
  const games = catalogGames(S).filter((game) => belongsTo(game, S.user));
  const logout = () => { if (S.demo) { location.hash = '#/home'; location.reload(); return; } api.logout(); update((d) => { d.user = null; }); toast('Вы вышли из аккаунта'); show('home'); };
  return <>
    <Banner title="Кабинет" text="Твой профиль и игры, над которыми ты работаешь." />
    <div className="account-layout pull">
      <article className="prof a g-green" id="pcard">
        <div className="cov"><div className="grain" /></div><Avatar name={profile.nick} cls="xl" interactive={false} />
        <div className="ph"><div className="pinfo"><h4>{profile.full}</h4><span className="handle">@{profile.nick} · {profile.role}</span></div></div>
        <p className="profile-bio">{profile.bio || 'Участник геймджема КФУ.'}</p>
        {!!profile.skills.length && <div className="row profile-skills">{profile.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div>}
        <div className="account-summary"><Icon n="gamepad-2" /><b>{games.length}</b><span>игр в профиле</span></div>
        <button className="btn secondary" type="button" onClick={logout}><Icon n="log-out" />Выйти из аккаунта</button>
      </article>
      <section className="card account-games"><div className="section-heading"><h2>Мои игры</h2><span className="badge">{games.length}</span></div>
        <GameList games={games} empty="Вы пока не участвуете ни в одном игровом проекте." />
        {!games.length && <button className="btn primary" onClick={() => show('teams')}><Icon n="users" />Найти или создать команду</button>}
      </section>
    </div>
  </>;
}
