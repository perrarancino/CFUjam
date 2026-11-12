import { useEffect, useRef, useState } from 'react';
import { Icon } from './components.jsx';

export default function GamePlayer({ title, src, cover, repository }) {
  const player = useRef(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const syncFullScreen = () => setFullScreen(document.fullscreenElement === player.current);
    document.addEventListener('fullscreenchange', syncFullScreen);
    return () => document.removeEventListener('fullscreenchange', syncFullScreen);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const collapse = (event) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', collapse);
    return () => window.removeEventListener('keydown', collapse);
  }, [expanded]);

  async function toggleScreen() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (fullScreen) {
      await document.exitFullscreen();
      return;
    }
    try {
      await player.current.requestFullscreen();
    } catch {
      setExpanded(true);
    }
  }

  const isLarge = fullScreen || expanded;
  const useGameOrigin = repository && new URL(src).origin !== window.location.origin;

  return (
    <section ref={player} className={'game-player' + (expanded ? ' is-expanded' : '')} aria-label={'Плеер игры ' + title}>
      <div className="game-player-bar">
        <div className="game-player-title"><Icon n="gamepad-2" /><span>Играть в браузере</span></div>
        <button className="btn secondary sm game-player-fullscreen" type="button" onClick={toggleScreen} aria-pressed={isLarge}>
          <span className="game-player-corners" aria-hidden="true" />
          {isLarge ? 'Свернуть' : 'На весь экран'}
        </button>
      </div>
      <div className="game-player-stage" aria-busy={loading}>
        <iframe
          key={attempt}
          src={src}
          title={title}
          sandbox={useGameOrigin ? 'allow-scripts allow-pointer-lock allow-same-origin' : 'allow-scripts allow-pointer-lock'}
          allow="autoplay; fullscreen"
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
        />
        {loading && <div className="game-player-loading">
          <img src={cover} alt="" />
          <span role="status">Загрузка игры…</span>
        </div>}
      </div>
      <div className="game-player-footer">
        <a href={repository || src} target="_blank" rel="noopener noreferrer">
          {repository ? 'Сборка на GitHub' : 'Открыть отдельно'}<Icon n="arrow-up-right" />
        </a>
        <button type="button" onClick={() => { setLoading(true); setAttempt((current) => current + 1); }}>Перезапустить</button>
      </div>
    </section>
  );
}
