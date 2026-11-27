import { useEditorState } from '@tiptap/react';
import { MOD } from '../context/CommandContext.jsx';
import Icon from './Icon.jsx';

function Tool({ onClick, active, disabled, label, children }) {
  return (
    <button
      type="button"
      className={`tool${active ? ' active' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

const Separator = () => <span className="tool-sep" aria-hidden="true" />;

export default function Toolbar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  function setBlock(value) {
    if (value === 'p') chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(value[1]) }).run();
  }

  function setLink() {
    const previous = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Link address (leave empty to remove the link)', previous);
    if (url === null) return;
    if (url.trim() === '') return chain().extendMarkRange('link').unsetLink().run();
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    chain().extendMarkRange('link').setLink({ href }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Tool label={`Undo (${MOD} Z)`} onClick={() => chain().undo().run()} disabled={!s.canUndo}>
        <Icon name="undo" />
      </Tool>
      <Tool label={`Redo (${MOD} Shift Z)`} onClick={() => chain().redo().run()} disabled={!s.canRedo}>
        <Icon name="redo" />
      </Tool>
      <Separator />
      <select className="tool-select" value={s.block} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Body text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Separator />
      <Tool label={`Bold (${MOD} B)`} active={s.bold} onClick={() => chain().toggleBold().run()}>
        <span className="tool-text">B</span>
      </Tool>
      <Tool label={`Italic (${MOD} I)`} active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="tool-text" style={{ fontStyle: 'italic', fontWeight: 400 }}>
          I
        </span>
      </Tool>
      <Tool label={`Underline (${MOD} U)`} active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="tool-text" style={{ textDecoration: 'underline', fontWeight: 400 }}>
          U
        </span>
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <span className="tool-text" style={{ textDecoration: 'line-through', fontWeight: 400 }}>
          S
        </span>
      </Tool>
      <Tool label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()}>
        <Icon name="highlight" />
      </Tool>
      <Tool label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()}>
        <Icon name="inlineCode" />
      </Tool>
      <Tool label="Link" active={s.link} onClick={setLink}>
        <Icon name="link" />
      </Tool>
      <Separator />
      <Tool label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <Icon name="listBullet" />
      </Tool>
      <Tool label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <Icon name="listOrdered" />
      </Tool>
      <Tool label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}>
        <Icon name="checklist" />
      </Tool>
      <Tool label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Icon name="quote" />
      </Tool>
      <Tool label="Code block" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <Icon name="codeBlock" />
      </Tool>
      <Tool label="Horizontal line" onClick={() => chain().setHorizontalRule().run()}>
        <Icon name="divider" />
      </Tool>
      <Separator />
      <Tool label="Align left" active={s.left} onClick={() => chain().setTextAlign('left').run()}>
        <Icon name="alignLeft" />
      </Tool>
      <Tool label="Align center" active={s.center} onClick={() => chain().setTextAlign('center').run()}>
        <Icon name="alignCenter" />
      </Tool>
      <Tool label="Align right" active={s.right} onClick={() => chain().setTextAlign('right').run()}>
        <Icon name="alignRight" />
      </Tool>
    </div>
  );
}
