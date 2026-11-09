import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Avatar, Check, Field, Icon, Modal } from './components.jsx';
import { CHK, hash, userRec } from './lib.js';
import { useApp } from './store.jsx';
import { profileOf } from './profiles.js';
import { BASE_GAMES } from './data.js';
import { saveMessage } from './messages.js';
import { useNav } from './nav.jsx';

/* ---------- вход / регистрация ---------- */
function AuthForm({ tab, setTab, close }) {
  const { S, update, toast, gainXp, openModal } = useApp();
  const [v, setV] = useState({ login: '', pass: '', nick: '', email: '', rules: false });
  const [err, setErr] = useState({});
  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setV((x) => ({ ...x, [k]: val }));
    if (tab === 'reg' && k !== 'rules') {
      const msg = k === 'nick' ? CHK.nick(S, val) : k === 'email' ? CHK.email(val) : k === 'pass' ? CHK.pass(val) : '';
      setErr((x) => ({ ...x, [k]: msg }));
    } else setErr((x) => ({ ...x, [k]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (tab === 'in') {
      const l = v.login.trim();
      const u = userRec(S, l) || S.users.find((x) => x.email.toLowerCase() === l.toLowerCase());
      const e1 = !l ? 'Введите ник или почту' : '';
      const e2 = !v.pass ? 'Введите пароль' : '';
      setErr({ login: e1, pass: e2 });
      if (e1 || e2) return;

      // 1. Попытка авторизации на реальном сервере
      try {
        const res = await api.login(l, v.pass);
        if (res && res.user) {
          update((d) => { d.user = res.user.username; d.isOnline = true; });
          close();
          toast('С возвращением, ' + res.user.username + '!', 'ok');
          return;
        }
      } catch {
        // Сервер недоступен или локальный пользователь -> проверяем локально
        if (u && u.pw === hash(v.pass)) {
          update((d) => { d.user = u.nick; });
          close();
          toast('С возвращением, ' + u.nick + '!', 'ok');
          return;
        }
        setErr({ login: !u ? 'Пользователь не найден' : '', pass: u && u.pw !== hash(v.pass) ? 'Неверный пароль' : '' });
      }
    } else {
      const nick = v.nick.trim(), email = v.email.trim();
      const errs = { nick: CHK.nick(S, nick), email: CHK.email(email), pass: CHK.pass(v.pass), rules: v.rules ? '' : 'Нужно принять правила' };
      if (!errs.email && S.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) errs.email = 'Эта почта уже зарегистрирована';
      setErr(errs);
      if (Object.values(errs).some(Boolean)) return;

      // 1. Попытка регистрации на сервере
      try {
        const res = await api.register(nick, email, v.pass);
        if (res && res.user) {
          update((d) => { d.user = res.user.username; d.isOnline = true; });
          close();
          toast('Аккаунт создан. Добро пожаловать, ' + nick + '!', 'ok');
          setTimeout(() => gainXp(10), 0);
          return;
        }
      } catch {
        // Оффлайн fallback
        update((d) => { d.users.push({ nick, email, pw: hash(v.pass), at: Date.now() }); d.user = nick; });
        close();
        toast('Аккаунт создан. Добро пожаловать, ' + nick + '!', 'ok');
        setTimeout(() => gainXp(10), 0);
      }
    }
  };

  return (
    <form noValidate className="stack-v" onSubmit={submit}>
      <div className="oauth">
        <button className="btn light block" type="button" onClick={() => openModal({ type: 'oauth', id: 'vk' })}><b className="obadge vk">VK</b><span>Войти через VK</span></button>
        <button className="btn light block" type="button" onClick={() => openModal({ type: 'oauth', id: 'google' })}><b className="obadge gg">G</b><span>Войти через Google</span></button>
      </div>
      <div className="orsep"><span>или ник и пароль</span></div>
      {tab === 'in' ? (
        <>
          <Field id="a_login" name="login" label="Ник или почта" placeholder="alina или you@cfuv.ru" hint="Тот, что указывали при регистрации" error={err.login} value={v.login} onChange={set('login')} autoComplete="username" />
          <Field id="a_pass" name="pass" label="Пароль" type="password" placeholder="••••••" hint="Минимум 6 символов" error={err.pass} value={v.pass} onChange={set('pass')} autoComplete="current-password" />
          <button className="btn primary block" type="submit"><Icon n="log-in" />Войти</button>
          <p className="hintp">Нет аккаунта? Переключитесь на «Регистрация».</p>
        </>
      ) : (
        <>
          <Field id="a_nick" name="nick" label="Ник" placeholder="например, alina" hint="От 3 до 20 символов: буквы, цифры, _" error={err.nick} value={v.nick} onChange={set('nick')} autoComplete="username" />
          <Field id="a_email" name="email" label="Почта" type="email" placeholder="you@cfuv.ru" hint="Для уведомлений о джеме" error={err.email} value={v.email} onChange={set('email')} autoComplete="email" />
          <Field id="a_pass" name="pass" label="Пароль" type="password" placeholder="••••••" hint="Минимум 6 символов" error={err.pass} value={v.pass} onChange={set('pass')} autoComplete="new-password" />
          <Check checked={v.rules} onChange={(c) => { setV((x) => ({ ...x, rules: c })); setErr((x) => ({ ...x, rules: '' })); }}>
            Принимаю правила джема
          </Check>
          {err.rules && <small className="rerr">{err.rules}</small>}
          <button className="btn primary block" type="submit"><Icon n="user-plus" />Создать аккаунт</button>
        </>
      )}
    </form>
  );
}

export function AuthModal({ tab: t0 = 'in', onClose }) {
  const [tab, setTab] = useState(t0);
  return (
    <Modal title={tab === 'reg' ? 'Присоединяйся к джему' : 'С возвращением'} onClose={onClose}>
      {(close) => (
        <>
          <div className="tabs">
            <button type="button" className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Вход</button>
            <button type="button" className={tab === 'reg' ? 'on' : ''} onClick={() => setTab('reg')}>Регистрация</button>
          </div>
          <AuthForm key={tab} tab={tab} setTab={setTab} close={close} />
        </>
      )}
    </Modal>
  );
}

/* ---------- демо-вход через VK / Google: ничего не сохраняется ---------- */
const PROV = {
  vk: { name: 'VK', badge: 'vk', who: 'Демо-аккаунт VK', nick: 'vk_demo', mail: 'demo@vk.example', mark: 'VK' },
  google: { name: 'Google', badge: 'gg', who: 'Демо-аккаунт Google', nick: 'google_demo', mail: 'demo@gmail.example', mark: 'G' }
};
export function OAuthModal({ id, onClose }) {
  const { update, toast, openModal } = useApp();
  const pv = PROV[id];
  const allow = (close) => {
    update((d) => {
      d.demo = id;
      if (!userRec(d, pv.nick)) d.users.push({ nick: pv.nick, email: pv.mail, pw: '', at: Date.now(), demo: id });
      d.user = pv.nick;
    });
    close();
    toast('Вход через ' + pv.name + ' (демо): ничего не сохраняется', 'ok');
  };
  return (
    <Modal title={'Вход через ' + pv.name} onClose={onClose}>
      {(close) => (
        <div className="consent">
          <div className="cs-head"><b className={'obadge ' + pv.badge}>{pv.mark}</b><span>{pv.name}</span></div>
          <p className="cs-ask"><b>CFU Game Jam</b> запрашивает доступ к вашему имени и аватарке</p>
          <div className="cs-acc"><Avatar name={pv.who} cls="sm" /><div><b>{pv.who}</b><small>{pv.mail}</small></div></div>
          <ul className="cs-list"><li><Icon n="check" />Имя и аватарка</li><li><Icon n="check" />Без доступа к друзьям и сообщениям</li></ul>
          <div className="cs-btns">
            <button className="btn primary" type="button" onClick={() => allow(close)}>Разрешить</button>
            <button className="btn light" type="button" onClick={() => openModal({ type: 'auth', tab: 'in' })}>Отмена</button>
          </div>
          <p className="hintp">Это демо: настоящий вход не подключён, данные никуда не отправляются и не сохраняются. После обновления страницы вы выйдете из аккаунта.</p>
        </div>
      )}
    </Modal>
  );
}

/* ---------- сообщение ---------- */
export function WriteModal({ who, onClose }) {
  const { S, update, toast, needAuth } = useApp();
  const { show } = useNav();
  const [t, setT] = useState('');
  const [e, setE] = useState('');
  const submit = (ev, close) => {
    ev.preventDefault();
    const s = t.trim();
    if (!S.user) return needAuth('Войдите, чтобы сохранить сообщение');
    if (!s) return setE('Напишите хоть пару слов');
    if (s.length > 300) return setE('Слишком длинно: ' + s.length + '/300');
    update((d) => saveMessage(d, who, s));
    close(); toast('Сообщение сохранено в переписке', 'ok'); show('messages');
  };
  return (
    <Modal title={'Сообщение для ' + who} onClose={onClose}>
      {(close) => (
        <form noValidate className="stack-v" onSubmit={(ev) => submit(ev, close)}>
          <p className="hintp">Сообщение сохранится в этом браузере. Доставка другим участникам пока не подключена.</p>
          <div className={'field' + (e ? ' err' : '')}>
            <label htmlFor="m_t">Текст</label>
            <textarea id="m_t" rows={4} placeholder="Привет! Хочешь в нашу команду?" value={t} onChange={(x) => { setT(x.target.value); setE(''); }} />
            <small>{e || 'До 300 символов'}</small>
          </div>
          <button className="btn primary block" type="submit"><Icon n="send" />Сохранить сообщение</button>
        </form>
      )}
    </Modal>
  );
}

/* ---------- входящие ---------- */
const MSGS = [['Данил М', 'Привет! Нужен программист на Godot?'], ['Софья В', 'Присоединяйся к «Тихому берегу»!'], ['Кирилл Н', 'Ментор на связи, пиши в любое время.']];
export function MessagesModal({ onClose }) {
  const { S, update, toast } = useApp();
  return (
    <Modal title="Сообщения" onClose={onClose}>
      {(close) => (
        <>
          {S.msgs > 0 ? MSGS.slice(0, Math.min(3, S.msgs)).map((m) => (
            <div className="msgr" key={m[0]}><Avatar name={m[0]} cls="on" /><div><b>{m[0]}</b><p>{m[1]}</p></div></div>
          )) : <p className="hintp">Новых сообщений нет.</p>}
          {S.msgs > 0 && <button className="btn primary block" type="button" onClick={() => { update((d) => { d.msgs = 0; }); close(); toast('Все сообщения прочитаны'); }}><Icon n="check" />Прочитано</button>}
        </>
      )}
    </Modal>
  );
}

/* ---------- заявки в команду (LFG & Инвайты) ---------- */
const REQ = ['Артём Р', 'Мария Л', 'Игорь Т', 'Елена П'];
export function RequestsModal({ onClose }) {
  const { S, update, toast, gainXp } = useApp();
  const [liveInvites, setLiveInvites] = useState([]);

  useEffect(() => {
    if (S.isOnline) {
      api.getMyInvites().then((res) => {
        const all = [...(res.receivedInvites || []), ...(res.teamRequests || [])];
        setLiveInvites(all);
      }).catch(() => {});
    }
  }, [S.isOnline]);

  const respondLive = async (inviteId, accept) => {
    try {
      await api.respondInvite(inviteId, accept);
      setLiveInvites((prev) => prev.filter((x) => x.id !== inviteId));
      toast(accept ? 'Заявка принята!' : 'Заявка отклонена', 'ok');
      if (accept) gainXp(15);
    } catch (e) {
      toast(e.message || 'Ошибка обработки заявки', 'warn');
    }
  };

  const n = Math.min(4, S.reqs);
  const rows = Array.from({ length: n }, (_, i) => REQ[(S.reqIdx + i) % 4]);
  const no = () => { update((d) => { d.reqs--; d.reqIdx++; }); toast('Заявка отклонена'); };
  const ok = (nm) => {
    const t = S.user && S.teams[S.user];
    if (!t) return toast('Сначала войдите и создайте команду', 'warn');
    if (t.members.length >= Math.min(t.size, 5)) return toast('Команда заполнена: максимум 5 участников', 'warn');
    update((d) => { const tt = d.teams[d.user]; if (!tt.members.includes(nm)) tt.members.push(nm); d.reqs--; d.reqIdx++; });
    toast(nm + ' в вашей команде', 'ok'); gainXp(5);
  };

  return (
    <Modal title="Заявки в команду" onClose={onClose}>
      {/* 1. Если на связи с сервером и есть реальные заявки */}
      {S.isOnline && liveInvites.length > 0 ? (
        <>
          {liveInvites.map((inv) => {
            const senderName = inv.from?.displayName || inv.from?.username || inv.user?.displayName || 'Участник';
            const subtitle = inv.team?.name ? `Приглашение в команду «${inv.team.name}»` : 'Хочет в вашу команду';
            return (
              <div className="msgr" key={inv.id}>
                <Avatar name={senderName} />
                <div><b>{senderName}</b><p>{subtitle}</p></div>
                <div className="row">
                  <button className="btn primary sm" type="button" aria-label="Принять" onClick={() => respondLive(inv.id, true)}><Icon n="check" /></button>
                  <button className="btn ghost sm" type="button" aria-label="Отклонить" onClick={() => respondLive(inv.id, false)}><Icon n="x" /></button>
                </div>
              </div>
            );
          })}
        </>
      ) : S.reqs > 0 ? (
        /* 2. Демо-заявки для оффлайна */
        <>
          {rows.map((nm) => (
            <div className="msgr" key={nm}>
              <Avatar name={nm} />
              <div><b>{nm}</b><p>Хочет в вашу команду</p></div>
              <div className="row">
                <button className="btn primary sm" type="button" aria-label="Принять" onClick={() => ok(nm)}><Icon n="check" /></button>
                <button className="btn ghost sm" type="button" aria-label="Отклонить" onClick={no}><Icon n="x" /></button>
              </div>
            </div>
          ))}
          {S.reqs > n && <p className="hintp">И ещё {S.reqs - n} заявок ждут ответа.</p>}
        </>
      ) : <p className="hintp">Заявок пока нет.</p>}
    </Modal>
  );
}

/* ---------- публикация в дневник разработки ---------- */
export function DevlogComposeModal({ onCreated, onClose }) {
  const { S, toast, gainXp } = useApp();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [img, setImg] = useState('img/generated/students-work.png');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const teamName = (S.user && S.teams[S.user]?.name) || 'Команда джема';

  const PRESETS = [
    { label: 'Студенты за работой', val: 'img/generated/students-work.png' },
    { label: 'Лунный садовник (2D)', val: 'img/generated/moon-garden-user.png' },
    { label: 'Тихий берег (3D)', val: 'img/generated/quiet-shore.png' },
    { label: 'Чайка и ветер', val: 'img/generated/seagull.png' },
    { label: 'Гейминг зона', val: 'img/generated/gaming-user.png' }
  ];

  const submit = async (e, close) => {
    e.preventDefault();
    if (!title.trim() || title.length < 3) return setErr('Введите заголовок (от 3 символов)');
    if (!content.trim() || content.length < 10) return setErr('Опишите прогресс подробнее (от 10 символов)');
    setErr('');

    setBusy(true);
    const newPost = {
      id: 'devlog-' + Date.now(),
      title: title.trim(),
      content: content.trim(),
      images: img ? [img] : [],
      likesCount: 0,
      createdAt: new Date().toISOString(),
      author: { username: S.user, displayName: S.user },
      team: { name: teamName },
      iLiked: false
    };

    if (S.isOnline) {
      try {
        const res = await api.createDevlog('current', {
          title: newPost.title,
          content: newPost.content,
          images: newPost.images
        });
        if (res && res.id) newPost.id = res.id;
      } catch (err) {
        toast('Опубликовано локально: ' + (err.message || ''), 'warn');
      }
    }

    setBusy(false);
    if (onCreated) onCreated(newPost);
    close();
  };

  return (
    <Modal title="Новая запись в дневник" onClose={onClose}>
      {(close) => (
        <form noValidate className="stack-v" onSubmit={(e) => submit(e, close)}>
          <div className="alert info">
            <span className="aic"><Icon n="info" /></span>
            <div>Публикация от имени команды <b>«{teamName}»</b> (+10 XP)</div>
          </div>
          <div className={'field' + (err.includes('заголовок') ? ' err' : '')}>
            <label htmlFor="d_title">Заголовок записи</label>
            <input
              id="d_title"
              type="text"
              placeholder="Например: День 1: Собрали прототип на Godot 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className={'field' + (err.includes('прогресс') ? ' err' : '')}>
            <label htmlFor="d_content">Что сделано / Описание прогресса</label>
            <textarea
              id="d_content"
              rows={5}
              placeholder="Расскажите о механике, сложностях, арте, музыке или покажите первый билд..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d_img">Скриншот или арт</label>
            <select id="d_img" value={img} onChange={(e) => setImg(e.target.value)}>
              {PRESETS.map((p) => <option key={p.val} value={p.val}>{p.label}</option>)}
            </select>
          </div>
          {err && <small className="rerr">{err}</small>}
          <button className="btn primary block" type="submit" disabled={busy}>
            <Icon n="rocket" />
            <span>{busy ? 'Публикация…' : 'Опубликовать в дневник'}</span>
          </button>
        </form>
      )}
    </Modal>
  );
}

/* ---------- анкета участника на бирже тимейтов (LFG) ---------- */
export function LfgProfileModal({ onClose }) {
  const { S, update, toast, gainXp } = useApp();
  const [role, setRole] = useState(S.role || 'Программист');
  const [skills, setSkills] = useState('Godot 4, C#, шейдеры, UI');
  const [bio, setBio] = useState('Ищу команду на джем! Готов писать механику геймплея и логику уровней.');

  const save = async (e, close) => {
    e.preventDefault();
    update((d) => {
      d.role = role;
    });

    if (S.isOnline) {
      try {
        await api.updateMyLfgProfile({
          bio: bio.trim(),
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean)
        });
      } catch {
        // оффлайн
      }
    }

    toast('Анкета на бирже тимейтов сохранена!', 'ok');
    gainXp(5);
    close();
  };

  return (
    <Modal title="Моя анкета на бирже тимейтов" onClose={onClose}>
      {(close) => (
        <form noValidate className="stack-v" onSubmit={(e) => save(e, close)}>
          <div className="field">
            <label htmlFor="lfg_role">Специализация</label>
            <select id="lfg_role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Программист</option>
              <option>2D Художник / Pixel Art</option>
              <option>3D Моделлер</option>
              <option>Геймдизайнер</option>
              <option>Саунд-дизайнер / Композитор</option>
              <option>Сценарист / Нарратив</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="lfg_skills">Навыки и стек (через запятую)</label>
            <input
              id="lfg_skills"
              type="text"
              placeholder="Unity, C#, Blender, FMOD..."
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <small>По этим тегам вас смогут найти капитаны команд</small>
          </div>
          <div className="field">
            <label htmlFor="lfg_bio">О себе / Кого ищете</label>
            <textarea
              id="lfg_bio"
              rows={4}
              placeholder="Расскажите о своем опыте, любимых жанрах и сколько времени готовы уделять разработке..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <button className="btn primary block" type="submit">
            <Icon n="check" />
            <span>Сохранить анкету</span>
          </button>
        </form>
      )}
    </Modal>
  );
}

function PublicProfileModal({ who, profile, onClose }) {
  const { S, needAuth, openModal } = useApp();
  const p = profile || profileOf(who, S);
  const games = BASE_GAMES.filter((g) => g.crew.some((name) => profileOf(name, S).nick === p.nick));
  return (
    <Modal title="Профиль участника" onClose={onClose}>
      <div className="public-profile">
        <div className="profile-intro"><Avatar name={p.nick} cls="xl" interactive={false} /><div><h4>{p.full}</h4><span className="handle">@{p.nick}</span><p>{p.role}</p></div></div>
        {p.demo && <span className="badge">Демо-профиль</span>}
        <p className="profile-bio">{p.bio || 'Участник пока не добавил описание.'}</p>
        {!!p.skills?.length && <div className="row profile-skills">{p.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div>}
        <div className="stats">
          <div><Icon n="star" /><b>{p.rate}</b><small>Рейтинг</small></div>
          <div><Icon n="gamepad-2" /><b>{p.games}</b><small>Игр</small></div>
          <div><Icon n="flag" /><b>{p.jams}</b><small>Джемов</small></div>
        </div>
        {!!games.length && <div className="profile-projects"><h4>Проекты на сайте</h4>{games.map((g) => <div key={g.id}><b>{g.title}</b><p>{g.text}</p></div>)}</div>}
        <button className="btn dark block" type="button" onClick={() => S.user ? openModal({ type: 'write', who: p.full }) : needAuth('Войдите, чтобы писать сообщения')}><Icon n="send" />Написать сообщение</button>
      </div>
    </Modal>
  );
}

function NotificationsModal({ onClose }) {
  const { S, update, needAuth, openModal } = useApp();
  const { show } = useNav();
  const notifications = (S.notifications || []).filter((n) => n.user === S.user);
  const markRead = () => update((d) => { for (const n of d.notifications || []) if (n.user === d.user) n.read = true; });
  return <Modal title="Уведомления" onClose={onClose}>
    {!S.user ? <div className="stack-v"><p>Войдите, чтобы видеть события своей команды и приглашения.</p><button className="btn primary" onClick={() => needAuth('Войдите, чтобы открыть уведомления')}>Войти</button></div> : <div className="stack-v">
      {notifications.length ? notifications.map((n) => <button className={'notification-item' + (n.read ? '' : ' unread')} key={n.id} onClick={() => { update((d) => { const found = d.notifications.find((item) => item.id === n.id); if (found) found.read = true; }); onClose(); show(n.route || 'teams'); }}><Icon n="bell" /><span>{n.text}</span></button>) : <p className="hintp">Новых уведомлений пока нет.</p>}
      {notifications.some((n) => !n.read) && <button className="btn secondary sm" onClick={markRead}>Прочитать все</button>}
      <button className="btn secondary" onClick={() => openModal({ type: 'reqs' })}><Icon n="users" />Заявки и приглашения в команду</button>
    </div>}
  </Modal>;
}

export function Modals() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  const key = modal.type + (modal.id || modal.tab || modal.who || '');
  if (modal.type === 'notifications') return <NotificationsModal key={key} onClose={closeModal} />;
  if (modal.type === 'profile') return <PublicProfileModal key={key} who={modal.who} profile={modal.profile} onClose={closeModal} />;
  if (modal.type === 'auth') return <AuthModal key={key} tab={modal.tab} onClose={closeModal} />;
  if (modal.type === 'oauth') return <OAuthModal key={key} id={modal.id} onClose={closeModal} />;
  if (modal.type === 'write') return <WriteModal key={key} who={modal.who} onClose={closeModal} />;
  if (modal.type === 'msgs') return <MessagesModal key={key} onClose={closeModal} />;
  if (modal.type === 'reqs') return <RequestsModal key={key} onClose={closeModal} />;
  if (modal.type === 'devlog_compose') return <DevlogComposeModal key={key} onCreated={modal.onCreated} onClose={closeModal} />;
  if (modal.type === 'lfg_profile') return <LfgProfileModal key={key} onClose={closeModal} />;
  return null;
}
