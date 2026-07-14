const TAB_ICONS = {
  details: <path d="M8 2.75a5.25 5.25 0 1 0 0 10.5A5.25 5.25 0 0 0 8 2.75Zm0 3v.1M8 7.5v3" />,
  compare: <path d="M2.75 4.5h8.5M8.5 2l2.75 2.5L8.5 7M13.25 11.5h-8.5M7.5 9l-2.75 2.5L7.5 14" />,
  changes: <path d="M4 2.75h6.25L13 5.5v7.75H4zM10 2.75V5.5h3M6 8h5M6 10.5h5" />,
  identity: <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.25 5c.5-2.2 2-3.3 4.25-3.3s3.75 1.1 4.25 3.3" />,
};

export default function EditorInspector({
  collapsed, onCollapsedChange, activeTab, onTabChange, tabs, panels,
  density, onDensityChange, projectChangeCount = 0,
}) {
  if (collapsed) {
    return (
      <aside id="editor-inspector-pane" className="code-pane editor-inspector is-collapsed" aria-label="Editor inspector">
        <div className="editor-inspector-rail" role="toolbar" aria-label="Open inspector panel">
          {tabs.map(tab => (
            <button
              type="button"
              key={tab.id}
              className={activeTab === tab.id ? 'is-active' : ''}
              onClick={() => {
                onTabChange(tab.id);
                onCollapsedChange(false);
              }}
              aria-label={`Open ${tab.label}`}
              aria-expanded="false"
              aria-controls="editor-inspector-pane"
              title={tab.label}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">{TAB_ICONS[tab.id]}</svg>
              {tab.id === 'changes' && projectChangeCount > 0 && <span>{projectChangeCount}</span>}
            </button>
          ))}
        </div>
        <span className="workspace-pane-rail-label">Inspector</span>
      </aside>
    );
  }

  const activeDefinition = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const resolvedActiveTab = activeDefinition?.id;

  return (
    <aside id="editor-inspector-pane" className="code-pane editor-inspector" aria-label="Editor inspector">
      <header className="editor-inspector-header">
        <div>
          <span>Context desk</span>
          <h2>{activeDefinition?.label || 'Inspector'}</h2>
        </div>
        <button
          type="button"
          className="workspace-pane-collapse-action"
          onClick={() => onCollapsedChange(true)}
          aria-label="Collapse editor inspector"
          aria-expanded="true"
          aria-controls="editor-inspector-pane"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
        </button>
      </header>

      <div className="editor-inspector-tabs" role="tablist" aria-label="Inspector views">
        {tabs.map(tab => (
          <button
            type="button"
            role="tab"
            id={`editor-inspector-tab-${tab.id}`}
            aria-controls={`editor-inspector-panel-${tab.id}`}
            aria-selected={resolvedActiveTab === tab.id}
            className={resolvedActiveTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={event => {
              const tabButtons = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
              const currentIndex = tabButtons.indexOf(event.currentTarget);
              let nextIndex = currentIndex;
              if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabButtons.length;
              else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
              else if (event.key === 'Home') nextIndex = 0;
              else if (event.key === 'End') nextIndex = tabButtons.length - 1;
              else return;
              event.preventDefault();
              tabButtons[nextIndex].focus();
              tabButtons[nextIndex].click();
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">{TAB_ICONS[tab.id]}</svg>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && <small>{tab.count}</small>}
          </button>
        ))}
      </div>

      <div
        className="editor-inspector-content"
        role="tabpanel"
        id={`editor-inspector-panel-${resolvedActiveTab}`}
        aria-labelledby={`editor-inspector-tab-${resolvedActiveTab}`}
        tabIndex={0}
      >
        {panels[resolvedActiveTab]}
      </div>

      <footer className="editor-inspector-density" aria-label="Workspace density">
        <span>Density</span>
        <div role="group" aria-label="Parameter density">
          {['compact', 'balanced', 'comfortable'].map(option => (
            <button
              type="button"
              key={option}
              className={density === option ? 'is-active' : ''}
              aria-pressed={density === option}
              aria-label={`${option} workspace density`}
              title={`${option[0].toUpperCase()}${option.slice(1)} density`}
              onClick={() => onDensityChange(option)}
            >
              {option.slice(0, 1).toUpperCase()}
            </button>
          ))}
        </div>
      </footer>
    </aside>
  );
}
