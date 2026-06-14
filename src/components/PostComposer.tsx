'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPost } from '@/app/actions/posts';

const MAX_SHORT = 280;
const COLORS = [
  { name: 'Black', value: '#111111' },
  { name: 'Red', value: '#8a1730' },
];

export default function PostComposer() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
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

  // Quote: wrap the selection in “ ”, italic serif, with an attribution line.
  function insertQuote() {
    focusEditor();
    const sel = window.getSelection();
    let quoted = '';
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const holder = document.createElement('div');
      holder.appendChild(sel.getRangeAt(0).cloneContents());
      quoted = holder.innerHTML;
    }
    const html =
      `<blockquote style="font-family: 'Times New Roman', serif; font-style: italic; font-size: 1.15em">` +
      `&ldquo;${quoted || 'quote'}&rdquo;</blockquote>` +
      `<p>&mdash; </p><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    sync();
  }

  function addTag(raw: string) {
    const clean = raw.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    setTags((prev) =>
      prev.includes(clean) || prev.length >= 20 ? prev : [...prev, clean]
    );
  }
  function onTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addTag(tagDraft);
      setTagDraft('');
    } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
      setTags(tags.slice(0, -1));
    }
  }

  function reset() {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setCount(0);
    setTags([]);
    setTagDraft('');
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
    const allTags = [...tags];
    if (tagDraft.trim()) allTags.push(tagDraft.trim().toLowerCase().replace(/^#/, ''));
    const res = await createPost({
      html,
      tags: allTags,
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
  const btn = 'rounded px-2 py-1 text-sm text-stone-600 hover:bg-brand-soft hover:text-brand';
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

        {/* Two text colours: black and the site red */}
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onMouseDown={hold}
            onClick={() => exec('foreColor', c.value)}
            title={`${c.name} text`}
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
          onClick={insertQuote}
          className={btn}
          title="Quote: adds quotation marks, italic, and an attribution line"
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
        value={tagDraft}
        onChange={(e) => setTagDraft(e.target.value)}
        onKeyDown={onTagKey}
        placeholder="Add a tag and press space or enter…"
        className="mt-2 w-full rounded border border-stone-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
      />
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand"
            >
              #{t}
              <button
                type="button"
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="text-brand/60 hover:text-brand"
                title="Remove tag"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

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
