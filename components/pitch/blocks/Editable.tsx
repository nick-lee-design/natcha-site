'use client';

import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useEdit } from '../canvas/EditContext';
import { RichText } from './RichText';

// Titles, labels and captions: plain text. Shows the finished text until focused,
// then the raw text with its {{variables}} so they can be edited.
export function PlainEditable({
  content,
  resolved,
  onCommit,
}: {
  content: string;
  resolved: string | null;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const focused = useRef(false);

  useLayoutEffect(() => {
    if (ref.current && !focused.current) ref.current.textContent = resolved ?? content;
  }, [resolved, content]);

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label="Edit text"
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      className={`edit-text${resolved === null ? ' is-placeholder' : ''}`}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.textContent = content;
        const range = document.createRange();
        range.selectNodeContents(e.currentTarget);
        range.collapse(false);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
      }}
      onBlur={(e) => {
        focused.current = false;
        const value = (e.currentTarget.textContent ?? '').replace(/\s+/g, ' ').trim();
        e.currentTarget.textContent = resolved ?? content;
        if (value !== content) onCommit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.currentTarget.textContent = content;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// Tiptap output → the block's inline HTML (paragraph breaks become line breaks)
const toInline = (html: string) =>
  html
    .replace(/<\/p>\s*<p>/g, '<br>')
    .replace(/^<p>|<\/p>$/g, '')
    .replace(/<br\s*\/?>$/, '');

// Paragraphs: bold, italic and links only
export function RichEditable({ id, content, onCommit }: { id: string; content: string; onCommit: (html: string) => void }) {
  const edit = useEdit();
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
    ],
    content: `<p>${content}</p>`,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'edit-rich', 'aria-label': 'Edit paragraph' } },
    onBlur: ({ editor }) => {
      const html = toInline(editor.getHTML());
      if (html !== content) onCommit(html);
    },
  });

  // Undo and inspector changes flow back in while the paragraph isn't being edited
  useEffect(() => {
    if (editor && !editor.isFocused && toInline(editor.getHTML()) !== content) {
      editor.commands.setContent(`<p>${content}</p>`, { emitUpdate: false });
    }
  }, [editor, content]);

  useEffect(() => {
    edit?.registerEditor(id, editor);
    return () => edit?.registerEditor(id, null);
  }, [edit, editor, id]);

  return editor ? <EditorContent editor={editor} /> : <RichText html={content} />;
}
