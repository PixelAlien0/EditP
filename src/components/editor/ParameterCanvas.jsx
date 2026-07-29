import { CapabilityLabels } from '../ui.jsx';

function makeGroupPanelId(sectionId, groupId) {
  return `parameter-group-${sectionId}-${groupId}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ParameterMatrix({
  sectionId,
  parameters,
  collapsedGroups,
  onToggleGroup,
  renderParameter,
  isParameterModified = () => false,
}) {
  const featured = parameters.filter(parameter => parameter.featured);
  const groups = parameters.filter(parameter => !parameter.featured).reduce((result, parameter) => {
    const id = parameter.group || 'Additional';
    const existing = result.find(group => group.id === id);
    if (existing) {
      existing.parameters.push(parameter);
      existing.capabilities = [...new Set([...existing.capabilities, ...(parameter.capabilities || [])])];
    } else {
      result.push({
        id,
        description: parameter.groupDescription || '',
        parameters: [parameter],
        capabilities: [...(parameter.capabilities || [])],
      });
    }
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
        {groups.map((group, groupIndex) => {
          const storageId = `${sectionId}:${group.id}`;
          const collapsed = Boolean(collapsedGroups[storageId]);
          const panelId = makeGroupPanelId(sectionId, group.id);
          const modifiedCount = group.parameters.filter(isParameterModified).length;
          return (
            <section
              className={`parameter-compact-group ${collapsed ? 'is-collapsed' : ''} ${modifiedCount > 0 ? 'has-edits' : ''}`}
              key={group.id}
            >
              <button
                type="button"
                className="parameter-group-heading"
                onClick={() => onToggleGroup(storageId)}
                aria-expanded={!collapsed}
                aria-controls={panelId}
              >
                <span className="parameter-group-heading__index" aria-hidden="true">
                  {String(groupIndex + 1).padStart(2, '0')}
                </span>
                <span className="parameter-group-heading__copy">
                  <span className="parameter-group-heading__title">
                    <strong>{group.id}</strong>
                    <CapabilityLabels capabilityIds={group.capabilities} compact />
                  </span>
                  {group.description && <small>{group.description}</small>}
                </span>
                <span className="parameter-group-heading__meta">
                  <span><strong>{group.parameters.length}</strong> fields</span>
                  {modifiedCount > 0 && <span className="is-edited"><strong>{modifiedCount}</strong> edited</span>}
                </span>
                <span className="parameter-group-heading__chevron" aria-hidden="true">
                  <svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
                </span>
              </button>
              {!collapsed && (
                <div id={panelId} className="parameter-compact-grid" role="region" aria-label={`${group.id} parameters`}>
                  {group.parameters.map(renderParameter)}
                </div>
              )}
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
