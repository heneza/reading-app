'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPost } from '@/app/actions/posts';

const COLORS = [
  { name: 'Black', value: '#111111' },
  { name: 'Red', value: '#e11d48' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Blue', value: '#2563eb' },
];
const MAX_SHORT = 280;

export default function PostComposer() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);
  const [tagsInput, setTagsInput] = useState('');
  const [isArticle, setIsArticle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  function sync() {
    setCount((editorRef.current?.innerText ?? '').trim().length);
  }
  function focusEditor() {
    editorRef.current?.focus();
  }
  function exec(cmd: string, val?: string) {
    focusEditor();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}
    document.execCommand(cmd, false, val);
    sync();
  }
  function wrap(styles: string) {
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const holder = document.createElement('div');
    holder.appendChild(sel.getRangeAt(0).cloneContents());
    document.execCommand('insertHTML', false, `<span style="${styles}">${holder.innerHTML}</span>`);
    sync();
  }

  function reset() {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setCount(0);
    setTagsInput('');
    setIsArticle(false);
  }

  async function submit() {
    const html = editorRef.current?.innerHTML ?? '';
    const text = (editorRef.current?.innerText ?? '').trim();
    if (!text) {
      setError('Write something first.');
      return;
    }
    if (text.length > MAX_SHORT && !isArticle) {
      setError(
        `That is ${text.length} characters. Mark it as an Article (we will review it) to post something this long, or shorten it.`
      );
      return;
    }
    setError(null);
    setPending(true);
    const tags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').toLowerCase())
      .filter(Boolean);
    const res = await createPost({
      html,
      tags,
      isArticle: text.length > MAX_SHORT ? isArticle : false,
    });
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    reset();
    router.refresh();
  }

  const over = count > MAX_SHORT;
  const btn =
    'rounded px-2 py-1 text-sm text-stone-600 hover:bg-brand-soft hover:text-brand';

  // keep the editor selection when clicking a toolbar button
  const hold = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-stone-100 pb-2">
        <button type="button" onMouseDown={hold} onClick={() => exec('bold')} className={`${btn} font-bold`} title="Bold">B</button>
        <button type="button" onMouseDown={hold} onClick={() => exec('italic')} className={`${btn} italic`} title="Italic">I</button>
        <button type="button" onMouseDown={hold} onClick={() => exec('underline')} className={`${btn} underline`} title="Underline">U</button>
        <button type="button" onMouseDown={hold} onClick={() => wrap('text-decoration: overline')} className={btn} title="Overline" style={{ textDecoration: 'overline' }}>O</button>

        <span className="mx-1 h-4 w-px bg-stone-200" />

        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onMouseDown={hold}
            onClick={() => exec('foreColor', c.value)}
            title={c.name}
            className="h-5 w-5 rounded-full border border-stone-300"
            style={{ backgroundColor: c.value }}
          />
        ))}

        <span className="mx-1 h-4 w-px bg-stone-200" />

        <button type="button" onMouseDown={hold} onClick={() => wrap('font-size: 0.85em')} className={btn} title="Small text">A-</button>
        <button type="button" onMouseDown={hold} onClick={() => wrap('font-size: 1.3em')} className={btn} title="Large text">A+</button>
        <button type="button" onMouseDown={hold} onClick={() => wrap('font-size: 1.6em')} className={btn} title="Extra large">A++</button>
        <button
          type="button"
          onMouseDown={hold}
          onClick={() => wrap("font-family: 'Times New Roman', serif; font-size: 1.25em")}
          className={btn}
          title="Quote style (Times New Roman)"
          style={{ fontFamily: "'Times New Roman', serif" }}
        >
          Quote
        </button>

        <span className="mx-1 h-4 w-px bg-stone-200" />

        <button type="button" onMouseDown={hold} onClick={() => exec('insertUnorderedList')} className={btn} title="Bullet list">• List</button>
        <button type="button" onMouseDown={hold} onClick={() => exec('insertOrderedList')} className={btn} title="Numbered list">1. List</button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={sync}
        data-placeholder="Write something…"
        className="post-body min-h-[80px] w-full rounded p-2 text-stone-800 focus:outline-none"
        suppressContentEditableWarning
      />

      {/* Tags */}
      <input
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="Add tags: books, kafka, poetry…"
        className="mt-2 w-full rounded border border-stone-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
      />

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {over && (
        <label className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={isArticle} onChange={(e) => setIsArticle(e.target.checked)} />
          This is long — post as an <span className="font-medium">Article</span> (held for review before it goes public)
        </label>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${over ? 'text-red-600' : 'text-stone-400'}`}>
          {count}
          {over ? ` / ${MAX_SHORT} · article` : ` / ${MAX_SHORT}`}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
