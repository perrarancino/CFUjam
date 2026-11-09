import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Banner, Icon, Modal } from '../components.jsx';
import { TAGS } from '../data.js';
import { catalogGames, belongsTo } from '../catalog.js';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

const MODES = ['Все', 'Мои', 'Избранные'];

function GameTags({ options, selected, toggle, clear }) {
  const strip = useRef(null);
  const measurements = useRef(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useLayoutEffect(() => {
    const fit = () => {
      const widths = [...measurements.current.children].map((el) => el.getBoundingClientRect().width);
      const available = strip.current.clientWidth;
      const total = widths.reduce((sum, width) => sum + width + 8, -8);
      const limit = total <= available ? available : Math.max(0, available - 52);
      let count = 0, used = 0;
      for (const width of widths) {
        const next = used + (count ? 8 : 0) + width;
        if (next > limit) break;
        used = next; count++;
      }
      setVisibleCount(count);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(strip.current);
    let active = true;
    document.fonts.ready.then(() => { if (active) fit(); });
    fit();
    return () => { active = false; observer.disconnect(); };
  }, [options]);
  const filtered = options.filter((tag) => tag.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const tagButton = (tag) => <button key={tag} type="button" className={'tag game-tag-filter' + (selected.includes(tag) ? ' on' : '')} aria-pressed={selected.includes(tag)} onClick={() => toggle(tag)}>{tag}</button>;
  return (
    <div className="game-tag-filters">
      <div className="game-tag-heading"><span className="lbl inl"><Icon n="tag" />Теги</span>{selected.length > 0 && <button className="game-tags-clear" type="button" onClick={clear}>Сбросить ({selected.length})</button>}</div>
      <div className="game-tag-strip" ref={strip}>
        {options.slice(0, visibleCount).map(tagButton)}
        {visibleCount < options.length && <button className="btn secondary sm game-tags-more" type="button" aria-label="Все теги" aria-haspopup="dialog" onClick={() => { setQuery(''); setOpen(true); }}>+</button>}
      </div>
      <div className="game-tag-measure" ref={measurements} aria-hidden="true">{options.map((tag) => <span className="tag game-tag-filter" key={tag}>{tag}</span>)}</div>
      {selected.some((tag) => !options.slice(0, visibleCount).includes(tag)) && <div className="game-selected-tags"><span className="lbl">Выбраны:</span>{selected.filter((tag) => !options.slice(0, visibleCount).includes(tag)).map(tagButton)}</div>}
      {open && <Modal title="Все теги" onClose={() => setOpen(false)}>
        <div className="game-tags-dialog">
          <div className="field"><label htmlFor="game-tag-search">Поиск тегов</label><div className="game-search-input"><Icon n="search" /><input id="game-tag-search" type="search" placeholder="Например, хоррор или Godot" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></div></div>
          <p className="hintp">Можно выбрать несколько тегов. Покажем игры хотя бы с одним из них.</p>
          <div className="game-tags-results">{filtered.map(tagButton)}{!filtered.length && <p role="status">Таких тегов нет. Попробуйте другой запрос.</p>}</div>
          <div className="game-tags-actions"><button className="btn secondary sm" type="button" disabled={!selected.length} onClick={clear}>Сбросить теги</button><button className="btn primary sm" type="button" onClick={() => setOpen(false)}>Готово{selected.length ? ` (${selected.length})` : ''}</button></div>
        </div>
      </Modal>}
    </div>
  );
}

export default function Games() {
  const { S, update, toast, needAuth, gainXp } = useApp();
  const { show } = useNav();
  const [mode, setMode] = useState(0);
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState('');

  const likedBy = (id) => Object.values(S.likes).filter((l) => (l || []).includes(id)).length;
  const iLiked = (id) => !!S.user && (S.likes[S.user] || []).includes(id);

  /* карточки: три готовые + игры, созданные командами */
  const all = useMemo(() => catalogGames(S), [S.games, S.teams]);
  const tagOptions = useMemo(() => [...new Set([...TAGS, ...all.flatMap((g) => g.tags)])], [all]);

  const shown = all.filter((g) => {
    if (mode === 1 && !belongsTo(g, S.user)) return false;
    if (mode === 2 && !iLiked(g.id)) return false;
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
  const reset = () => { setMode(0); setTags([]); setQ(''); };
  const emptyMsg = mode === 1 ? (S.user ? 'У вас пока нет игр. Создайте команду на вкладке «Команды».' : 'Войдите, чтобы увидеть свои игры.') : mode === 2 ? 'Вы ещё не голосовали ни за одну игру.' : 'Ничего не найдено.';

  return (
    <>
      <Banner img="w05" title="Игры" text="Работы участников: ищи, фильтруй и голосуй. Примеры обложек созданы для демонстрации." />
      <div className="card toolbar pull games-toolbar">
        <div className="tb-row">
          <div className="field game-search"><label htmlFor="g-search">Поиск</label><div className="game-search-input"><Icon n="search" /><input id="g-search" type="search" placeholder="Название игры, тег или команда…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <div className="tb-seg">
            <span className="lbl">Показать</span>
            <div className="seg" id="seg-mode">
              {MODES.map((m, i) => <label key={m}><input type="radio" name="seg1" checked={mode === i} onChange={() => setMode(i)} /><span>{m}</span></label>)}
            </div>
          </div>
        </div>
        <GameTags options={tagOptions} selected={tags} toggle={toggleTag} clear={() => setTags([])} />
      </div>

      <div className="grid g3 gallery" id="g-grid">
        {shown.map((g) => {
          const on = iLiked(g.id);
          return (
            <article className="gcard game-clickable" key={g.id} data-id={g.id} data-owner={g.owner} onClick={(e) => { if (!e.target.closest('button,a')) show('game', g.id); }}>
              <a className="cover" aria-label={'Открыть игру: ' + g.title} href={'#/game/' + encodeURIComponent(g.id)} onClick={(e) => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); show('game', g.id); } }}><img src={g.coverUrl} alt="" loading="lazy" decoding="async" /></a>
              <div className="gshade" />
              <div className="gbody">
                <h4><a href={'#/game/' + encodeURIComponent(g.id)} onClick={(e) => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); show('game', g.id); } }}>{g.title}</a></h4>
                <p>{g.text}</p>
                <div className="gfoot">
                  <div className="game-card-tags">{g.tags.map((t) => <button className={'tag game-tag-filter' + (tags.includes(t) ? ' on' : '')} type="button" key={t} aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>)}</div>
                  <button className={'btn secondary sm game-like' + (on ? ' liked' : '')} type="button" aria-pressed={on} aria-label={`${on ? 'Снять голос' : 'Голосовать'}: ${g.title}`} onClick={() => like(g)}>
                    <Icon n="heart" /><span>{g.base + likedBy(g.id)}</span>
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
