/* Общие функции: хеши, аватарки-«каракули», проверки полей */

export function hue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function hash(s) {
  let x = 5381;
  s = 'cfujam:' + s;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) >>> 0;
  return x.toString(36);
}

/* ---------- аватарки ---------- */
const SKIN = ['#ffe6cf', '#f6cfa8', '#e2ab80', '#b97d55'];
const INK = '#1d2a6b';
const HAIRC = [INK, INK, '#2a2a33', '#7a4320', '#d08a2e'];

function rngS(seed) {
  let x = (seed * 2654435761) % 4294967296;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

const faceCache = new Map();
export function faceSvg(name) {
  if (faceCache.has(name)) return faceCache.get(name);
  const h = hue(name), r = rngS(h * 131 + name.length * 7 + 1);
  const skin = SKIN[Math.floor(r() * 4)], hair = Math.floor(r() * 6), glasses = r() < 0.32, hc = HAIRC[Math.floor(r() * 5)];
  const shirt = `hsl(${(h + 160) % 360} 58% 46%)`;
  const st = ` stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  let v = '<svg viewBox="0 0 100 100" aria-hidden="true">';
  v += `<path d="M8 104C10 82 28 74 50 74S90 82 92 104Z" fill="${shirt}"${st}/>`;
  v += `<path d="M41 68V78L50 85L59 78V68Z" fill="${skin}"${st}/>`;
  if (hair === 2) v += `<path d="M26 44C21 74 28 86 38 88L62 88C72 86 79 74 74 44Z" fill="${hc}"${st}/>`;
  if (hair === 5) v += `<path d="M27 44C24 66 30 76 36 78L64 78C70 76 76 66 73 44Z" fill="${hc}"${st}/>`;
  v += `<circle cx="29.5" cy="52" r="4.2" fill="${skin}"${st}/><circle cx="70.5" cy="52" r="4.2" fill="${skin}"${st}/>`;
  v += `<ellipse cx="50" cy="48" rx="21" ry="24" fill="${skin}"${st}/>`;
  if (hair === 0) v += `<path d="M29 46C26 24 40 15 52 16C66 17 75 28 71 46C66 38 58 34 48 34C40 35 33 39 29 46Z" fill="${hc}"${st}/>`;
  if (hair === 1) v += `<path d="M28 48C24 22 44 10 58 15C72 20 76 34 72 48C70 40 64 33 52 32C42 32 34 38 28 48Z" fill="${hc}"${st}/>`;
  if (hair === 2) v += `<circle cx="50" cy="13" r="8" fill="${hc}"${st}/><path d="M30 44C30 26 42 18 50 18C60 18 70 26 70 44C62 38 56 34 50 34C42 34 34 38 30 44Z" fill="${hc}"${st}/>`;
  if (hair === 3) v += `<path d="M29 46L28 30L36 36L40 20L47 32L54 16L60 32L68 24L71 46C66 38 58 34 50 34C42 34 34 38 29 46Z" fill="${hc}"${st}/>`;
  if (hair === 4) v += `<path d="M28 42C28 22 42 14 50 14C60 14 72 22 72 42Z" fill="${shirt}"${st}/><path d="M58 40H84C84 45 80 47 72 47H58Z" fill="${shirt}"${st}/>`;
  if (hair === 5) v += `<path d="M28 48C26 24 40 16 50 16C62 16 74 24 72 48C68 40 60 34 50 34C40 34 32 40 28 48Z" fill="${hc}"${st}/>`;
  v += `<circle cx="42" cy="52" r="2.7" fill="${INK}"/><circle cx="58" cy="52" r="2.7" fill="${INK}"/>`;
  v += '<circle cx="36" cy="60" r="4" fill="#ff8f9c" opacity=".45"/><circle cx="64" cy="60" r="4" fill="#ff8f9c" opacity=".45"/>';
  v += `<path d="M44 62Q50 67.5 56 62" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  if (glasses) v += `<g fill="none" stroke="${INK}" stroke-width="2.4"><circle cx="42" cy="52" r="7"/><circle cx="58" cy="52" r="7"/><path d="M49 52H51"/></g>`;
  v += '</svg>';
  faceCache.set(name, v);
  return v;
}

/* форма аватарки: для постоянных участников — как раньше, для остальных по хешу */
const SHAPE_ORDER = [2, 0, 3, 1, 4, 7, 5, 6];
const KNOWN = ['Алина К', 'Данил М', 'Софья В', 'Артём Р', 'Мария Л', 'Кирилл Н', 'Елена П', 'Игорь Т'];
export function shapeIdx(name) {
  const k = KNOWN.indexOf(name);
  return k > -1 ? SHAPE_ORDER[k] : SHAPE_ORDER[hue(name) % 8];
}

/* ---------- проверки ---------- */
export const RESERVED = ['admin', 'alina_k', 'danil_m', 'sofia_v', 'moderator'];
const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_]{3,20}$/;
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function userRec(S, n) {
  n = (n || '').toLowerCase();
  return S.users.find((u) => u.nick.toLowerCase() === n);
}
export function nickTaken(S, n, self) {
  n = n.toLowerCase();
  if (self && self.toLowerCase() === n) return false;
  return RESERVED.includes(n) || !!userRec(S, n);
}
export const CHK = {
  nick: (S, v, self) => (!NICK_RE.test(v) ? 'От 3 до 20 символов: буквы, цифры, _' : nickTaken(S, v, self) ? 'Такой ник уже занят' : ''),
  email: (v) => (MAIL_RE.test(v) ? '' : 'Введите корректную почту'),
  pass: (v) => (v.length >= 6 ? '' : 'Минимум 6 символов'),
  team: (v) => { v = v.trim(); return v.length >= 3 && v.length <= 24 ? '' : 'От 3 до 24 символов'; }
};

export const ROUTES = ['home', 'teams', 'games', 'people', 'me'];

/* адрес файла из public относительно страницы (нужен для CSS-переменных --img: url() разрешается относительно файла стилей) */
export const asset = (path) => new URL(path, document.baseURI).href;
