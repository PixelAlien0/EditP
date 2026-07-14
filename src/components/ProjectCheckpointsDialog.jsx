import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeProjectDocument } from '../project/projectDocument.js';
import { projectStorage } from '../storage/projectStorage.js';
import { Button, Dialog, EmptyState, IconButton } from './ui.jsx';
import '../styles/features/project-checkpoints.css';

export default function ProjectCheckpointsDialog({ currentDocument, onRestore, onClose, onNotice }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('loading');
  const closeRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const items = await projectStorage.listRecoveryCheckpoints();
      setCheckpoints(items);
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

  return (
    <Dialog onClose={onClose} initialFocusRef={closeRef} className="project-checkpoints" labelledBy="project-checkpoints-title">
      <header className="project-checkpoints__header">
        <div><span>Local recovery</span><h2 id="project-checkpoints-title">Project checkpoints</h2><p>Restore one of the ten most recent project states.</p></div>
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
        {status === 'ready' && checkpoints.length === 0 && <EmptyState title="No checkpoints yet" description="A checkpoint is created after edits settle, or save a named one above." />}
        {checkpoints.map(checkpoint => (
          <article key={checkpoint.id}>
            <time dateTime={new Date(checkpoint.updatedAt).toISOString()}>{new Date(checkpoint.updatedAt).toLocaleString()}</time>
            <div><strong>{checkpoint.reason || 'Autosave'}</strong><small>{Object.keys(checkpoint.document?.tweaks || {}).length} edited units · {checkpoint.document?.clones?.length || 0} clones</small></div>
            <Button variant="secondary" onClick={() => {
              onRestore(normalizeProjectDocument(checkpoint.document));
              onNotice(`Restored checkpoint: ${checkpoint.reason || 'Autosave'}`);
              onClose();
            }}>Restore</Button>
          </article>
        ))}
      </div>
    </Dialog>
  );
}
