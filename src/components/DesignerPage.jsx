import { Button, PageShell } from './ui.jsx';

export default function DesignerPage({
  children,
  factoryId,
  factoryName,
  factoryIconUrl,
  activeSlotCount,
  changeCount,
  onClose
}) {
  return (
    <PageShell className="designer-page" label="Factory Roster Designer">
      <div className="designer-modal-container">
        <div className="designer-modal-header">
          <div className="designer-modal-heading">
            <span className="designer-modal-eyebrow">Production planning</span>
            <span className="designer-modal-title">Factory Roster Designer</span>
            <span className="designer-modal-subtitle">Compose, sequence, and validate factory build options.</span>
          </div>
          <div className="designer-header-context">
            <div className="designer-selected-factory">
              <div className="designer-unit-pic"><img src={factoryIconUrl} alt="" /></div>
              <div><span>{factoryName}</span><code>{factoryId}</code></div>
            </div>
            <div className="designer-header-stat"><span>Active slots</span><strong>{activeSlotCount}</strong></div>
            <div className="designer-header-stat"><span>Changes</span><strong>{changeCount}</strong></div>
            <Button className="designer-close-button" onClick={onClose}>Back to editor</Button>
          </div>
        </div>
        {children}
      </div>
    </PageShell>
  );
}
