import { MOD, useCommands } from '../context/CommandContext.jsx';
import Modal from './Modal.jsx';

const GROUPS = [
  [
    'General',
    [
      [[MOD, 'K'], 'Open the command menu'],
      [['?'], 'Show keyboard shortcuts'],
      [['/'], 'Search documents on the dashboard'],
    ],
  ],
  [
    'In a document',
    [
      [[MOD, 'S'], 'Name the current version'],
      [[MOD, 'Shift', 'O'], 'Show the outline'],
      [[MOD, 'Shift', 'H'], 'Show version history'],
      [['Esc'], 'Stop following a collaborator'],
    ],
  ],
  [
    'Formatting',
    [
      [[MOD, 'B'], 'Bold'],
      [[MOD, 'I'], 'Italic'],
      [[MOD, 'U'], 'Underline'],
      [[MOD, 'Z'], 'Undo your last change'],
      [[MOD, 'Shift', 'Z'], 'Redo'],
      [[MOD, 'Alt', '1'], 'Heading 1'],
      [[MOD, 'Shift', '8'], 'Bulleted list'],
    ],
  ],
];

export default function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useCommands();
  if (!shortcutsOpen) return null;

  return (
    <Modal title="Keyboard shortcuts" onClose={() => setShortcutsOpen(false)}>
      {GROUPS.map(([group, rows]) => (
        <section key={group} className="shortcut-group">
          <h3 className="section-label">{group}</h3>
          {rows.map(([keys, label]) => (
            <div key={label} className="shortcut-row">
              <span>{label}</span>
              <span className="shortcut-keys">
                {keys.map((key) => (
                  <kbd key={key} className="kbd">
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </Modal>
  );
}
