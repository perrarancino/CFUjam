import { BASE_GAMES, cover } from './data.js';
import { findProfile } from './profiles.js';

export function catalogGames(state) {
  return [...BASE_GAMES, ...state.games.map((g) => ({
    ...g, base: g.likesCount || 0, cover: g.cover || cover(g.title),
    tags: g.tags?.length ? g.tags : [g.dir || 'Другое', 'Новая'],
    crew: g.crew || state.teams[g.owner]?.members || (g.owner ? [g.owner] : []),
    text: g.text || `Проект команды «${state.teams[g.owner]?.name || g.owner || 'Без названия'}».`,
    owner: g.owner || ''
  }))].map((g) => ({ ...g, owner: g.owner || '', tagsL: g.tags.map((t) => t.toLowerCase()), coverUrl: g.coverUrl || `img/generated/${g.cover}.png` }));
}

const identity = (name = '') => findProfile(name)?.nick || name.toLowerCase();
export function belongsTo(game, user) {
  return !!user && (identity(game.owner) === identity(user) || (game.crew || []).some((name) => identity(name) === identity(user)));
}

export function gameVotes(game, state) {
  return (game.base || 0) + Object.values(state.likes).filter((votes) => (votes || []).includes(game.id)).length;
}

export function safeGameUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}
