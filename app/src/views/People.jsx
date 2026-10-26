import { useState } from 'react';
import { Avatar, Banner, Icon } from '../components.jsx';
import { PEOPLE } from '../data.js';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

export function useInvite() {
  const { S, toast, needAuth } = useApp();
  const { show } = useNav();
  return (who) => {
    if (!S.user) return needAuth('Войдите, чтобы приглашать в команду');
    if (!S.teams[S.user]) { toast('Сначала создайте команду', 'warn'); return show('teams'); }
    toast('Приглашение отправлено: ' + who, 'ok');
  };
}

export default function People() {
  const { S, toast, needAuth, openModal } = useApp();
  const invite = useInvite();
  const [saved, setSaved] = useState({});
  return (
    <>
      <Banner img="w06" title="Участники" text="Профили, роли и рейтинг джема." />
      <div className="grid g3 pull profiles">
        {PEOPLE.map((p) => {
          const body = (
            <>
              <Avatar name={p.short} cls={'xl ' + p.cls} />
              <div className="ph">
                <div className="pinfo"><h4>{p.full}</h4><span className="handle">@{p.nick} · {p.role}</span></div>
                <div className="acts">
                  <button className="btn dark sm" type="button" onClick={() => invite(p.full)}>В команду</button>
                  <button
                    className={'icbtn' + (saved[p.nick] ? ' on' : '')}
                    type="button"
                    aria-label="Сохранить"
                    onClick={() => {
                      setSaved((s) => ({ ...s, [p.nick]: !s[p.nick] }));
                      toast(!saved[p.nick] ? 'Профиль сохранён: ' + p.full : 'Убрано из сохранённых');
                    }}
                  >
                    <Icon n="bookmark" />
                  </button>
                </div>
              </div>
              <hr />
              <div className="stats">
                <div><Icon n="star" /><b>{p.rate}</b><small>Рейтинг</small></div>
                <div><Icon n="gamepad-2" /><b>{p.games}</b><small>Игр</small></div>
                <div><Icon n="flag" /><b>{p.jams}</b><small>Джемов</small></div>
              </div>
              <button
                className={'wide ' + (p.kind === 'a' ? 'dark' : 'light')}
                type="button"
                onClick={() => (S.user ? openModal({ type: 'write', who: p.full }) : needAuth('Войдите, чтобы писать сообщения'))}
              >
                <i className="circ"><Icon n="arrow-right" /></i><span>Написать</span>
              </button>
            </>
          );
          return p.kind === 'a' ? (
            <article key={p.nick} className={'prof a ' + p.theme}><div className="cov"><div className="grain" /></div>{body}</article>
          ) : (
            <article key={p.nick} className={'prof b ' + p.theme}><div className="grain" />{body}</article>
          );
        })}
      </div>
    </>
  );
}
