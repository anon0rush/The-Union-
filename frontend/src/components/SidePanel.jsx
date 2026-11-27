import ActivityPanel from './ActivityPanel.jsx';
import Icon from './Icon.jsx';
import OutlinePanel from './OutlinePanel.jsx';
import VersionsPanel from './VersionsPanel.jsx';

export const PANELS = [
  ['outline', 'Outline'],
  ['history', 'History'],
  ['activity', 'Activity'],
];

export default function SidePanel({ panel, onChange, onClose, editor, documentId, canEdit, notify, focusVersionName }) {
  return (
    <aside className="side-panel" aria-label="Document details">
      <div className="side-panel-head">
        <div className="side-tabs" role="tablist">
          {PANELS.map(([key, label]) => (
            <button
              key={key}
              className="side-tab"
              role="tab"
              aria-selected={panel === key}
              onClick={() => onChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close panel">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="side-panel-body" role="tabpanel">
        {panel === 'outline' && <OutlinePanel editor={editor} />}
        {panel === 'history' && (
          <VersionsPanel documentId={documentId} canEdit={canEdit} notify={notify} focusNameField={focusVersionName} />
        )}
        {panel === 'activity' && <ActivityPanel documentId={documentId} />}
      </div>
    </aside>
  );
}
