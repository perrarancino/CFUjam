import { PEOPLE } from './data.js';

const DETAILS = {
  alina_k: { bio: 'Придумываю игровые механики и собираю их в понятный игровой опыт. Люблю уютные пазлы и истории с характером.', skills: ['Геймдизайн', 'Godot', 'Прототипирование'] },
  danil_m: { bio: 'Пишу игровую логику и довожу прототипы до рабочего билда. Хочу собрать небольшой, но законченный проект за джем.', skills: ['C#', 'Unity', 'Godot'] },
  sofia_v: { bio: 'Рисую персонажей, окружение и покадровую анимацию. Люблю выразительные силуэты и тёплые цветовые палитры.', skills: ['Pixel Art', 'Aseprite', '2D-анимация'] },
  artem_r: { bio: 'Создаю звуковую атмосферу: от шагов персонажа до музыкальной темы. Ищу команду, которая любит экспериментировать.', skills: ['Звук', 'FMOD', 'Музыка'] },
  maria_l: { bio: 'Делаю игровые объекты и окружение. Нравятся стилизованные миры и небольшие команды с ясной идеей.', skills: ['Blender', '3D', 'Текстуры'] },
  kirill_n: { bio: 'Помогаю командам выбрать посильный объём и довести игру до финала. Могу подсказать по архитектуре и игровым механикам.', skills: ['Менторство', 'Unity', 'Геймдизайн'] },
  elena_p: { bio: 'Пишу диалоги и истории, которые раскрываются через игру. Ищу команду для небольшого сюжетного приключения.', skills: ['Сценарий', 'Нарратив', 'Диалоги'] },
  igor_t: { bio: 'Собираю прототипы и игровые интерфейсы. Люблю аркады с понятным управлением и приятной обратной связью.', skills: ['Godot', 'Программирование', 'UI'] }
};

export const PROFILES = [
  ...PEOPLE,
  { full: 'Елена Петрова', nick: 'elena_p', short: 'Елена П', role: 'сценарист', rate: '—', games: 1, jams: 1, cls: '', theme: 'g-green', kind: 'a' },
  { full: 'Игорь Титов', nick: 'igor_t', short: 'Игорь Т', role: 'программист', rate: '—', games: 1, jams: 1, cls: '', theme: 'g-blue', kind: 'a' }
].map((p) => ({ ...p, ...DETAILS[p.nick], avatar: `img/avatars/${p.nick}.webp`, demo: true }));

const normalize = (name = '') => name.trim().replace(/^@/, '').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
const byAlias = new Map();
for (const p of PROFILES) for (const alias of [p.nick, p.full, p.short]) byAlias.set(normalize(alias), p);
// Старые подписи капитанов в демо-вакансиях относятся к тем же участникам.
byAlias.set(normalize('Артём Романов'), byAlias.get('artem_r'));
byAlias.set(normalize('Кирилл Новиков'), byAlias.get('kirill_n'));

export function findProfile(name) { return byAlias.get(normalize(name)); }

export function profileOf(name, state) {
  const known = findProfile(name);
  if (known) return known;
  const user = state?.users?.find((u) => normalize(u.nick) === normalize(name));
  return {
    full: user?.displayName || name || 'Участник', nick: user?.nick || name || '',
    role: state?.user === name ? state.role : 'участник',
    bio: user?.bio || '', skills: user?.skills || [], avatar: user?.avatarUrl,
    games: state?.games?.filter((g) => g.owner === name).length || 0,
    jams: 0, rate: '—', cls: '', demo: false
  };
}
