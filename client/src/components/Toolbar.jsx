import { useEditorState } from '@tiptap/react';

function Button({ onClick, active, disabled, label, children }) {
  return (
    <button
      type="button"
      className={`tool${active ? ' active' : ''}`}
      onMouseDown={(e) => e.preventDefault() /* keep the editor selection */}
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

const Divider = () => <span className="tool-divider" aria-hidden />;

export default function Toolbar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 }) ? 'h1'
        : e.isActive('heading', { level: 2 }) ? 'h2'
        : e.isActive('heading', { level: 3 }) ? 'h3'
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
    const url = window.prompt('Link URL (leave empty to remove)', previous);
    if (url === null) return;
    if (url.trim() === '') return chain().extendMarkRange('link').unsetLink().run();
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    chain().extendMarkRange('link').setLink({ href }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Button label="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!s.canUndo}>↶</Button>
      <Button label="Redo (Ctrl+Shift+Z)" onClick={() => chain().redo().run()} disabled={!s.canRedo}>↷</Button>
      <Divider />
      <select className="tool-select" value={s.block} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <Button label="Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}><b>B</b></Button>
      <Button label="Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}><i>I</i></Button>
      <Button label="Underline (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}><u>U</u></Button>
      <Button label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}><s>S</s></Button>
      <Button label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()}><mark>H</mark></Button>
      <Button label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()}>{'</>'}</Button>
      <Button label="Link" active={s.link} onClick={setLink}>🔗</Button>
      <Divider />
      <Button label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>•≡</Button>
      <Button label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>1≡</Button>
      <Button label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}>☑</Button>
      <Button label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>❝</Button>
      <Button label="Code block" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>{'{ }'}</Button>
      <Button label="Divider" onClick={() => chain().setHorizontalRule().run()}>―</Button>
      <Divider />
      <Button label="Align left" active={s.left} onClick={() => chain().setTextAlign('left').run()}>⇤</Button>
      <Button label="Align center" active={s.center} onClick={() => chain().setTextAlign('center').run()}>↔</Button>
      <Button label="Align right" active={s.right} onClick={() => chain().setTextAlign('right').run()}>⇥</Button>
    </div>
  );
}
