import { Avatar, Icon } from '../components.jsx';
import { catalogGames, gameVotes, safeGameUrl } from '../catalog.js';
import { profileOf } from '../profiles.js';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

export default function Game() {
  const { S, update, needAuth } = useApp();
  const { gameId, show } = useNav();
  const game = catalogGames(S).find((g) => g.id === gameId);
  if (!game) return <div className="card pull empty"><h2>Игра не найдена</h2><p>Возможно, ссылка устарела или проект удалён.</p><button className="btn secondary" onClick={() => show('games')}>К списку игр</button></div>;
  const liked = !!S.user && (S.likes[S.user] || []).includes(game.id);
  const playUrl = safeGameUrl(game.webPlayableUrl);
  const vote = () => {
    if (!S.user) return needAuth('Войдите, чтобы голосовать за игру');
    update((d) => { const votes = d.likes[d.user] || []; d.likes[d.user] = liked ? votes.filter((id) => id !== game.id) : [...votes, game.id]; });
  };
  return <div className="game-page pull">
    <a className="back-link" href="#/games" onClick={(e) => { e.preventDefault(); show('games'); }}><Icon n="arrow-right" />Все игры</a>
    <header className="game-page-heading"><div><span className="lbl">Проект геймджема</span><h1>{game.title}</h1></div><button className={'btn ' + (liked ? 'primary' : 'secondary')} aria-pressed={liked} onClick={vote}><Icon n="heart" />{gameVotes(game, S)}<span>{liked ? 'Голос учтён' : 'Поддержать'}</span></button></header>
    <div className="game-page-layout">
      <div className="stack-v"><img className="game-page-cover" src={game.coverUrl} alt={'Обложка игры «' + game.title + '»'} /><section className="card"><h2>Об игре</h2><p>{game.description || game.text}</p><div className="project-tags">{game.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></section></div>
      <aside className="stack-v"><section className="card"><h2>Играть</h2>{playUrl ? <a className="btn primary block" href={playUrl} target="_blank" rel="noopener noreferrer"><Icon n="gamepad-2" />Открыть игру</a> : <p className="hintp">Сборка ещё не опубликована.</p>}{game.instructions && <p>{game.instructions}</p>}</section>
        <section className="card"><h2>Команда проекта</h2>{game.crew?.length ? <div className="game-crew">{game.crew.map((name) => { const p = profileOf(name, S); return <div className="game-crew-member" key={name}><Avatar name={name} /><div><b>{p.full}</b><small>{p.role}</small></div></div>; })}</div> : <p className="hintp">Состав пока не указан.</p>}<button className="btn secondary sm" onClick={() => show('teams')}>К командам<Icon n="arrow-right" /></button></section>
      </aside>
    </div>
  </div>;
}
