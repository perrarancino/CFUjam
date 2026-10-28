import { useState } from 'react';
import { Avatar, Check, Field, Icon, Modal } from './components.jsx';
import { CHK, hash, userRec } from './lib.js';
import { useApp } from './store.jsx';

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

  const submit = (e) => {
    e.preventDefault();
    if (tab === 'in') {
      const l = v.login.trim();
      const u = userRec(S, l) || S.users.find((x) => x.email.toLowerCase() === l.toLowerCase());
      const e1 = !l ? 'Введите ник или почту' : !u ? 'Пользователь не найден' : '';
      const e2 = !v.pass ? 'Введите пароль' : u && u.pw !== hash(v.pass) ? 'Неверный пароль' : '';
      setErr({ login: e1, pass: e2 });
      if (e1 || e2) return;
      update((d) => { d.user = u.nick; });
      close(); toast('С возвращением, ' + u.nick + '!', 'ok');
    } else {
      const nick = v.nick.trim(), email = v.email.trim();
      const errs = { nick: CHK.nick(S, nick), email: CHK.email(email), pass: CHK.pass(v.pass), rules: v.rules ? '' : 'Нужно принять правила' };
      if (!errs.email && S.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) errs.email = 'Эта почта уже зарегистрирована';
      setErr(errs);
      if (Object.values(errs).some(Boolean)) return;
      update((d) => { d.users.push({ nick, email, pw: hash(v.pass), at: Date.now() }); d.user = nick; });
      close(); toast('Аккаунт создан. Добро пожаловать, ' + nick + '!', 'ok');
      setTimeout(() => gainXp(10), 0);
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
      d.demo = id;                                  /* с этого момента состояние не пишется в localStorage */
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
  const { toast, gainXp } = useApp();
  const [t, setT] = useState('');
  const [e, setE] = useState('');
  const submit = (ev, close) => {
    ev.preventDefault();
    const s = t.trim();
    if (!s) return setE('Напишите хоть пару слов');
    if (s.length > 300) return setE('Слишком длинно: ' + s.length + '/300');
    close(); toast('Сообщение отправлено', 'ok'); gainXp(5);
  };
  return (
    <Modal title={'Сообщение для ' + who} onClose={onClose}>
      {(close) => (
        <form noValidate className="stack-v" onSubmit={(ev) => submit(ev, close)}>
          <div className={'field' + (e ? ' err' : '')}>
            <label htmlFor="m_t">Текст</label>
            <textarea id="m_t" rows={4} placeholder="Привет! Хочешь в нашу команду?" value={t} onChange={(x) => { setT(x.target.value); setE(''); }} />
            <small>{e || 'До 300 символов'}</small>
          </div>
          <button className="btn primary block" type="submit"><Icon n="send" />Отправить</button>
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

const REQ = ['Артём Р', 'Мария Л', 'Игорь Т', 'Елена П'];
export function RequestsModal({ onClose }) {
  const { S, update, toast, gainXp } = useApp();
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
      {S.reqs > 0 ? (
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

export function Modals() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  const key = modal.type + (modal.id || modal.tab || modal.who || '');
  if (modal.type === 'auth') return <AuthModal key={key} tab={modal.tab} onClose={closeModal} />;
  if (modal.type === 'oauth') return <OAuthModal key={key} id={modal.id} onClose={closeModal} />;
  if (modal.type === 'write') return <WriteModal key={key} who={modal.who} onClose={closeModal} />;
  if (modal.type === 'msgs') return <MessagesModal key={key} onClose={closeModal} />;
  if (modal.type === 'reqs') return <RequestsModal key={key} onClose={closeModal} />;
  return null;
}
