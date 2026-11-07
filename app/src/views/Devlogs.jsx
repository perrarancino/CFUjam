import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Banner, Icon } from '../components.jsx';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

// Стартовые мок-дневники для оффлайн/демо режима
const INITIAL_DEVLOGS = [
  {
    id: 'mock-devlog-1',
    title: 'День 1: Готова базовая механика полива и цикл день/ночь',
    content: 'Привет всем джемерам! Первые 24 часа позади. Мы перенесли проект на Godot 4.3, настроили тайловую карту сада в ночном Крыму и написали шейдер мягкого лунного света. Данил уже запрограммировал систему роста побегов, а Софья нарисовала потрясающие спрайты ночных цветов. Завтра беремся за звуковые эмбиенты!',
    images: ['img/generated/moon-garden-user.png'],
    likesCount: 19,
    createdAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    author: { username: 'alina_k', displayName: 'Алина Кравец' },
    team: { name: 'Лунный садовник' },
    iLiked: false
  },
  {
    id: 'mock-devlog-2',
    title: '3D маяк в Unity: настроили volumetric fog и звук шагов',
    content: 'Всем привет! Наш хоррор-прототип оживает. Собрали сцену скалистого берега с маяком. Самое сложное было оптимизировать объемный туман под WebGL сборку, чтобы игра летала прямо в браузере со стабильными 60 FPS. Мария записала жуткие звуки ветра и скрипа ступеней. Скоро выложим первый тестовый билд!',
    images: ['img/generated/quiet-shore.png'],
    likesCount: 14,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    author: { username: 'artem_r', displayName: 'Артём Романов' },
    team: { name: 'Тихий берег' },
    iLiked: true
  },
  {
    id: 'mock-devlog-3',
    title: 'Физика планирования чайки и пиксельные волны Черного моря',
    content: 'Показываем первые кадры аркады про чайку! Удалось добиться плавного парения на восходящих потоках теплого воздуха. Физику полета настраивали часа четыре, но теперь чайка слушается клавиатуру идеально. Волна на фоне анимирована вручную покадрово в Aseprite. Оцените концепт!',
    images: ['img/generated/seagull.png'],
    likesCount: 26,
    createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    author: { username: 'kirill_n', displayName: 'Кирилл Новиков' },
    team: { name: 'Чайка и ветер' },
    iLiked: false
  }
];

export default function Devlogs() {
  const { S, toast, needAuth, gainXp, openModal } = useApp();
  const { show } = useNav();
  const [posts, setPosts] = useState(INITIAL_DEVLOGS);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'POPULAR' | 'MY_TEAM'
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  // Загрузка живых постов с сервера
  const loadDevlogs = async () => {
    if (!S.isOnline) return;
    try {
      setLoading(true);
      const res = await api.getDevlogs('current');
      if (Array.isArray(res) && res.length > 0) {
        setPosts(res);
      }
    } catch {
      // оффлайн фоллбэк
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevlogs();
  }, [S.isOnline]);

  // Лайк записи
  const toggleLike = async (post) => {
    if (!S.user) return needAuth('Войдите, чтобы поддерживать команды');

    const nextLiked = !post.iLiked;
    const diff = nextLiked ? 1 : -1;

    // Оптимистичное обновление UI
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, iLiked: nextLiked, likesCount: Math.max(0, p.likesCount + diff) }
          : p
      )
    );

    if (nextLiked) {
      toast('Вы поддержали запись «' + post.title + '»!', 'ok');
      gainXp(2);
    }

    if (S.isOnline && !post.id.startsWith('mock-')) {
      try {
        await api.likeDevlog(post.id);
      } catch (err) {
        toast(err.message || 'Ошибка обновления лайка', 'warn');
      }
    }
  };

  // Удаление записи
  const removePost = async (postId) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись дневника?')) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast('Запись удалена', 'ok');

    if (S.isOnline && !postId.startsWith('mock-')) {
      try {
        await api.deleteDevlog(postId);
      } catch (err) {
        toast(err.message || 'Не удалось удалить запись на сервере', 'warn');
      }
    }
  };

  const myTeamName = (S.user && S.teams[S.user]?.name) || '';

  // Фильтрация
  const filteredPosts = useMemo(() => {
    let res = [...posts];

    if (filter === 'POPULAR') {
      res.sort((a, b) => b.likesCount - a.likesCount);
    } else {
      res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (filter === 'MY_TEAM') {
      if (!myTeamName) return [];
      res = res.filter((p) => p.team?.name === myTeamName);
    }

    const query = q.trim().toLowerCase();
    if (query) {
      res = res.filter((p) =>
        (p.title + ' ' + p.content + ' ' + (p.team?.name || '') + ' ' + (p.author?.displayName || p.author?.username || '')).toLowerCase().includes(query)
      );
    }

    return res;
  }, [posts, filter, q, myTeamName]);

  const handleWriteClick = () => {
    if (!S.user) return needAuth('Войдите, чтобы вести дневник разработки');
    // Открываем модальное окно добавления записи
    openModal({
      type: 'devlog_compose',
      onCreated: (newPost) => {
        setPosts((prev) => [newPost, ...prev]);
        toast('Запись опубликована в дневнике джема!', 'ok');
        gainXp(10);
      }
    });
  };

  const copyShare = (post) => {
    const url = window.location.origin + window.location.pathname + '#/devlogs';
    navigator.clipboard?.writeText(url);
    toast('Ссылка скопирована в буфер обмена', 'ok');
  };

  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now - d;
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 1) return 'Меньше часа назад';
      if (diffHours < 24) return `${diffHours} ч назад`;
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch {
      return 'Недавно';
    }
  };

  return (
    <>
      <Banner
        img="w01"
        title="Дневники разработки"
        text="Следи за ходом создания игр, первыми скриншотами, концептами и делись прогрессом своей команды в реальном времени."
      />

      <div className="card toolbar pull">
        <div className="tb-row">
          <div className="field gsearch">
            <label htmlFor="devlog-search">Поиск</label>
            <input
              id="devlog-search"
              type="search"
              placeholder="Поиск по теме, коду, арту или команде…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="tb-seg">
            <span className="lbl">Лента</span>
            <div className="seg">
              <label>
                <input
                  type="radio"
                  name="devlog-filter"
                  checked={filter === 'ALL'}
                  onChange={() => setFilter('ALL')}
                />
                <span>Все записи</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="devlog-filter"
                  checked={filter === 'POPULAR'}
                  onChange={() => setFilter('POPULAR')}
                />
                <span>Популярные</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="devlog-filter"
                  checked={filter === 'MY_TEAM'}
                  onChange={() => setFilter('MY_TEAM')}
                />
                <span>Моя команда</span>
              </label>
            </div>
          </div>

          <div className="acts">
            <button className="btn primary" type="button" onClick={handleWriteClick}>
              <Icon n="book-open" />
              <span>Написать в дневник</span>
            </button>
          </div>
        </div>
      </div>

      <div className="stack-v pull" style={{ gap: 20 }}>
        {filter === 'MY_TEAM' && !myTeamName && (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <Icon n="users" cls="sc-i" style={{ fontSize: 36, color: 'var(--muted)', marginBottom: 12 }} />
            <h3>У вас пока нет команды</h3>
            <p className="hintp" style={{ maxWidth: 440, margin: '0 auto 16px' }}>
              Публиковать записи в дневник могут зарегистрированные команды джема. Создайте свою команду или присоединитесь к существующей.
            </p>
            <button className="btn dark sm" type="button" onClick={() => show('teams')}>
              <Icon n="rocket" />
              <span>Перейти к командам</span>
            </button>
          </div>
        )}

        {filteredPosts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <p className="hintp">Записей по вашему запросу не найдено.</p>
          </div>
        )}

        {filteredPosts.map((post) => {
          const authorName = post.author?.displayName || post.author?.username || 'Разработчик';
          const teamName = post.team?.name || 'Команда джема';
          const isMine = S.user && (post.author?.username === S.user || post.author?.displayName === S.user);

          return (
            <article key={post.id} className="card" style={{ padding: 26 }}>
              {/* Шапка поста */}
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                  <Avatar name={authorName} cls="sm on" />
                  <div>
                    <b style={{ display: 'block', fontSize: 16 }}>{authorName}</b>
                    <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {formatTime(post.createdAt)}
                    </small>
                  </div>
                </div>

                <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span className="badge b-part" style={{ cursor: 'pointer' }} onClick={() => show('teams')}>
                    <Icon n="users" />
                    <span>{teamName}</span>
                  </span>
                  {isMine && (
                    <button
                      className="icbtn"
                      type="button"
                      title="Удалить запись"
                      onClick={() => removePost(post.id)}
                      style={{ color: '#d32f2f' }}
                    >
                      <Icon n="x" />
                    </button>
                  )}
                </div>
              </div>

              {/* Заголовок и текст */}
              <h3 style={{ fontSize: 20, marginBottom: 12, textTransform: 'none', letterSpacing: 0, fontWeight: 800 }}>
                {post.title}
              </h3>

              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#323a46', whiteSpace: 'pre-line', marginBottom: 16 }}>
                {post.content}
              </p>

              {/* Прикрепленные скриншоты / арты */}
              {Array.isArray(post.images) && post.images.length > 0 && (
                <div style={{ margin: '14px 0 20px', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--line, #e2e8f0)', maxHeight: 420, background: '#0a0d14' }}>
                  <img
                    src={post.images[0]}
                    alt={post.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}

              {/* Подвал действий: Лайк и Поделиться */}
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f4f8', paddingTop: 14 }}>
                <div className="row" style={{ gap: 10 }}>
                  <button
                    className={'btn sm ' + (post.iLiked ? 'primary' : 'dark')}
                    type="button"
                    onClick={() => toggleLike(post)}
                  >
                    <Icon n={post.iLiked ? 'heart-fill' : 'heart'} />
                    <span>{post.likesCount}</span>
                  </button>
                  <button
                    className="btn light sm"
                    type="button"
                    onClick={() => copyShare(post)}
                  >
                    <Icon n="arrow-up-right" />
                    <span>Поделиться</span>
                  </button>
                </div>

                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  +10 XP команде
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
