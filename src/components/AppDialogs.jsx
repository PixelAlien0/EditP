import { lazy, Suspense } from 'react';
import CreditsModal from './CreditsModal.jsx';

const TemporaryChatDialog = lazy(() => import('./TemporaryChatDialog.jsx'));
const CommandPalette = lazy(() => import('./CommandPalette.jsx'));
const ProjectCheckpointsDialog = lazy(() => import('./ProjectCheckpointsDialog.jsx'));

export default function AppDialogs({
  creditsOpen,
  chatOpen,
  commandPaletteOpen,
  checkpointsOpen,
  chat,
  commands,
  projectDocument,
  onCloseCredits,
  onCloseChat,
  onCloseCommandPalette,
  onCloseCheckpoints,
  onRestoreCheckpoint,
  onNotice,
}) {
  return (
    <>
      {creditsOpen && <CreditsModal onClose={onCloseCredits} />}
      {chatOpen && (
        <Suspense fallback={null}>
          <TemporaryChatDialog chat={chat} onClose={onCloseChat} />
        </Suspense>
      )}
      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette commands={commands} onClose={onCloseCommandPalette} />
        </Suspense>
      )}
      {checkpointsOpen && (
        <Suspense fallback={null}>
          <ProjectCheckpointsDialog
            currentDocument={projectDocument}
            onRestore={onRestoreCheckpoint}
            onNotice={onNotice}
            onClose={onCloseCheckpoints}
          />
        </Suspense>
      )}
    </>
  );
}
