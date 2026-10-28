import { memo } from 'react';
import { Icon } from '../components.jsx';
import { BASE_GAMES, bannerImage } from '../data.js';
import { asset } from '../lib.js';
import { useNav } from '../nav.jsx';

/* 3D-карусель: 40 слайдов. Разметка статичная — её двигает legacy-скрипт карусели, поэтому React к ней не прикасается */
const SLIDES = Array.from({ length: 40 }, (_, i) => {
  const game = BASE_GAMES[i % BASE_GAMES.length];
  const lazy = i >= 14 && i < 30 ? 'loading="lazy"' : '';
  return `<figure class="slide" style="--i:${i}"><div class="in"><img src="img/generated/${game.cover}.png" alt="" draggable="false" ${lazy}><span class="gen">${game.tags[1]}</span><figcaption>${game.title}</figcaption></div></figure>`;
}).join('');

const Ring = memo(function Ring() {
  return <div className="ring" dangerouslySetInnerHTML={{ __html: SLIDES }} />;
});

function Countdown() {
  return (
    <div className="count" id="count">
      <div><b>2026–2027</b><small>ориентировочные сроки</small></div>
      <div><b>Ноябрь – февраль</b><small>точная дата уточняется</small></div>
    </div>
  );
}

const Big = ({ cls = '', go, img, label, title, btn, text }) => {
  const { show } = useNav();
  return (
    <article className={'big ' + cls} onClick={() => show(go)}>
      <div className="shot" style={{ '--img': `url(${asset(bannerImage(img))})`, '--imgm': `url(${asset(bannerImage(img))})` }}><span className="shot-label">{label}</span></div>
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
            <span className="eyebrow">Студенческий геймджем КФУ · 2026–2027</span>
            <h1 className="gtitle">CFU<br /><span className="hl">GAME</span> JAM</h1>
            <p className="lead">72 часа, одна идея и возможность работать в команде. Придумай, собери и покажи свою игру на геймджеме КФУ — для студентов любых курсов и направлений.</p>
            <div className="cta">
              <button className="btn pillcta" id="cta-reg" type="button" onClick={onRegister}><span>{user ? 'Создать команду' : 'Зарегистрироваться'}</span><i className="circ"><Icon n="arrow-right" /></i></button>
            </div>
            <ul className="h14-facts"><li><Icon n="clock" />72 часа на игру</li><li><Icon n="users" />Команда до 5 человек</li><li><Icon n="gamepad-2" />Любой движок</li></ul>
          </div>
          <div className="collage" aria-hidden="true">
            <figure className="f1"><img src="img/generated/students-work.png" alt="" draggable="false" decoding="async" /></figure>
            <figure className="f2"><img src="img/generated/students-rest.png" alt="" draggable="false" decoding="async" /></figure>
            <figure className="f3"><img src="img/generated/students-play.png" alt="" draggable="false" decoding="async" /></figure>
          </div>
        </div>
        <div className="stage" aria-hidden="true"><Ring /></div>
      </div>

      <section className="how">
        <h2 className="sec-h">Как это работает</h2>
        <p className="sec-sub">Четыре шага от регистрации до финала. Никаких сложностей — просто приходи с идеей.</p>
        <ol className="stepcards">
          <li><Icon n="user-plus" cls="sc-i" /><b className="n">1</b><h3>Регистрация</h3><p>Создай аккаунт, выбери роль и расскажи о себе.</p></li>
          <li><Icon n="users" cls="sc-i" /><b className="n">2</b><h3>Команда</h3><p>Участвуй самостоятельно или в команде до пяти человек.</p></li>
          <li><Icon n="gamepad-2" cls="sc-i" /><b className="n">3</b><h3>72 часа</h3><p>Разработай и загрузи прототип онлайн или в аудитории.</p></li>
          <li><Icon n="trophy" cls="sc-i" /><b className="n">4</b><h3>Финал</h3><p>Презентация победивших проектов и награждение пройдут очно в КФУ.</p></li>
        </ol>
      </section>

      <Countdown />

      <div className="facts">
        <div><Icon n="clock" /><b>72</b><small>часа на игру</small></div>
        <div><Icon n="users" /><b>до 5</b><small>человек в команде</small></div>
        <div><Icon n="flag" /><b>20–50</b><small>прототипов ожидается</small></div>
        <div><Icon n="graduation-cap" /><b>КФУ</b><small>студенты всех направлений</small></div>
      </div>

      <div className="bigs">
        <Big cls="full" go="teams" img="w01" label="Команды" title="Собери команду мечты" btn="Открыть команды" text="Участвуй самостоятельно или собери команду до 5 человек: программисты, художники, звук и геймдизайн." />
        <Big go="games" img="w02" label="Игры" title="Играй и голосуй" btn="В галерею" text="Работы участников в одном месте." />
        <Big go="people" img="w03" label="Участники" title="Смотри рейтинг" btn="К участникам" text="Лучшие и их профили." />
      </div>

      <div className="card news">
        <h3><Icon n="bell" />Новости джема</h3>
        <div className="stack-v" style={{ gap: 10 }}>
          <div className="alert info"><span className="aic"><Icon n="info" /></span><div><b>Сроки уточняются.</b> Джем планируется на период с ноября 2026 по февраль 2027 года.</div></div>
          <div className="alert ok"><span className="aic"><Icon n="circle-check" /></span><div><b>Тема секретная.</b> Её объявят на старте джема.</div></div>
          <div className="alert warn"><span className="aic"><Icon n="triangle-alert" /></span><div><b>Смешанный формат.</b> Разработка онлайн или в аудитории, финал — очно в КФУ.</div></div>
        </div>
      </div>

      <section className="band14">
        <div><h2>Готов собрать команду?</h2><p>Присоединяйся и создай прототип игры за 72 часа.</p></div>
        <button className="btn primary" type="button" onClick={() => show('teams')}>Участвовать <Icon n="arrow-right" /></button>
      </section>
    </>
  );
}
