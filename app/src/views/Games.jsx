import { useMemo, useState } from 'react';
import { Avatar, Banner, Icon } from '../components.jsx';
import { BASE_GAMES, TAGS, cover } from '../data.js';
import { useApp } from '../store.jsx';

const ENGINES = ['Unity', 'Godot', 'Unreal'];
const MODES = ['Все', 'Мои', 'Избранные'];

export default function Games() {
  const { S, update, toast, needAuth, gainXp } = useApp();
  const [mode, setMode] = useState(0);
  const [eng, setEng] = useState('');
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState('');

  const likedBy = (id) => Object.values(S.likes).filter((l) => (l || []).includes(id)).length;
  const iLiked = (id) => !!S.user && (S.likes[S.user] || []).includes(id);

  /* карточки: три готовые + игры, созданные командами */
  const all = useMemo(() => [
    ...BASE_GAMES.map((g) => ({ ...g, owner: '', tagsL: g.tags.map((t) => t.toLowerCase()) })),
    ...S.games.map((g) => ({
      id: g.id, title: g.title, owner: g.owner, cover: cover(g.title), base: 0, tags: [g.dir, 'Новая'], tagsL: [g.dir.toLowerCase(), 'новая'],
      text: `Новая работа команды ${g.owner}. Направление: ${g.dir.toLowerCase()}.`, crew: [g.owner], mine: true
    }))
  ], [S.games]);

  const shown = all.filter((g) => {
    if (mode === 1 && !(S.user && g.owner === S.user)) return false;
    if (mode === 2 && !iLiked(g.id)) return false;
    if (eng && !g.tagsL.includes(eng.toLowerCase())) return false;
    if (tags.length && !tags.some((t) => g.tagsL.includes(t.toLowerCase()))) return false;
    const s = q.trim().toLowerCase();
    if (s && !(g.title + ' ' + g.text + ' ' + g.tags.join(' ') + ' ' + g.owner).toLowerCase().includes(s)) return false;
    return true;
  });

  const like = (g) => {
    if (!S.user) return needAuth('Чтобы голосовать, войдите в аккаунт');
    const has = iLiked(g.id);
    update((d) => {
      const l = (d.likes[d.user] = d.likes[d.user] || []);
      const i = l.indexOf(g.id);
      if (i > -1) l.splice(i, 1); else l.push(g.id);
    });
    if (has) toast('Голос снят: ' + g.title); else { toast('Голос за «' + g.title + '»', 'ok'); gainXp(3); }
  };

  const toggleTag = (t) => setTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const reset = () => { setMode(0); setEng(''); setTags([]); setQ(''); };
  const emptyMsg = mode === 1 ? (S.user ? 'У вас пока нет игр. Создайте команду на вкладке «Команды».' : 'Войдите, чтобы увидеть свои игры.') : mode === 2 ? 'Вы ещё не голосовали ни за одну игру.' : 'Ничего не найдено.';

  return (
    <>
      <Banner img="w05" title="Игры" text="Работы участников: ищи, фильтруй и голосуй. Примеры обложек созданы для демонстрации." />
      <div className="card toolbar pull">
        <div className="tb-row">
          <div className="field gsearch"><label htmlFor="g-search">Поиск</label><input id="g-search" type="search" placeholder="Название, жанр или движок…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="tb-seg">
            <span className="lbl">Показать</span>
            <div className="seg" id="seg-mode">
              {MODES.map((m, i) => <label key={m}><input type="radio" name="seg1" checked={mode === i} onChange={() => setMode(i)} /><span>{m}</span></label>)}
            </div>
          </div>
          <div className="tb-seg">
            <span className="lbl">Движок</span>
            <div className="seg" id="seg-eng">
              {ENGINES.map((m) => (
                <label key={m} onClick={(e) => { if (eng === m) { e.preventDefault(); setEng(''); } }}>
                  <input type="radio" name="seg2" checked={eng === m} onChange={() => setEng(m)} /><span>{m}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="row tagbar" id="tagbar">
          <span className="lbl inl"><Icon n="tag" />Теги</span>
          {TAGS.map((t) => (
            <span key={t} className={'tag' + (tags.includes(t) ? ' on' : '')} role="button" tabIndex={0} aria-pressed={tags.includes(t)}
              onClick={() => toggleTag(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTag(t); } }}>{t}</span>
          ))}
        </div>
      </div>

      <div className="grid g3 gallery" id="g-grid">
        {shown.map((g) => {
          const on = iLiked(g.id);
          return (
            <article className="gcard" key={g.id} data-id={g.id} data-owner={g.owner}>
              <div className="cover"><img src={`img/generated/${g.cover}.png`} alt="" loading="lazy" decoding="async" /></div>
              <div className="gshade" />
              <div className="gbody">
                <h4>{g.title}</h4>
                <p>{g.text}</p>
                <div className="row">{g.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
                <div className="gfoot">
                  <div className="avstack">{g.crew.map((m) => <Avatar key={m} name={m} cls="sm" />)}</div>
                  <button className={'btn light sm' + (on ? ' liked' : '')} type="button" aria-pressed={on} aria-label="Голос за игру" onClick={() => like(g)}>
                    <Icon n={on ? 'heart-fill' : 'heart'} /><span>{g.base + likedBy(g.id)}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!shown.length && (
          <div className="empty"><p>{emptyMsg}</p><button className="btn secondary sm" type="button" onClick={reset}><Icon n="x" />Сбросить фильтры</button></div>
        )}
      </div>
    </>
  );
}
