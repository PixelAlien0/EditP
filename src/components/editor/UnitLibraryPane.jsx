export default function UnitLibraryPane({ collapsed, total, filteredCount, onToggle, children }) {
  if (collapsed) {
    return (
      <aside id="unit-library-pane" className="sidebar unit-library-pane is-collapsed" aria-label="Unit library">
        <button
          type="button"
          className="workspace-pane-rail-trigger"
          onClick={() => onToggle(false)}
          aria-label="Open unit library"
          aria-expanded="false"
          aria-controls="unit-library-pane"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="3" width="5" height="5" rx="1" />
            <rect x="12" y="3" width="5" height="5" rx="1" />
            <rect x="3" y="12" width="5" height="5" rx="1" />
            <rect x="12" y="12" width="5" height="5" rx="1" />
          </svg>
          <span className="workspace-pane-rail-count">{filteredCount ?? total}</span>
          <span className="workspace-pane-rail-label">Units</span>
        </button>
      </aside>
    );
  }

  return (
    <aside id="unit-library-pane" className="sidebar unit-library-pane" aria-label="Unit library">
      <div className="sidebar-heading">
        <div>
          <span className="sidebar-eyebrow">Unit library</span>
          <h2>Browse forces</h2>
        </div>
        <div className="unit-library-pane__heading-actions">
          <span className="sidebar-total">{total.toLocaleString()}</span>
          <button
            type="button"
            className="workspace-pane-collapse-action"
            onClick={() => onToggle(true)}
            aria-label="Collapse unit library"
            aria-expanded="true"
            aria-controls="unit-library-pane"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3.5-4.5 4.5 4.5 4.5" /></svg>
          </button>
        </div>
      </div>
      {children}
    </aside>
  );
}
