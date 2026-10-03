import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';

/**
 * The schema shared by the live editor and the read-only version preview.
 * With collaboration on, Yjs owns undo/redo (per-user, so you never undo someone else's typing).
 */
export function baseExtensions({ collaborative = false, placeholder } = {}) {
  return [
    StarterKit.configure({
      ...(collaborative && { undoRedo: false }),
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
