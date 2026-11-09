import { findProfile } from './profiles.js';

const contactKey = (who) => findProfile(who)?.nick || who;

export const DEMO_MESSAGES = [
  ['Данил М', 'Привет! Нужен программист на Godot?'],
  ['Софья В', 'Присоединяйся к «Тихому берегу»!'],
  ['Кирилл Н', 'Ментор на связи, пиши в любое время.']
];

export function conversations(state) {
  const saved = state.messageThreads?.[state.user] || {};
  if (!state.demo) return saved;
  const result = Object.fromEntries(DEMO_MESSAGES.map(([who, text]) => [contactKey(who), [{ id: 'demo-' + who, text, incoming: true }]]));
  for (const [who, messages] of Object.entries(saved)) result[who] = [...(result[who] || []), ...messages];
  return result;
}

export function saveMessage(draft, who, text) {
  who = contactKey(who);
  draft.messageThreads ||= {};
  const threads = draft.messageThreads[draft.user] ||= {};
  const thread = threads[who] ||= [];
  thread.push({ id: crypto.randomUUID(), text, incoming: false, at: Date.now() });
}
