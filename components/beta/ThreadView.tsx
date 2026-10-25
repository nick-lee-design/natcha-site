'use client';

import { useState } from 'react';
import type { Thread, View } from '@/lib/beta/building';
import { shortDate } from './format';
import { useThreads } from './store';

// A review between the building manager and engineering, with the viewpoints and proposals in it
export default function ThreadView({ thread, onView, onProposal, activeProposal, capture }: {
  thread: Thread;
  onView?: (v: View, marks?: string[]) => void;
  onProposal?: (id: string | null) => void;
  activeProposal?: string | null;
  capture?: () => View;
}) {
  const { reply, agree } = useThreads();
  const [draft, setDraft] = useState('');

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    reply(thread.id, { who: 'manager', name: 'Facilities manager', text: draft.trim(), view: capture?.() });
    setDraft('');
  }

  return (
    <div className="thread">
      <ol className="posts">
        {thread.posts.map((p, k) => (
          <li key={k} className={`post is-${p.who}`}>
            <div className="post-head"><strong>{p.name}</strong><span className="mono">{shortDate(p.date)}</span></div>
            <p>{p.text}</p>
            {(p.view || !!p.marks?.length) && onView && (
              <button className="linkish" onClick={() => onView(p.view!, p.marks)}>
                {p.view ? 'Open the shared view' : `Show ${p.marks!.join(', ')}`}
              </button>
            )}
            {p.proposals && (
              <ul className="proposals">
                {p.proposals.map((o) => (
                  <li key={o.id} className={activeProposal === o.id ? 'is-on' : ''}>
                    <button className="prop-head" onClick={() => onProposal?.(activeProposal === o.id ? null : o.id)}>
                      <span>{o.title}</span><span className="muted">{activeProposal === o.id ? 'Shown' : 'Show'}</span>
                    </button>
                    <p>{o.text}</p>
                    {o.risk && <p className="risk">{o.risk}</p>}
                    {thread.status !== 'Agreed' && <button className="btn-s" onClick={() => agree(thread.id, o.id)}>Agree this</button>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {thread.status !== 'Agreed' && (
        <form className="reply" onSubmit={send}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply" aria-label="Reply" />
          <button className="btn-s" disabled={!draft.trim()}>Send{capture ? ' with view' : ''}</button>
        </form>
      )}
    </div>
  );
}
