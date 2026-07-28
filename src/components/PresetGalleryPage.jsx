import { Button, EmptyState, PageShell, TextField, Type } from './ui.jsx';
import '../styles/features/preset-gallery.css';

export default function PresetGalleryPage({
  presets,
  projectName,
  presetName,
  presetDescription,
  onPresetNameChange,
  onPresetDescriptionChange,
  onSave,
  onApply,
  onDelete,
  onClose
}) {
  return (
    <PageShell
      className="preset-gallery-page"
      label="Preset Gallery"
      eyebrow="Experiment library"
      title="Preset Gallery"
      description="Capture a complete editor state, compare experiments, and restore them without rebuilding."
      capabilityId="tool.preset-gallery"
      metrics={[{ label: 'Saved presets', value: presets.length }]}
      actions={<Button className="preset-gallery-close" onClick={onClose}>Back to editor</Button>}
      bodyClassName="preset-gallery-page__body"
    >
        <div className="preset-save-panel">
          <div className="preset-save-copy">
            <Type variant="eyebrow">Capture current work</Type>
            <Type as="small" variant="description">Includes tweaks, clones, build menus, and export settings.</Type>
          </div>
          <TextField label="Preset name" placeholder={`${projectName} preset`} value={presetName} onChange={event => onPresetNameChange(event.target.value)} />
          <TextField label="Project note" placeholder="Optional note, e.g. fast T1 air experiment" value={presetDescription} onChange={event => onPresetDescriptionChange(event.target.value)} />
          <Button variant="primary" className="preset-save-action" onClick={onSave}>Save preset</Button>
        </div>

        <div className="preset-gallery-content">
          {presets.length > 0 ? presets.map(preset => {
            const snapshot = preset.snapshot || {};
            const tweakCount = Object.keys(snapshot.tweaks || {}).length;
            const cloneCount = (snapshot.clones || []).length;
            const rosterCount = (snapshot.buildMenuSteps || []).length;
            const totalChanges = tweakCount + cloneCount + rosterCount;
            return (
              <article className="preset-card" key={preset.id}>
                <div className="preset-card-main">
                  <div className="preset-card-heading">
                    <span className="preset-card-mark" aria-hidden="true">{preset.name?.charAt(0).toUpperCase() || 'P'}</span>
                    <div className="preset-card-identity">
                      <Type variant="eyebrow" className="preset-card-overline">Project snapshot</Type>
                      <Type as="h4" variant="subsection-title">{preset.name}</Type>
                    </div>
                    <time dateTime={preset.createdAt}>{new Date(preset.createdAt).toLocaleDateString()}</time>
                  </div>
                  <p>{preset.description || 'Saved editor configuration'}</p>
                  <div className="preset-card-metrics" aria-label={`${preset.name} summary`}>
                    <div><strong>{tweakCount}</strong><span>Unit tweaks</span></div>
                    <div><strong>{cloneCount}</strong><span>Custom units</span></div>
                    <div><strong>{rosterCount}</strong><span>Roster edits</span></div>
                  </div>
                </div>
                <div className="preset-card-footer">
                  <span><strong>{totalChanges}</strong> recorded changes</span>
                  <div className="preset-card-actions">
                    <Button variant="primary" className="preset-apply-action" onClick={() => onApply(preset)}>Open preset</Button>
                    <Button variant="danger" className="preset-delete-action" onClick={() => onDelete(preset.id)} aria-label={`Delete ${preset.name}`}>Delete</Button>
                  </div>
                </div>
              </article>
            );
          }) : (
            <EmptyState
              className="preset-empty-state"
              title="No saved presets yet"
              description="Capture the current project above to begin a personal experiment library."
            />
          )}
        </div>
    </PageShell>
  );
}
