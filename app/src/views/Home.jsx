import { memo, useEffect, useState } from 'react';
import { Icon } from '../components.jsx';
import { CAPTIONS, GENRES } from '../data.js';
import { asset } from '../lib.js';
import { useNav } from '../nav.jsx';

/* 3D-карусель: 40 слайдов. Разметка статичная — её двигает legacy-скрипт карусели, поэтому React к ней не прикасается */
const SLIDES = Array.from({ length: 40 }, (_, i) => {
  const k = i % 16, f = 'c' + String(k + 1).padStart(2, '0');
  const lazy = i >= 14 && i < 30 ? 'loading="lazy"' : '';
  return `<figure class="slide" style="--i:${i}"><div class="in"><img src="img/${f}.jpg" srcset="img/s/${f}.jpg 360w, img/${f}.jpg 720w" sizes="(max-width:700px) 110px, 15vw" alt="" draggable="false" ${lazy}><span class="gen">${GENRES[k]}</span><figcaption>${CAPTIONS[k]}</figcaption></div></figure>`;
}).join('');

const Ring = memo(function Ring() {
  return <div className="ring" dangerouslySetInnerHTML={{ __html: SLIDES }} />;
});

function Countdown() {
  const target = new Date('2026-12-05T10:00:00').getTime();
  const calc = () => {
    const d = Math.max(0, target - Date.now()) / 1000;
    return { d: Math.floor(d / 86400), h: Math.floor((d % 86400) / 3600), m: Math.floor((d % 3600) / 60), s: Math.floor(d % 60) };
  };
  const [v, setV] = useState(calc);
  useEffect(() => { const t = setInterval(() => setV(calc()), 1000); return () => clearInterval(t); }, []);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <div className="count" id="count">
      <div><b>{pad(v.d)}</b><small>дней</small></div>
      <div><b>{pad(v.h)}</b><small>часов</small></div>
      <div><b>{pad(v.m)}</b><small>минут</small></div>
      <div><b>{pad(v.s)}</b><small>секунд до старта</small></div>
    </div>
  );
}

const Big = ({ cls = '', go, img, label, title, btn, text }) => {
  const { show } = useNav();
  return (
    <article className={'big ' + cls} onClick={() => show(go)}>
      <div className="shot" style={{ '--img': `url(${asset(`img/${img}.jpg`)})`, '--imgm': `url(${asset(`img/m/${img}.jpg`)})` }}><span className="shot-label">{label}</span></div>
      <div className="big-foot">
        <div><h3>{title}</h3><button className="btn primary" type="button" onClick={(e) => { e.stopPropagation(); show(go); }}>{btn}</button></div>
        <p>{text}</p>
      </div>
    </article>
  );
};

export default function Home({ user, onRegister }) {
  const { show } = useNav();
  return (
    <>
      <div className="gal">
        <div className="gal-head">
          <div className="h14-text">
            <span className="eyebrow">Крымский геймджем · 2026</span>
            <h1 className="gtitle">CFU<br /><span className="hl">GAME</span> JAM</h1>
            <p className="lead">48 часов, команда и одна идея. Придумай, собери и покажи свою игру на крымском геймджеме КФУ — для программистов, художников, звукорежиссёров и всех, кто любит игры.</p>
            <div className="cta">
              <button className="btn pillcta" id="cta-reg" type="button" onClick={onRegister}><span>{user ? 'Создать команду' : 'Зарегистрироваться'}</span><i className="circ"><Icon n="arrow-right" /></i></button>
              <button className="btn ghost" type="button" onClick={() => show('rules', 'schedule')}><Icon n="calendar-days" />Расписание</button>
            </div>
            <ul className="h14-facts"><li><Icon n="clock" />48 часов на игру</li><li><Icon n="users" />Команда до 6 человек</li><li><Icon n="gamepad-2" />Любой движок</li></ul>
          </div>
          <div className="collage" aria-hidden="true">
            <figure className="f1"><img src="img/c09.jpg" srcSet="img/s/c09.jpg 360w, img/q/c09.jpg 540w, img/c09.jpg 720w" sizes="(max-width:980px) 45vw, 22vw" alt="" draggable="false" decoding="async" /></figure>
            <figure className="f2"><img src="img/c10.jpg" srcSet="img/s/c10.jpg 360w, img/q/c10.jpg 540w, img/c10.jpg 720w" sizes="(max-width:980px) 45vw, 22vw" alt="" draggable="false" decoding="async" /></figure>
            <figure className="f3"><img src="img/c11.jpg" srcSet="img/s/c11.jpg 360w, img/q/c11.jpg 540w, img/c11.jpg 720w" sizes="(max-width:980px) 45vw, 22vw" alt="" draggable="false" decoding="async" /></figure>
            <i className="ico ico-star deco dc1" /><i className="ico ico-sparkles deco dc2" /><i className="ico ico-sparkles deco dc3" /><i className="ico ico-star deco dc4" /><i className="ico ico-sparkles deco dc5" />
          </div>
        </div>
        <div className="stage" aria-hidden="true"><Ring /></div>
      </div>

      <section className="how">
        <h2 className="sec-h">Как это работает</h2>
        <p className="sec-sub">Четыре шага от регистрации до финала. Никаких сложностей — просто приходи с идеей.</p>
        <ol className="stepcards">
          <li><Icon n="user-plus" cls="sc-i" /><b className="n">1</b><h3>Регистрация</h3><p>Создай аккаунт, выбери роль и расскажи о себе.</p></li>
          <li><Icon n="users" cls="sc-i" /><b className="n">2</b><h3>Команда</h3><p>Собери свою или вступи в готовую — до шести человек.</p></li>
          <li><Icon n="gamepad-2" cls="sc-i" /><b className="n">3</b><h3>48 часов</h3><p>Придумай, собери и загрузи игру до конца таймера.</p></li>
          <li><Icon n="trophy" cls="sc-i" /><b className="n">4</b><h3>Финал</h3><p>Покажи проект, получи оценки и награды.</p></li>
        </ol>
      </section>

      <Countdown />

      <div className="facts">
        <div><Icon n="clock" /><b>48</b><small>часов на игру</small></div>
        <div><Icon n="users" /><b>120+</b><small>участников</small></div>
        <div><Icon n="flag" /><b>30</b><small>команд</small></div>
        <div><Icon n="graduation-cap" /><b>12</b><small>менторов</small></div>
      </div>

      <div className="bigs">
        <Big cls="full" go="teams" img="w01" label="Команды" title="Собери команду мечты" btn="Открыть команды" text="Создай свою команду или вступи в чужую: программисты, художники, звук и геймдизайн. От 1 до 6 человек." />
        <Big go="games" img="w02" label="Игры" title="Играй и голосуй" btn="В галерею" text="Работы участников в одном месте." />
        <Big go="people" img="w03" label="Участники" title="Смотри рейтинг" btn="К участникам" text="Лучшие и их профили." />
      </div>

      <div className="card news">
        <h3><Icon n="bell" />Новости джема</h3>
        <div className="stack-v" style={{ gap: 10 }}>
          <div className="alert info"><span className="aic"><Icon n="info" /></span><div><b>Старт 5 декабря.</b> Тема джема откроется в 10:00.</div></div>
          <div className="alert ok"><span className="aic"><Icon n="circle-check" /></span><div><b>Менторы подтверждены.</b> Двенадцать наставников будут на связи.</div></div>
          <div className="alert warn"><span className="aic"><Icon n="triangle-alert" /></span><div><b>Приём заявок</b> закрывается за час до старта.</div></div>
        </div>
      </div>

      <section className="band14">
        <div><h2>Готов собрать команду?</h2><p>Регистрация открыта. Присоединяйся и сделай свою первую игру за выходные.</p></div>
        <button className="btn primary" type="button" onClick={() => show('teams')}>Участвовать <Icon n="arrow-right" /></button>
      </section>
    </>
  );
}
