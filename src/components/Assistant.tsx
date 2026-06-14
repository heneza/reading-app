'use client';

import { useState, useRef, useEffect } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const GREETING: Msg = {
  role: 'assistant',
  content: 'Hi! I can explain how Reading App works, or suggest your next book. What are you in the mood for?',
};

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const next = [...messages, { role: 'user' as const, content: text.slice(0, 2000) }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Send only the conversation; the server adds taste context itself.
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong.');
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: String(data.reply ?? '') }]);
      }
    } catch {
      setError('Could not reach the assistant.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5">
            <span className="text-sm font-semibold text-stone-700">Reading assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full px-2 text-stone-400 hover:text-brand">×</button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-brand text-white' : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}
            {loading && <p className="text-left text-sm text-stone-400">Thinking…</p>}
            {error && <p className="text-left text-sm text-red-600">{error}</p>}
          </div>

          <div className="border-t border-stone-200 p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Ask about a feature or a book…"
                className="max-h-24 flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            </form>
            <p className="mt-1 px-1 text-[10px] text-stone-400">Shares your genres + recent reads to suggest books. Don’t enter sensitive info.</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open reading assistant"
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-brand px-4 font-medium text-white shadow-card transition hover:bg-brand-dark"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        <span className="hidden sm:inline">Ask</span>
      </button>
    </>
  );
}
