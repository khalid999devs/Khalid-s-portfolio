import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatQuote,
  MdCode,
  MdLink,
  MdLinkOff,
  MdHorizontalRule,
  MdUndo,
  MdRedo,
} from 'react-icons/md';

// The editing surface is styled with the same values the server inlines in
// server/utils/emailHtml.js, so the message is laid out identically here and in
// the inbox. Change one, change both.

const CONTENT_CSS = `
.rte .tiptap { outline: none; }
.rte .tiptap > * + * { margin-top: 0; }
.rte .tiptap p { margin: 0 0 18px; font-size: 16px; line-height: 1.65; }
.rte .tiptap h1 { margin: 28px 0 14px; font-size: 30px; line-height: 1.25; font-weight: 700; }
.rte .tiptap h2 { margin: 26px 0 12px; font-size: 24px; line-height: 1.3; font-weight: 700; }
.rte .tiptap h3 { margin: 22px 0 10px; font-size: 19px; line-height: 1.4; font-weight: 700; }
.rte .tiptap ul, .rte .tiptap ol { margin: 0 0 18px; padding-left: 22px; font-size: 16px; line-height: 1.65; }
.rte .tiptap ul { list-style: disc; }
.rte .tiptap ol { list-style: decimal; }
.rte .tiptap li { margin: 0 0 6px; }
/* TipTap wraps item content in a paragraph; the server unwraps it, so the
   paragraph margin must not apply here either. */
.rte .tiptap li > p { margin: 0; }
.rte .tiptap blockquote { margin: 0 0 18px; padding: 2px 0 2px 16px; border-left: 3px solid #6B6B6C; font-style: italic; opacity: 0.85; }
.rte .tiptap pre { margin: 0 0 18px; padding: 14px 16px; background: rgba(0,0,0,0.35); border: 1px solid rgba(107,107,108,0.5); border-radius: 6px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
.rte .tiptap code { font-size: 14px; background: rgba(0,0,0,0.35); padding: 2px 5px; border-radius: 4px; }
.rte .tiptap pre code { background: none; padding: 0; }
.rte .tiptap a { text-decoration: underline; }
.rte .tiptap hr { border: 0; border-top: 1px solid rgba(107,107,108,0.5); margin: 24px 0; }
.rte .tiptap p:last-child, .rte .tiptap ul:last-child, .rte .tiptap ol:last-child { margin-bottom: 0; }
.rte .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left; height: 0; pointer-events: none; color: #6B6B6C;
}
`;

const button =
  'p-1.5 rounded text-secondary-light transition-all duration-300 hover:text-primary-main hover:bg-body-main/60 disabled:opacity-30';
const active = 'bg-onPrimary-main/20 text-primary-main';

const Divider = () => <span className='w-px h-5 bg-secondary-main/40 mx-1' />;

/** Outside the component: inside, every keystroke remounts the whole toolbar. */
const Tool = ({ onClick, on, title, children, disabled }) => (
  <button
    type='button'
    // Keeps the selection while the button is pressed.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`${button} ${on ? active : ''}`}
  >
    {children}
  </button>
);

Tool.propTypes = {
  onClick: PropTypes.func,
  on: PropTypes.bool,
  title: PropTypes.string,
  children: PropTypes.node,
  disabled: PropTypes.bool,
};

const RichTextEditor = ({ value, onChange, placeholder = 'Message', minHeight = 240 }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          // Matches the server allowlist; anything else is not made a link.
          protocols: ['http', 'https', 'mailto', 'tel'],
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      // TipTap represents empty as an empty paragraph; report it as empty so
      // `required` and the send guards behave.
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // The parent clears the form after a send; without this the editor keeps the
  // sent message on screen. `isEmpty` is read from state rather than by
  // serialising, so this does no work on every keystroke.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if ((value || '') === '' && !editor.isEmpty) editor.commands.clearContent();
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', previous);
    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className='rte w-full bg-body-main/40 border border-secondary-main/50 rounded-md focus-within:border-onPrimary-main transition-all duration-300'>
      <style>{CONTENT_CSS}</style>

      <div className='flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-secondary-main/40'>
        <Tool
          onClick={() => editor.chain().focus().toggleBold().run()}
          on={editor.isActive('bold')}
          title='Bold'
        >
          <MdFormatBold />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().toggleItalic().run()}
          on={editor.isActive('italic')}
          title='Italic'
        >
          <MdFormatItalic />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          on={editor.isActive('underline')}
          title='Underline'
        >
          <MdFormatUnderlined />
        </Tool>

        <Divider />

        {[1, 2, 3].map((level) => (
          <Tool
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            on={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            <span className='text-xs text-montreal-mono px-0.5'>H{level}</span>
          </Tool>
        ))}

        <Divider />

        <Tool
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          on={editor.isActive('bulletList')}
          title='Bulleted list'
        >
          <MdFormatListBulleted />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          on={editor.isActive('orderedList')}
          title='Numbered list'
        >
          <MdFormatListNumbered />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          on={editor.isActive('blockquote')}
          title='Quote'
        >
          <MdFormatQuote />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          on={editor.isActive('codeBlock')}
          title='Code block'
        >
          <MdCode />
        </Tool>

        <Divider />

        <Tool onClick={setLink} on={editor.isActive('link')} title='Add or edit a link'>
          <MdLink />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title='Remove link'
        >
          <MdLinkOff />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title='Divider'
        >
          <MdHorizontalRule />
        </Tool>

        <Divider />

        <Tool
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title='Undo'
        >
          <MdUndo />
        </Tool>
        <Tool
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title='Redo'
        >
          <MdRedo />
        </Tool>
      </div>

      <div
        className='px-3 py-3 overflow-y-auto cursor-text'
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
        role='presentation'
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  minHeight: PropTypes.number,
};

export default RichTextEditor;
