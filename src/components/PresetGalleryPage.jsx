import { Button, PageShell } from './ui.jsx';

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
    <PageShell className="preset-gallery-page" label="Preset Gallery">
      <div className="preset-gallery-modal" aria-labelledby="preset-gallery-title">
        <div className="preset-gallery-header">
          <div>
            <span>Experiment library <i /> Local project states</span>
            <h3 id="preset-gallery-title">Preset Gallery</h3>
            <p>Capture a complete editor state, compare your experiments, then return to any one without rebuilding it.</p>
          </div>
          <div className="preset-gallery-header-actions">
            <span>{presets.length} saved</span>
            <Button className="preset-gallery-close" onClick={onClose}>Back to editor</Button>
          </div>
        </div>

        <div className="preset-save-panel">
          <div className="preset-save-copy">
            <span>Capture current work</span>
            <small>Includes tweaks, clones, build menus, environment, and export settings.</small>
          </div>
          <label className="ui-field">
            <span>Preset name</span>
            <input className="form-input" placeholder={`${projectName} preset`} value={presetName} onChange={event => onPresetNameChange(event.target.value)} />
          </label>
          <label className="ui-field">
            <span>Project note</span>
            <input className="form-input" placeholder="Optional note, e.g. fast T1 air experiment" value={presetDescription} onChange={event => onPresetDescriptionChange(event.target.value)} />
          </label>
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
                      <span className="preset-card-overline">Project snapshot</span>
                      <h4>{preset.name}</h4>
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
            <div className="preset-empty-state">
              <strong>No saved presets yet</strong>
              <span>Capture the current project above to begin a personal experiment library.</span>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
