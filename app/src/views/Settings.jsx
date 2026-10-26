import { useState } from 'react';
import { Banner, Check, Icon, Radio, Range, Switch } from '../components.jsx';
import { useApp } from '../store.jsx';

const ROLES = ['Программист', 'Художник', 'Геймдизайнер'];

export default function Settings() {
  const { S, update, toast } = useApp();
  const [sleep, setSleep] = useState(3);
  const opt = (k, on, off) => (v) => { update((d) => { d.opts[k] = v; }); toast(v ? on : off); };
  const sleepOut = sleep + (sleep < 4 ? ' ч (держись)' : sleep < 8 ? ' ч' : ' ч (ты точно на джеме?)');
  return (
    <>
      <Banner img="w08" title="Настройки" text="Уведомления, звуки, роль и внешний вид." />
      <div className="grid g2 pull">
        <div className="card">
          <h3><Icon n="sliders-horizontal" />Основное</h3>
          <div className="stack-v">
            <Switch id="sw-notify" checked={S.opts.notify} onChange={opt('notify', 'Уведомления включены', 'Уведомления выключены')}>Уведомления о джеме</Switch>
            <Switch id="sw-team" checked={S.opts.team} onChange={opt('team', 'Команда видна всем', 'Команда скрыта')}>Показывать мою команду</Switch>
            <Switch id="sw-snow" checked={S.opts.snow} onChange={opt('snow', 'Вращение галереи включено', 'Вращение галереи выключено')}>Вращение галереи</Switch>
            <Switch id="sw-anim" checked={S.opts.anim} onChange={opt('anim', 'Плавные анимации включены', 'Плавные анимации выключены')}>Плавные анимации</Switch>
          </div>
        </div>
        <div className="card">
          <h3><Icon n="user" />Участие</h3>
          <div className="stack-v">
            <Check id="ck-look" checked={S.opts.look} onChange={opt('look', 'Вас ищут в списке «ищу команду»', 'Вас больше нет в списке «ищу команду»')}>Ищу команду</Check>
            <Check id="ck-mentor" checked={S.opts.mentor} onChange={opt('mentor', 'Заявка на ментора отправлена', 'Заявка на ментора отозвана')}>Нужен ментор</Check>
            <div className="sep" style={{ margin: '2px 0' }} />
            {ROLES.map((r) => (
              <Radio key={r} name="role" checked={S.role === r} onChange={() => { update((d) => { d.role = r; }); toast('Роль: ' + r); }}>{r}</Radio>
            ))}
            <div className="sep" style={{ margin: '2px 0' }} />
            <Range id="rg-sleep" min={0} max={10} value={sleep} onChange={setSleep} label={{ text: 'Часов сна (честно)', out: sleepOut }} />
          </div>
        </div>
      </div>
    </>
  );
}
