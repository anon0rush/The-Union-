import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';

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
