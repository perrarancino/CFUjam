import { Avatar, Banner, Icon } from '../components.jsx';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

const Cnt = ({ n }) => <span className="cnt" style={{ display: n > 0 ? '' : 'none' }}>{n}</span>;

export default function Me() {
  const { S, update, toast, progOf, openModal, needAuth } = useApp();
  const { show } = useNav();
  const p = progOf(S);
  const n = S.user ? S.games.filter((g) => g.owner === S.user).length : 7;
  const jams = S.user ? 1 : 3;
  const xp = S.user ? ((p.lvl - 1) * 100 + p.xp).toLocaleString('ru-RU') : '2 480';
  const name = S.user || 'Алина Кравец';
  const handle = S.user ? '@' + S.user.toLowerCase() + ' · ' + S.role.toLowerCase() : '@alina_k · геймдизайнер, Симферополь';
  const key = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  const msgs = () => openModal({ type: 'msgs' });
  const reqs = () => openModal({ type: 'reqs' });
  return (
    <>
      <Banner img="w07" title="Кабинет" text="Твой профиль, уровень, сообщения и заявки." />
      <div className="grid g2 pull">
        <article className="prof a g-green" id="pcard">
          <div className="cov"><div className="grain" /></div>
          <Avatar name={S.user || 'Алина К'} cls="xl on r-win" />
          <div className="ph">
            <div className="pinfo"><h4>{name}</h4><span className="handle">{handle}</span></div>
            <div className="acts">
              <button className="btn dark sm" id="p-invite" type="button" onClick={() => (S.user ? show('teams') : needAuth('Войдите, чтобы приглашать в команду'))}>
                {S.user ? <><Icon n="users" />Моя команда</> : <><Icon n="user-plus" />В команду</>}
              </button>
            </div>
          </div>
          <div className="row" style={{ margin: '2px 0 4px' }}>
            <span className="badge b-win"><Icon n="crown" />Победитель</span>
            <span className="badge b-part">Участник</span>
            <span className="lvl">LVL {p.lvl}</span>
          </div>
          <hr />
          <div className="stats">
            <div><Icon n="gamepad-2" /><b>{n}</b><small>игр</small></div>
            <div><Icon n="flag" /><b>{jams}</b><small>джема</small></div>
            <div><Icon n="star" /><b>{xp}</b><small>XP</small></div>
          </div>
          {S.user && (
            <button className="wide light" type="button" onClick={() => { if (S.demo) { location.hash = '#/home'; location.reload(); return; } update((d) => { d.user = null; }); toast('Вы вышли из аккаунта'); show('home'); }}>
              <i className="circ"><Icon n="log-out" /></i><span>Выйти из аккаунта</span>
            </button>
          )}
          <button className="wide dark" id="p-write" type="button" onClick={() => (S.user ? msgs() : needAuth('Войдите, чтобы писать сообщения'))}>
            <i className="circ"><Icon n="send" /></i><span>{S.user ? 'Мои сообщения' : 'Написать'}</span>
          </button>
        </article>
        <div className="stack-v">
          <div className="card">
            <h3><Icon n="zap" />Уровень</h3>
            <div className="bar-l"><span>Опыт до LVL {p.lvl + 1}</span><span>{p.xp}%</span></div>
            <div className="bar" style={{ '--v': p.xp + '%' }}><i /></div>
            <div className="sep" />
            <div className="row">
              <span className="btn dark sm" role="button" tabIndex={0} onClick={msgs} onKeyDown={key(msgs)}><Icon n="message-square" />Сообщения <Cnt n={S.msgs} /></span>
              <span className="btn ghost sm" role="button" tabIndex={0} onClick={reqs} onKeyDown={key(reqs)}><Icon n="users" />Заявки <Cnt n={S.reqs} /></span>
            </div>
          </div>
          <div className="card">
            <h3><Icon n="award" />Достижения</h3>
            <div className="stack-v" style={{ gap: 10 }}>
              <div className="ach"><span className="ai"><Icon n="star" /></span><div><b>Первый джем</b><small>Сдал игру до дедлайна</small></div></div>
              <div className="ach"><span className="ai"><Icon n="crown" /></span><div><b>Золото Крыма</b><small>1 место в голосовании</small></div></div>
              <div className="ach"><span className="ai"><Icon n="graduation-cap" /></span><div><b>Наставник</b><small>Помог 5 командам</small></div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
