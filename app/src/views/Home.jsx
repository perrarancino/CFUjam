import { Icon } from '../components.jsx';
import { bannerImage } from '../data.js';
import { asset } from '../lib.js';
import { useNav } from '../nav.jsx';

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
      <section className="cfu-hero" aria-labelledby="hero-title">
        <div className="cfu-hero-copy">
          <span className="cfu-eyebrow"><span />Студенческий геймджем КФУ · 2026–2027</span>
          <h1 id="hero-title">CFU GAME JAM</h1>
          <p className="cfu-hero-lead">Одна идея. Твоя команда.<br />72 часа, чтобы создать свою игру.</p>
          <p className="cfu-hero-description">Придумай, собери и покажи свою игру на геймджеме КФУ — для студентов любых курсов и направлений.</p>
          <div className="cfu-hero-actions">
            <button className="btn primary" id="cta-reg" type="button" onClick={onRegister}>{user ? 'Создать команду' : 'Участвовать'}<Icon n="arrow-right" /></button>
            <button className="btn secondary" type="button" onClick={() => show('games')}><Icon n="gamepad-2" />Смотреть игры</button>
          </div>
          <ul className="cfu-hero-facts"><li><Icon n="clock" />72 часа</li><li><Icon n="users" />До 5 человек</li><li><Icon n="gamepad-2" />Любой движок</li></ul>
        </div>
      </section>

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
        <Big go="devlogs" img="w04" label="Дневники" title="Дневники разработки" btn="Читать ленту" text="Следи за прогрессом команд: концепты, шейдеры, первый звук и билды." />
        <Big go="people" img="w03" label="Биржа" title="Поиск тимейтов (LFG)" btn="Найти команду" text="Опубликуй анкету или позови недостающего специалиста в состав." />
        <Big go="games" img="w02" label="Игры" title="Играй и голосуй" btn="В галерею" text="Работы участников в одном месте." />
      </div>

      <div className="card news">
        <h3><Icon n="bell" />Новости джема</h3>
        <div className="stack-v" style={{ gap: 10 }}>
          <div className="alert info"><span className="aic"><Icon n="book-open" /></span><div><b>Лента дневников активна.</b> Публикуйте прогресс вашей команды, прикрепляйте скриншоты и получайте очки опыта (XP).</div></div>
          <div className="alert ok"><span className="aic"><Icon n="users" /></span><div><b>Биржа тимейтов открыта.</b> Капитаны могут публиковать вакансии, а соло-участники — находить команду по специализации.</div></div>
          <div className="alert warn"><span className="aic"><Icon n="triangle-alert" /></span><div><b>Смешанный формат.</b> Разработка онлайн или в аудитории, финал — очно в КФУ.</div></div>
        </div>
      </div>

      <section className="band14">
        <div><h2>Готов собрать команду?</h2><p>Присоединяйся и создай прототип игры за 72 часа.</p></div>
        <button className="btn secondary" type="button" onClick={() => show('teams')}>Участвовать <Icon n="arrow-right" /></button>
      </section>
    </>
  );
}
