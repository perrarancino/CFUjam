import { Icon } from './components.jsx';
import { useNav } from './nav.jsx';

export function GameList({ games, empty = 'Игр пока нет.' }) {
  const { show } = useNav();
  if (!games.length) return <p className="hintp">{empty}</p>;
  return <div className="project-list">{games.map((g) => <a className="project-list-item" key={g.id} href={'#/game/' + encodeURIComponent(g.id)} onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); show('game', g.id); } }}>
    <img src={g.coverUrl} alt="" loading="lazy" />
    <div><h4>{g.title}</h4><p>{g.text}</p><div className="project-tags">{g.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div><Icon n="arrow-right" />
  </a>)}</div>;
}
