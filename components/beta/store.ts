'use client';

import { create } from 'zustand';
import { THREADS, TODAY, type Post, type Thread } from '@/lib/beta/building';

// Review threads are shared by all three approaches, so a review raised in one shows in the others
type Store = {
  threads: Thread[];
  raise(t: Omit<Thread, 'id' | 'status'>): string;
  reply(id: string, post: Omit<Post, 'date'>): void;
  agree(id: string, proposal: string): void;
};

let n = 0;

export const useThreads = create<Store>((set) => ({
  threads: THREADS,
  raise(t) {
    const id = `t-new-${++n}`;
    set((s) => ({ threads: [{ ...t, id, status: 'Open' }, ...s.threads] }));
    // A stand-in engineer acknowledges, so the round trip can be tried
    setTimeout(() => useThreads.getState().reply(id, {
      who: 'engineer', name: 'TALO Engine',
      text: 'Got it, with the view and parts you marked. We’ll come back with options and the risks of each.',
    }), 1800);
    return id;
  },
  reply(id, post) {
    set((s) => ({ threads: s.threads.map((t) => (t.id === id ? { ...t, posts: [...t.posts, { ...post, date: TODAY }] } : t)) }));
  },
  agree(id, proposal) {
    set((s) => ({ threads: s.threads.map((t) => (t.id === id ? {
      ...t, status: 'Agreed',
      posts: [...t.posts, { who: 'manager', name: 'Facilities manager', date: TODAY, text: `Agreed: ${t.posts.flatMap((p) => p.proposals ?? []).find((p) => p.id === proposal)?.title}.` }],
    } : t)) }));
  },
}));
