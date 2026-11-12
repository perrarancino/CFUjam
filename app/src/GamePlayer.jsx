import { useEffect, useRef, useState } from 'react';
import { Icon } from './components.jsx';
import { archiveDocument, loadGameArchive } from './gameArchive.js';

const bootTimeout = 20000;

export default function GamePlayer({ title, sources, cover }) {
  const player = useRef(null);
  const frame = useRef(null);
  const launch = useRef(null);
  const pendingArchive = useRef(null);
  const messageOrigin = useRef(null);
  const mountTimer = useRef(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [run, setRun] = useState({ kind: 'idle' });
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const syncFullScreen = () => setFullScreen(document.fullscreenElement === player.current);
    const collapse = (event) => { if (event.key === 'Escape') setExpanded(false); };
    const receive = (event) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== messageOrigin.current) return;
      switch (event.data?.type) {
        case 'cfujam:audio-ready':
          setAudioReady(true);
          break;
        case 'cfujam:archive-mounted':
          clearTimeout(mountTimer.current);
          setRun((current) => current.kind === 'archive' ? { ...current, loading: false } : current);
          break;
        case 'cfujam:archive-error':
          clearTimeout(mountTimer.current);
          setRun({ kind: 'error', message: 'Не удалось запустить игру из ZIP.' });
          break;
        case 'cfujam:escape':
          setExpanded(false);
          break;
      }
    };
    document.addEventListener('fullscreenchange', syncFullScreen);
    window.addEventListener('keydown', collapse);
    window.addEventListener('message', receive);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullScreen);
      window.removeEventListener('keydown', collapse);
      window.removeEventListener('message', receive);
      launch.current?.abort();
      clearTimeout(mountTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!audioReady || !frame.current?.contentWindow) return;
    const origin = messageOrigin.current;
    frame.current.contentWindow.postMessage({ type: 'cfujam:mute', muted }, origin === 'null' ? '*' : origin);
  }, [muted, audioReady]);

  async function play() {
    launch.current?.abort();
    clearTimeout(mountTimer.current);
    pendingArchive.current = null;
    messageOrigin.current = null;
    setAudioReady(false);
    const controller = new AbortController();
    launch.current = controller;
    const { signal } = controller;
    const { archive, page, repository } = sources;

    if (archive) {
      setRun({ kind: 'preparing', message: 'Скачиваем игру…' });
      try {
        const archiveFiles = await loadGameArchive(archive, signal, () => {
          setRun({ kind: 'preparing', message: 'Распаковываем игру…' });
        });
        signal.throwIfAborted();
        pendingArchive.current = archiveFiles;
        messageOrigin.current = 'null';
        setRun({ kind: 'archive', loading: true });
        mountTimer.current = setTimeout(() => {
          pendingArchive.current = null;
          setRun({ kind: 'error', message: 'Игра не запустилась. Попробуйте ещё раз.' });
        }, bootTimeout);
        return;
      } catch (error) {
        if (signal.aborted) return;
        if (!page) {
          setRun({ kind: 'error', message: error instanceof TypeError ? 'Не удалось скачать ZIP со сборкой.' : error.message });
          return;
        }
        setRun({ kind: 'preparing', message: 'Проверяем GitHub Pages…' });
        const response = await fetch(page, { method: 'HEAD', credentials: 'omit', signal }).catch(() => null);
        if (signal.aborted) return;
        if (response && !response.ok) {
          setRun({ kind: 'error', message: 'Не удалось найти ZIP или опубликованную страницу игры.' });
          return;
        }
      }
    }

    const pageOrigin = new URL(page).origin;
    messageOrigin.current = repository && pageOrigin !== window.location.origin ? pageOrigin : 'null';
    setRun({ kind: 'page', loading: true });
  }

  function frameLoaded() {
    if (run.kind === 'page') {
      setRun((current) => current.kind === 'page' ? { ...current, loading: false } : current);
      return;
    }
    if (!pendingArchive.current) return;
    frame.current.contentWindow.postMessage({ type: 'cfujam:run-archive', ...pendingArchive.current, muted }, '*');
    pendingArchive.current = null;
  }

  async function toggleScreen() {
    if (expanded) {
      setExpanded(false);
    } else if (document.fullscreenElement === player.current) {
      await document.exitFullscreen();
    } else {
      try {
        await player.current.requestFullscreen();
      } catch {
        setExpanded(true);
      }
    }
  }

  const isLarge = fullScreen || expanded;
  const hasFrame = run.kind === 'archive' || run.kind === 'page';
  const loading = run.kind === 'preparing' || run.loading === true;
  const muteLabel = muted ? 'Включить звук' : 'Выключить звук';
  const sourceLink = sources.repository || sources.archive || sources.page;
  const sourceLabel = sources.repository ? 'Сборка на GitHub' : sources.archive ? 'Скачать ZIP' : 'Открыть отдельно';

  return (
    <section ref={player} className={'game-player' + (expanded ? ' is-expanded' : '')} aria-label={'Плеер игры ' + title}>
      <div className="game-player-bar">
        <div className="game-player-title"><Icon n="gamepad-2" /><span>Играть в браузере</span></div>
        <div className="game-player-actions">
          <button className="btn secondary sm game-player-mute" type="button" disabled={!audioReady}
            onClick={() => setMuted((current) => !current)} aria-label={muteLabel} aria-pressed={muted}
            title={run.kind === 'page' && !loading && !audioReady ? 'Эта страница не передаёт управление звуком' : muteLabel}>
            <span className="game-player-speaker" aria-hidden="true" />
            <span className="game-player-action-label">{muteLabel}</span>
          </button>
          <button className="btn secondary sm game-player-fullscreen" type="button" onClick={toggleScreen}
            aria-label="На весь экран" title="На весь экран">
            <span className="game-player-corners" aria-hidden="true" />
            <span className="game-player-action-label">На весь экран</span>
          </button>
        </div>
      </div>
      <div className="game-player-stage" aria-busy={loading}>
        {hasFrame && <iframe
          ref={frame}
          src={run.kind === 'page' ? sources.page : undefined}
          srcDoc={run.kind === 'archive' ? archiveDocument(window.location.origin) : undefined}
          title={title}
          sandbox={'allow-scripts allow-pointer-lock' + (messageOrigin.current !== 'null' ? ' allow-same-origin' : '')}
          allow="autoplay; fullscreen"
          referrerPolicy="no-referrer"
          onLoad={frameLoaded}
        />}
        {(!hasFrame || loading) && <div className="game-player-poster">
          <img src={cover} alt="" />
          <div className="game-player-poster-content">
            {loading && <span role="status">{run.message || 'Запускаем игру…'}</span>}
            {run.kind === 'error' && <span role="alert">{run.message}</span>}
            {!loading && <button className="btn primary game-player-start" type="button" onClick={play}>
              <span className="game-player-play-icon" aria-hidden="true" />
              {run.kind === 'error' ? 'Повторить' : 'Запустить игру'}
            </button>}
          </div>
        </div>}
        {isLarge && <button className="btn secondary sm game-player-exit" type="button" onClick={toggleScreen}
          aria-label="Выйти из полноэкранного режима" title="Выйти из полноэкранного режима">
          <Icon n="x" />
        </button>}
      </div>
      <div className="game-player-footer">
        <a href={sourceLink} target="_blank" rel="noopener noreferrer">{sourceLabel}<Icon n="arrow-up-right" /></a>
        {hasFrame && !loading && <button type="button" onClick={play}>Перезапустить</button>}
      </div>
    </section>
  );
}
