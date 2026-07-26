import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeProjectDocumentWithReport } from '../project/projectDocument.js';
import { projectStorage } from '../storage/projectStorage.js';
import { Button, Dialog, EmptyState, IconButton } from './ui.jsx';
import '../styles/features/project-checkpoints.css';

export default function ProjectCheckpointsDialog({ currentDocument, onRestore, onClose, onNotice }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [rejectedProjects, setRejectedProjects] = useState([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('loading');
  const closeRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [items, rejected] = await Promise.all([
        projectStorage.listRecoveryCheckpoints(),
        projectStorage.listRejectedProjects(),
      ]);
      setCheckpoints(items);
      setRejectedProjects(rejected);
      setStatus('ready');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createNamedCheckpoint = async event => {
    event.preventDefault();
    const label = name.trim() || 'Named checkpoint';
    await projectStorage.saveCheckpoint(currentDocument, label);
    setName('');
    onNotice(`Checkpoint saved: ${label}`);
    await refresh();
  };

  const restoreCheckpoint = async checkpoint => {
    try {
      const prepared = normalizeProjectDocumentWithReport(checkpoint.document);
      onRestore(prepared.document);
      const migrated = prepared.migrated ? ` Migrated from v${prepared.fromVersion}.` : '';
      onNotice(`Restored checkpoint: ${checkpoint.reason || 'Autosave'}.${migrated}`);
      onClose();
    } catch (error) {
      await projectStorage.saveRejectedProject({
        sourceName: `Checkpoint: ${checkpoint.reason || 'Autosave'}`,
        rawText: JSON.stringify(checkpoint.document, null, 2),
        error: error?.message,
        code: error?.code,
      }).catch(() => undefined);
      onNotice('That checkpoint is corrupted and was moved to Rejected files.');
      await refresh();
    }
  };

  const downloadRejectedProject = record => {
    const blob = new Blob([record.rawText || ''], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(record.sourceName || 'rejected-project').replace(/[^a-z0-9._-]+/gi, '_')}.rejected.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog onClose={onClose} initialFocusRef={closeRef} className="project-checkpoints" labelledBy="project-checkpoints-title">
      <header className="project-checkpoints__header">
        <div><span>Local recovery</span><h2 id="project-checkpoints-title">Project checkpoints</h2><p>Restore a validated state or download a rejected source file for repair.</p></div>
        <IconButton ref={closeRef} variant="quiet" label="Close project checkpoints" onClick={onClose}>×</IconButton>
      </header>
      <form className="project-checkpoints__create" onSubmit={createNamedCheckpoint}>
        <label htmlFor="checkpoint-name">Checkpoint name</label>
        <input id="checkpoint-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Before weapon rebalance" />
        <Button type="submit" variant="primary">Save checkpoint</Button>
      </form>
      <div className="project-checkpoints__timeline" aria-live="polite">
        {status === 'loading' && <p className="project-checkpoints__status">Loading local timeline…</p>}
        {status === 'unavailable' && <EmptyState title="Recovery storage unavailable" description="Use Save Project to create a portable backup instead." />}
        {status === 'ready' && rejectedProjects.length > 0 && (
          <section className="project-checkpoints__rejected" aria-labelledby="rejected-projects-title">
            <header>
              <div><span>Preserved source</span><h3 id="rejected-projects-title">Rejected project files</h3></div>
              <small>{rejectedProjects.length} retained</small>
            </header>
            {rejectedProjects.map(record => (
              <article key={record.id}>
                <time dateTime={new Date(record.updatedAt).toISOString()}>{new Date(record.updatedAt).toLocaleString()}</time>
                <div>
                  <strong>{record.sourceName}</strong>
                  <small>{record.error}</small>
                </div>
                <div className="project-checkpoints__rejected-actions">
                  <Button variant="secondary" onClick={() => downloadRejectedProject(record)}>Download source</Button>
                  <Button variant="quiet" onClick={async () => {
                    await projectStorage.deleteRejectedProject(record.id);
                    await refresh();
                  }}>Remove</Button>
                </div>
              </article>
            ))}
          </section>
        )}
        {status === 'ready' && (
          <div className="project-checkpoints__section-heading">
            <span>Restore points</span>
            <strong>Validated checkpoints</strong>
          </div>
        )}
        {status === 'ready' && checkpoints.length === 0 && <EmptyState title="No checkpoints yet" description="A checkpoint is created after edits settle, or save a named one above." />}
        {checkpoints.map(checkpoint => (
          <article key={checkpoint.id}>
            <time dateTime={new Date(checkpoint.updatedAt).toISOString()}>{new Date(checkpoint.updatedAt).toLocaleString()}</time>
            <div><strong>{checkpoint.reason || 'Autosave'}</strong><small>{Object.keys(checkpoint.document?.tweaks || {}).length} edited units · {checkpoint.document?.clones?.length || 0} clones</small></div>
            <Button variant="secondary" onClick={() => restoreCheckpoint(checkpoint)}>Restore</Button>
          </article>
        ))}
      </div>
    </Dialog>
  );
}
