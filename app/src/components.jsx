import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { asset, faceSvg, hue, shapeIdx } from './lib.js';
import { bannerImage } from './data.js';
import { useApp } from './store.jsx';
import { profileOf } from './profiles.js';

/* иконка: набор масок описан в styles.css (.ico-имя) */
export function Icon({ n, cls }) {
  return <i className={'ico ico-' + n + (cls ? ' ' + cls : '')} />;
}

/* аватарка с «каракулей» и формой по имени */
export function Avatar({ name = '', cls = '', mark, interactive = true }) {
  const { S, openModal } = useApp();
  const profile = profileOf(name, S);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profile.avatar]);
  const classes = profile.demo ? cls.replace(/\b(?:on|away|r-mentor|r-org|r-jury|r-win)\b/g, '') + ' ' + profile.cls : cls;
  const hasRing = /\br-(mentor|org|jury|win)\b/.test(classes);
  const open = (e) => { e.stopPropagation(); openModal({ type: 'profile', who: profile.nick || name }); };
  return (
    <span className={`av ${classes} sh${shapeIdx(profile.nick || name)}`.replace(/\s+/g, ' ')} data-n={profile.full} style={{ '--h': hue(profile.nick || name) }}
      role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Профиль: ${profile.full}` : undefined} title={profile.full}
      onClick={interactive ? open : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } } : undefined}>
      {profile.avatar && !failed
        ? <i className="face"><img src={asset(profile.avatar)} alt={profile.full} onError={() => setFailed(true)} loading="lazy" /></i>
        : <i className="face" dangerouslySetInnerHTML={{ __html: faceSvg(profile.nick || name) }} />}
      {(hasRing || mark) && <em className="mk" />}
    </span>
  );
}

/* баннер вкладки */
export function Banner({ img, title, text }) {
  return (
    <header className="vbanner" style={{ '--img': `url(${asset(bannerImage(img))})`, '--imgm': `url(${asset(bannerImage(img))})` }}>
      <div className="vb-in"><h2>{title}</h2><p>{text}</p></div>
    </header>
  );
}

/* поле формы с подсказкой/ошибкой */
export function Field({ id, name, label, type = 'text', placeholder, hint, error, value, onChange, autoComplete = 'off', children }) {
  return (
    <div className={'field' + (error ? ' err' : '')} data-f={name || id}>
      <label htmlFor={id}>{label}</label>
      {children || <input id={id} name={name || id} type={type} placeholder={placeholder} autoComplete={autoComplete} value={value} onChange={onChange} />}
      {(hint || error) && <small>{error || hint}</small>}
    </div>
  );
}

/* ползунок: подсветка заполнения через --p */
export function Range({ id, min, max, value, onChange, label }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div>
      {label && <div className="rangebox"><span>{label.text}</span><output>{label.out ?? value}</output></div>}
      <input type="range" id={id} min={min} max={max} value={value} style={{ '--p': p + '%' }} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

/* переключатель / флажок / радио */
export function Switch({ id, checked, onChange, children }) {
  return (
    <label className="switch"><input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} /><i className="track"><i className="knob" /></i><span>{children}</span></label>
  );
}
export function Check({ id, checked, onChange, children }) {
  return (
    <label className="check"><input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} /><i className="box" /><span>{children}</span></label>
  );
}
export function Radio({ name, checked, onChange, children }) {
  return (
    <label className="radio"><input type="radio" name={name} checked={checked} onChange={onChange} /><i className="rd" /><span>{children}</span></label>
  );
}

/* окно */
export function Modal({ title, onClose, children }) {
  const [out, setOut] = useState(false);
  const close = () => { setOut(true); setTimeout(onClose, 180); };
  useEffect(() => {
    document.body.classList.add('lock');
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('lock'); document.removeEventListener('keydown', onKey); };
  }, []);
  return createPortal(
    <div className={'ovl' + (out ? ' out' : '')} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label={title}>
        <button className="x" type="button" aria-label="Закрыть" onClick={close}><Icon n="x" /></button>
        <h3>{title}</h3>
        <div className="dbody">{typeof children === 'function' ? children(close) : children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Toasts() {
  const { toasts } = useApp();
  const ic = { ok: 'circle-check', warn: 'triangle-alert', err: 'circle-x', info: 'info' };
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}${t.out ? ' out' : ''}`}><Icon n={ic[t.type]} /><span>{t.msg}</span></div>
      ))}
    </div>,
    document.body
  );
}
