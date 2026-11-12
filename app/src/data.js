import raw from './data.json';

export const CAPTIONS = raw.captions;
export const GENRES = raw.genres;

/* участники: [полное имя, ник, короткое имя, тема, вид карточки, роль, рейтинг, игры, джемы, класс аватарки] */
export const PEOPLE = raw.people.map(([full, nick, short, theme, kind, role, rate, games, jams, cls]) => ({ full, nick, short, theme, kind, role, rate, games, jams, cls }));

/* картинки: c01–c16 вертикальные, w01–w09 широкие (баннеры) */
export const COVERS = ['moon-garden-user', 'quiet-shore', 'seagull'];
export const BANNERS = { w01: 'students-work', w02: 'gaming-user', w03: 'ranking-user', w04: 'students-work', w05: 'gaming-user', w06: 'students-rest', w09: 'students-work' };
export const bannerImage = (name) => `img/generated/${BANNERS[name] || 'students-work'}.png`;
export const cover = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return COVERS[h % COVERS.length];
};

/* демонстрационные игры в каталоге */
export const BASE_GAMES = [
  {
    id: 'frutiger-aero-2',
    title: 'Frutiger Aero 2',
    text: 'Уютный аквариум в стиле Frutiger Aero. Собирай рыбок и обустраивай свой подводный мир.',
    tags: ['Godot', '2D', 'Симулятор', 'Для браузера'],
    cover: 'frutiger-aero-2',
    base: 0,
    crew: [],
    gameRepositoryUrl: 'https://github.com/perrarancino/test'
  },
  { id: 'g0', title: 'Лунный садовник', text: 'Выращивай цветы в тишине ночного Крыма. Godot, 2D.', tags: ['Godot', 'Пазл', '2D'], cover: 'moon-garden-user', base: 128, crew: ['Алина К', 'Данил М', 'Софья В'] },
  { id: 'g1', title: 'Тихий берег', text: 'Хоррор про заброшенный маяк. Unity, 3D.', tags: ['Unity', 'Хоррор', '3D'], cover: 'quiet-shore', base: 96, crew: ['Артём Р', 'Мария Л'] },
  { id: 'g2', title: 'Чайка и ветер', text: 'Аркада про полёт над побережьем. Pixel Art.', tags: ['Pixel Art', 'Аркада', '2D'], cover: 'seagull', base: 74, crew: ['Кирилл Н', 'Елена П', 'Игорь Т'] }
];
export const TAGS = [
  'Pixel Art', '2D', '3D', 'Платформер', 'Хоррор', 'Пазл', 'Аркада',
  'Приключение', 'Экшен', 'Ролевая', 'Стратегия', 'Симулятор', 'Выживание',
  'Рогалик', 'Метроидвания', 'Визуальная новелла', 'Ритм', 'Гонки', 'Шутер',
  'Исследование', 'Сюжетная', 'Атмосферная', 'Уютная', 'Юмор',
  'Одиночная', 'Кооператив', 'Мультиплеер', 'Для браузера',
  'Unity', 'Godot', 'Unreal', 'GameMaker', 'Construct', 'Новая'
];
