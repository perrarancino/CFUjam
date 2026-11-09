import { useEffect, useState } from 'react';
import { Avatar, Banner, Icon } from '../components.jsx';
import { profileOf } from '../profiles.js';
import { conversations, saveMessage } from '../messages.js';
import { useApp } from '../store.jsx';

export default function Messages() {
  const { S, update, needAuth } = useApp();
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  useEffect(() => { setSelected(''); setText(''); }, [S.user]);
  const threads = conversations(S);
  const people = Object.keys(threads);
  const who = people.includes(selected) ? selected : people[0];
  const send = (e) => { e.preventDefault(); if (!text.trim() || !who || !S.user) return; update((d) => saveMessage(d, who, text.trim())); setText(''); };
  return <>
    <Banner title="Сообщения" text="Переписки с участниками и командой в одном месте." />
    {!S.user ? <div className="card pull empty"><p>Войдите, чтобы открыть переписки.</p><button className="btn primary" onClick={() => needAuth('Войдите, чтобы читать сообщения')}>Войти</button></div> : <>
      <p className="local-mode-note pull">Переписки сохраняются в этом браузере. Доставка сообщений другим участникам пока не подключена.{S.demo ? ' Показаны демонстрационные диалоги.' : ''}</p>
      {!people.length ? <div className="card empty"><h3>Пока нет переписок</h3><p>Откройте профиль участника и нажмите «Написать сообщение».</p></div> : <div className="messages-layout">
        <aside className="card conversation-list" aria-label="Переписки">{people.map((name) => { const p = profileOf(name, S); return <button className={'conversation-item' + (who === name ? ' selected' : '')} aria-pressed={who === name} key={name} onClick={() => { setSelected(name); setText(''); }}><Avatar name={name} cls="sm" interactive={false} /><div><b>{p.full}</b><small>{threads[name].at(-1)?.text}</small></div></button>; })}</aside>
        <section className="card conversation"><header className="conversation-heading"><Avatar name={who} cls="sm" /><h2>{profileOf(who, S).full}</h2></header>
          <div className="message-history" role="log" aria-label="История переписки">{(threads[who] || []).map((message) => <div key={message.id} className={'message-bubble' + (message.incoming ? ' incoming' : ' outgoing')}><small>{message.incoming ? profileOf(who, S).full : 'Вы'}</small><p>{message.text}</p></div>)}</div>
          <form className="message-compose" onSubmit={send}><label htmlFor="reply-text">Сообщение</label><textarea id="reply-text" rows={3} maxLength={300} placeholder="Напишите сообщение…" value={text} onChange={(e) => setText(e.target.value)} /><button className="btn primary sm" disabled={!text.trim()}><Icon n="send" />Сохранить сообщение</button></form>
        </section>
      </div>}
    </>}
  </>;
}
