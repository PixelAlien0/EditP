export function ParameterMatrix({ sectionId, parameters, collapsedGroups, onToggleGroup, renderParameter }) {
  const featured = parameters.filter(parameter => parameter.featured);
  const groups = parameters.filter(parameter => !parameter.featured).reduce((result, parameter) => {
    const id = parameter.group || 'Additional';
    const existing = result.find(group => group.id === id);
    if (existing) existing.parameters.push(parameter);
    else result.push({ id, parameters: [parameter] });
    return result;
  }, []);

  return (
    <div className="parameter-matrix">
      {featured.length > 0 && (
        <section className="parameter-featured-group" aria-label="Featured parameters">
          <div className="parameter-featured-grid">{featured.map(renderParameter)}</div>
        </section>
      )}
      <div className="parameter-compact-groups">
        {groups.map(group => {
          const storageId = `${sectionId}:${group.id}`;
          const collapsed = Boolean(collapsedGroups[storageId]);
          return (
            <section className={`parameter-compact-group ${collapsed ? 'is-collapsed' : ''}`} key={group.id}>
              <button
                type="button"
                className="parameter-group-heading"
                onClick={() => onToggleGroup(storageId)}
                aria-expanded={!collapsed}
              >
                <span>{group.id}</span>
                <small>{group.parameters.length} fields</small>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </button>
              {!collapsed && <div className="parameter-compact-grid">{group.parameters.map(renderParameter)}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ParameterCanvas({ comparisonMode, children }) {
  return <div className={`editor-scroll-area parameter-canvas ${comparisonMode ? 'comparison-mode' : ''}`}>{children}</div>;
}
