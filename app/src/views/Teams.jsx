import { useEffect, useRef, useState } from 'react';
import { Avatar, Banner, Field, Icon, Range } from '../components.jsx';
import { hue, CHK, userRec } from '../lib.js';
import { useNav } from '../nav.jsx';
import { useApp } from '../store.jsx';

const DEFAULT_STACK = ['Алина К', 'Данил М', 'Софья В', 'Артём Р'];

export default function Teams() {
  const { S, update, toast, needAuth, gainXp } = useApp();
  const { show } = useNav();
  const [f, setF] = useState({ team: '', mail: '', nick: '', dir: 'Программирование', size: 4 });
  const [err, setErr] = useState({});
  const [up, setUp] = useState({ v: 72, busy: false });
  const timer = useRef(null);

  /* после входа подставляем почту и ник (только в пустые поля); после выхода очищаем */
  useEffect(() => {
    if (S.user) {
      const u = userRec(S, S.user);
      setF((x) => ({ ...x, mail: x.mail || (u ? u.email : ''), nick: x.nick || S.user }));
    } else setF((x) => ({ ...x, mail: '', nick: '' }));
  }, [S.user]);
  useEffect(() => () => clearInterval(timer.current), []);

  const team = S.user && S.teams[S.user];
  const set = (k) => (e) => {
    const v = e.target.value;
    setF((x) => ({ ...x, [k]: v }));
    const msg = !v ? '' : k === 'team' ? CHK.team(v) : k === 'mail' ? CHK.email(v.trim()) : k === 'nick' ? CHK.nick(S, v.trim(), S.user) : '';
    setErr((x) => ({ ...x, [k]: msg }));
  };

  const setSize = (n) => {
    setF((x) => ({ ...x, size: n }));
    if (team) update((d) => { const t = d.teams[d.user]; t.size = Math.max(n, t.members.length); });
  };

  const create = () => {
    if (!S.user) return needAuth('Чтобы создать команду, войдите в аккаунт');
    if (team) return toast('У вас уже есть команда «' + team.name + '»', 'warn');
    const e = { team: CHK.team(f.team), mail: CHK.email(f.mail.trim()), nick: CHK.nick(S, f.nick.trim(), S.user) };
    setErr(e);
    if (Object.values(e).some(Boolean)) return toast('Проверьте поля формы', 'err');
    const name = f.team.trim();
    update((d) => {
      d.teams[d.user] = { name, dir: f.dir, size: f.size, members: [d.user] };
      d.games.push({ id: 'u' + Date.now(), owner: d.user, title: name, dir: f.dir, hue: hue(name) });
    });
    gainXp(25); toast('Команда «' + name + '» создана', 'ok');
    setTimeout(() => show('games'), 900);
  };

  const upload = () => {
    if (!S.user) return needAuth('Чтобы загрузить сборку, войдите в аккаунт');
    if (up.busy) return;
    let v = 0;
    setUp({ v: 0, busy: true });
    timer.current = setInterval(() => {
      v = Math.min(100, v + 4 + Math.random() * 8);
      if (v >= 100) {
        clearInterval(timer.current);
        setUp({ v: 100, busy: false });
        toast('Сборка загружена', 'ok'); gainXp(15);
      } else setUp({ v, busy: true });
    }, 140);
  };

  const members = team ? team.members : DEFAULT_STACK;
  const total = team ? Math.max(team.size, team.members.length) : 5;
  return (
    <>
      <Banner img="w04" title="Команды" text="Создай команду, следи за составом и загружай сборку." />
      <div className="grid g2 pull">
        <div className="card" id="form-card">
          <h3><Icon n="clipboard-list" />Новая команда</h3>
          <div className="stack-v">
            <Field id="f-team" name="team" label="Название команды" placeholder="Например, «Белые волки»" hint="От 3 до 24 символов" error={err.team} value={f.team} onChange={set('team')} />
            <Field id="f-mail" name="mail" label="Почта" type="email" placeholder="you@cfuv.ru" hint="Для связи с командой" error={err.mail} value={f.mail} onChange={set('mail')} />
            <Field id="f-nick" name="nick" label="Ник" placeholder="Например, wolf_dev" hint="Контактный ник в команде" error={err.nick} value={f.nick} onChange={set('nick')} />
            <Field id="f-dir" name="dir" label="Направление">
              <select id="f-dir" value={f.dir} onChange={(e) => setF((x) => ({ ...x, dir: e.target.value }))}>
                <option>Программирование</option><option>Графика</option><option>Звук</option><option>Геймдизайн</option>
              </select>
            </Field>
            <Range id="rg-team" min={1} max={5} value={f.size} onChange={setSize} label={{ text: 'Размер команды' }} />
            <div className="row"><button className="btn dark" id="mk-team" type="button" onClick={create}><Icon n="rocket" />Создать команду</button></div>
          </div>
        </div>

        <div className="prof b g-green" id="team-card">
          <div className="grain" />
          <div className="pin">
            <h3><Icon n="users" /><span>{team ? `Команда «${team.name}»` : 'Команда «Чёрное море»'}</span></h3>
            <div className="avstack">
              {members.map((m) => <Avatar key={m} name={m} />)}
              {!team && <span className="av more"><i className="face">+12</i></span>}
            </div>
            <div className="row"><span className="chip ok"><i className="pt" />{members.length} из {total} мест занято</span></div>
            <div className="up">
              <div className="bar-l"><span>Загрузка сборки</span><span id="up-pct">{Math.round(up.v)}%</span></div>
              <div className="bar" id="up-bar" style={{ '--v': up.v + '%' }}><i /></div>
            </div>
            <div className="steps">
              <div className="step done"><i><b className="ico ico-check" /></i>Заявка</div>
              <div className="step done"><i><b className="ico ico-check" /></i>Команда</div>
              <div className="step cur"><i>3</i>Разработка</div>
              <div className="step"><i>4</i>Защита</div>
            </div>
            <button className="wide light" id="up-btn" type="button" disabled={up.busy} onClick={upload}><i className="circ"><Icon n="upload" /></i><span>Загрузить сборку</span></button>
          </div>
        </div>
      </div>
    </>
  );
}
