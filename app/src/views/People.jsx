import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Banner, Icon } from '../components.jsx';
import { PEOPLE } from '../data.js';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

const SPECIALTIES = [
  { id: 'ALL', label: 'Все' },
  { id: 'CODE', label: 'Программирование', kw: ['программист', 'unity', 'godot', 'c#', 'c++', 'код'] },
  { id: 'ART', label: '2D/3D Арт', kw: ['художник', 'арт', '2d', '3d', 'пиксель', 'blender', 'aseprite'] },
  { id: 'GD', label: 'Геймдизайн', kw: ['геймдизайнер', 'дизайн', 'баланс', 'уровни'] },
  { id: 'SOUND', label: 'Звук и музыка', kw: ['звук', 'саунд', 'музыка', 'fmod', 'композитор'] },
  { id: 'NARRATIVE', label: 'Сценарий', kw: ['сценарист', 'нарратив', 'текст', 'история'] }
];

export function useInvite() {
  const { S, toast, needAuth } = useApp();
  const { show } = useNav();

  return async (targetName, role = 'OTHER') => {
    if (!S.user) return needAuth('Войдите, чтобы приглашать в команду');
    const myTeam = S.teams[S.user];
    if (!myTeam) {
      toast('Сначала создайте команду на вкладке «Команды»', 'warn');
      return show('teams');
    }

    if (S.isOnline && myTeam.id) {
      try {
        await api.sendInvite(myTeam.id, targetName, role);
        toast(`Приглашение отправлено участнику ${targetName}!`, 'ok');
        return;
      } catch (err) {
        toast(err.message || 'Ошибка отправки приглашения', 'warn');
        return;
      }
    }

    toast(`Приглашение отправлено: ${targetName}`, 'ok');
  };
}

export default function People() {
  const { S, toast, needAuth, openModal, gainXp } = useApp();
  const { show } = useNav();
  const invite = useInvite();

  const [tab, setTab] = useState('LFG'); // 'LFG' (Кандидаты) | 'VACANCIES' (Вакансии команд)
  const [spec, setSpec] = useState('ALL');
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState({});

  // Живые данные с сервера
  const [liveCandidates, setLiveCandidates] = useState([]);
  const [liveVacancies, setLiveVacancies] = useState([]);
  const [loading, setLoading] = useState(false);

  // Загрузка живых кандидатов и вакансий
  useEffect(() => {
    if (!S.isOnline) return;

    setLoading(true);
    Promise.all([
      api.getLfgCandidates('current').catch(() => []),
      api.getJamVacancies('current').catch(() => [])
    ])
      .then(([cands, vacs]) => {
        if (Array.isArray(cands) && cands.length > 0) setLiveCandidates(cands);
        if (Array.isArray(vacs) && vacs.length > 0) setLiveVacancies(vacs);
      })
      .finally(() => setLoading(false));
  }, [S.isOnline]);

  // Подача заявки в команду («Откликнуться»)
  const applyToTeam = async (team) => {
    if (!S.user) return needAuth('Войдите, чтобы подать заявку в команду');
    if (S.teams[S.user]) return toast('Вы уже состоите в команде', 'warn');

    if (S.isOnline && team.id) {
      try {
        await api.applyToTeam(team.id, 'OTHER', 'Здравствуйте! Хочу присоединиться к вашей команде на джем.');
        toast(`Заявка отправлена капитану команды «${team.name}»!`, 'ok');
        gainXp(5);
        return;
      } catch (err) {
        toast(err.message || 'Ошибка отправки заявки', 'warn');
        return;
      }
    }

    toast(`Заявка отправлена капитану команды «${team.name}»!`, 'ok');
    gainXp(5);
  };

  // Обогащаем список кандидатов (локальный PEOPLE + серверные)
  const allCandidates = useMemo(() => {
    const list = [...PEOPLE];
    const existingNicks = new Set(list.map((p) => p.nick.toLowerCase()));

    for (const lc of liveCandidates) {
      if (!existingNicks.has(lc.username.toLowerCase())) {
        list.push({
          full: lc.displayName || lc.username,
          nick: lc.username,
          short: (lc.displayName || lc.username).slice(0, 8),
          theme: 'g-blue',
          kind: 'a',
          role: lc.role || 'участник',
          rate: '5.0',
          games: 1,
          jams: 1,
          cls: 'on',
          skills: lc.skills,
          bio: lc.bio
        });
      }
    }
    return list;
  }, [liveCandidates]);

  // Демо-вакансии для оффлайн режима
  const mockVacancies = useMemo(() => [
    {
      id: 'v1',
      name: 'Чёрное море',
      direction: '2D Pixel Art Платформер',
      tagline: 'Ищем 2D-художника для анимации персонажей и боссов. Движок Godot 4.',
      leader: { username: 'danil_m', displayName: 'Данил Морозов' },
      membersCount: 2,
      maxSize: 5,
      neededRoles: ['2D Художник', 'Саунд-дизайнер']
    },
    {
      id: 'v2',
      name: 'Тихий берег',
      direction: '3D Хоррор от первого лица',
      tagline: 'Нужен программист игровой логики (Unity / C#). Сценарий и 3D-модели уже в работе.',
      leader: { username: 'artem_r', displayName: 'Артём Романов' },
      membersCount: 3,
      maxSize: 5,
      neededRoles: ['Программист Unity', 'Левелдизайнер']
    },
    {
      id: 'v3',
      name: 'Неоновый рассвет',
      direction: 'Ритм-раннер',
      tagline: 'Ищем саунд-дизайнера / композитора для написания динамичных synthwave треков.',
      leader: { username: 'kirill_n', displayName: 'Кирилл Новиков' },
      membersCount: 2,
      maxSize: 5,
      neededRoles: ['Саунд-дизайнер', 'UI Дизайнер']
    }
  ], []);

  const currentVacancies = liveVacancies.length > 0 ? liveVacancies : mockVacancies;

  // Фильтрация кандидатов
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((p) => {
      const matchSpec = () => {
        if (spec === 'ALL') return true;
        const s = SPECIALTIES.find((x) => x.id === spec);
        if (!s || !s.kw) return true;
        const text = (p.role + ' ' + (p.bio || '') + ' ' + ((p.skills || []).join(' '))).toLowerCase();
        return s.kw.some((k) => text.includes(k));
      };
      if (!matchSpec()) return false;

      const query = q.trim().toLowerCase();
      if (query) {
        const full = (p.full + ' ' + p.nick + ' ' + p.role + ' ' + (p.bio || '')).toLowerCase();
        if (!full.includes(query)) return false;
      }
      return true;
    });
  }, [allCandidates, spec, q]);

  // Фильтрация вакансий
  const filteredVacancies = useMemo(() => {
    return currentVacancies.filter((v) => {
      const query = q.trim().toLowerCase();
      if (query) {
        const full = (v.name + ' ' + v.direction + ' ' + (v.tagline || '') + ' ' + (v.leader?.displayName || '')).toLowerCase();
        if (!full.includes(query)) return false;
      }
      return true;
    });
  }, [currentVacancies, q]);

  const hasMyTeam = !!(S.user && S.teams[S.user]);

  return (
    <>
      <Banner
        img="w06"
        title="Биржа тимейтов"
        text="Найди команду для джема или позови недостающего специалиста: программистов, художников, саунд-дизайнеров и сценаристов."
      />

      {/* Панель управления поиском и фильтрами */}
      <div className="card toolbar pull">
        <div className="tb-row">
          <div className="field gsearch">
            <label htmlFor="people-search">Поиск</label>
            <input
              id="people-search"
              type="search"
              placeholder="Поиск по имени, роли, движку (Unity, Godot, Blender)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="tb-seg">
            <span className="lbl">Раздел</span>
            <div className="seg">
              <label>
                <input
                  type="radio"
                  name="people-tab"
                  checked={tab === 'LFG'}
                  onChange={() => setTab('LFG')}
                />
                <span>Кандидаты (LFG)</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="people-tab"
                  checked={tab === 'VACANCIES'}
                  onChange={() => setTab('VACANCIES')}
                />
                <span>Вакансии команд</span>
              </label>
            </div>
          </div>

          <div className="acts">
            <button
              className="btn dark"
              type="button"
              onClick={() => {
                if (!S.user) return needAuth('Войдите, чтобы настроить анкету');
                openModal({ type: 'lfg_profile' });
              }}
            >
              <Icon n="user-plus" />
              <span>Моя анкета LFG</span>
            </button>
          </div>
        </div>

        {tab === 'LFG' && (
          <div className="row tagbar" style={{ marginTop: 14 }}>
            <span className="lbl inl"><Icon n="tag" />Специализация</span>
            {SPECIALTIES.map((s) => (
              <span
                key={s.id}
                className={'tag' + (spec === s.id ? ' on' : '')}
                role="button"
                tabIndex={0}
                onClick={() => setSpec(s.id)}
              >
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 1. ВКЛАДКА КАНДИДАТОВ В КОМАНДУ */}
      {tab === 'LFG' && (
        <div className="grid g3 pull profiles">
          {filteredCandidates.map((p) => {
            const body = (
              <>
                <Avatar name={p.short} cls={'xl ' + p.cls} />
                <div className="ph">
                  <div className="pinfo">
                    <h4>{p.full}</h4>
                    <span className="handle">@{p.nick} · {p.role}</span>
                  </div>
                  <div className="acts">
                    <button
                      className="btn dark sm"
                      type="button"
                      onClick={() => invite(p.full)}
                    >
                      В команду
                    </button>
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

                {p.bio && (
                  <p style={{ fontSize: 13, color: '#4a5361', margin: '4px 0 10px', lineHeight: 1.4 }}>
                    {p.bio}
                  </p>
                )}

                <div className="stats">
                  <div><Icon n="star" /><b>{p.rate}</b><small>Рейтинг</small></div>
                  <div><Icon n="gamepad-2" /><b>{p.games}</b><small>Игр</small></div>
                  <div><Icon n="flag" /><b>{p.jams}</b><small>Джемов</small></div>
                </div>

                <button
                  className="wide dark"
                  type="button"
                  onClick={() =>
                    S.user
                      ? openModal({ type: 'write', who: p.full })
                      : needAuth('Войдите, чтобы писать сообщения')
                  }
                >
                  <i className="circ"><Icon n="arrow-right" /></i>
                  <span>Написать сообщение</span>
                </button>
              </>
            );

            return (
              <article key={p.nick} className={'prof a ' + (p.theme || 'g-green')}>
                <div className="cov"><div className="grain" /></div>
                {body}
              </article>
            );
          })}
        </div>
      )}

      {/* 2. ВКЛАДКА ВАКАНСИЙ И НАБОРА В КОМАНДЫ */}
      {tab === 'VACANCIES' && (
        <div className="grid g2 pull">
          {filteredVacancies.map((v) => {
            const leaderName = v.leader?.displayName || v.leader?.username || 'Капитан';
            const isFull = v.membersCount >= (v.maxSize || 5);

            return (
              <div key={v.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="badge b-part"><Icon n="users" />Команда</span>
                    <span className={'chip ' + (isFull ? 'warn' : 'ok')}>
                      <i className="pt" />
                      {v.membersCount} из {v.maxSize || 5} мест занято
                    </span>
                  </div>

                  <h3 style={{ fontSize: 22, fontWeight: 800, textTransform: 'none', letterSpacing: 0, margin: '8px 0' }}>
                    {v.name}
                  </h3>

                  <p style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>
                    Направление: {v.direction}
                  </p>

                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 16, border: '1px solid #eef2f6', marginBottom: 16 }}>
                    <b style={{ display: 'block', fontSize: 13, color: '#10141c', marginBottom: 6 }}>
                      Кого ищут:
                    </b>
                    <p style={{ fontSize: 14, color: '#323a46', lineHeight: 1.5, margin: 0 }}>
                      {v.tagline || 'Ищем инициативных участников в команду.'}
                    </p>
                  </div>

                  <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Avatar name={leaderName} cls="sm on" />
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>Капитан команды</small>
                      <b>{leaderName}</b>
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={isFull || hasMyTeam}
                    onClick={() => applyToTeam(v)}
                    style={{ flex: 1 }}
                  >
                    <Icon n="rocket" />
                    <span>{hasMyTeam ? 'Вы уже в команде' : isFull ? 'Набор закрыт' : 'Подать заявку'}</span>
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() =>
                      S.user
                        ? openModal({ type: 'write', who: leaderName })
                        : needAuth('Войдите, чтобы писать сообщения')
                    }
                  >
                    <Icon n="message-square" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
