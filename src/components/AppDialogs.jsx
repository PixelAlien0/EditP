import { lazy, Suspense } from 'react';
import CreditsModal from './CreditsModal.jsx';
import CloneCreatorDialog from './CloneCreatorDialog.jsx';

const TemporaryChatDialog = lazy(() => import('./TemporaryChatDialog.jsx'));
const CommandPalette = lazy(() => import('./CommandPalette.jsx'));
const ProjectCheckpointsDialog = lazy(() => import('./ProjectCheckpointsDialog.jsx'));
const LazyBatchAdjustDialog = lazy(() => import('./BatchAdjustDialog.jsx'));
const LazyFormulaMutatorDialog = lazy(() => import('./FormulaMutatorDialog.jsx'));
const LazyCarrierDroneWorkbenchDialog = lazy(() => import('./CarrierDroneWorkbenchDialog.jsx'));
const LazySummaryExplorerDialog = lazy(() => import('./SummaryExplorerDialog.jsx'));

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

  // Clone creator dialog
  showClonePanel,
  cloneBaseId,
  selectedUnit,
  getProjectUnitIconUrl,
  cloneNewId,
  cloneName,
  cloneDesc,
  cloneBuilders,
  cloneAutoAssignBuilders,
  setCloneNewId,
  setCloneName,
  setCloneDesc,
  setCloneBuilders,
  setCloneAutoAssignBuilders,
  getAutomaticCloneBuilders,
  handleCreateClone,
  setShowClonePanel,

  // Mutator tools
  mutatorToolsEnabled,
  showBulkPanel,
  setShowBulkPanel,
  bulkParameterGroups,
  bulkStatKey,
  setBulkStatKey,
  bulkMode,
  setBulkMode,
  bulkPercent,
  setBulkPercent,
  bulkTargetUnits,
  activeCollection,
  handleApplyBulk,

  showFormulaMutator,
  setShowFormulaMutator,
  allUnitsList,
  filteredUnits,
  defaultsDb,
  tweaks,
  handleApplyFormula,

  // Carrier Drone Workbench
  showCarrierWorkbench,
  setShowCarrierWorkbench,
  clones,
  activeWeaponSlotTab,
  handleApplyCarrierLinkage,
  handleQuickCreateCloneFromWorkbench,

  // Summary Explorer Dialog
  showSummaryModal,
  setShowSummaryModal,
  activeSummaryTab,
  setActiveSummaryTab,
  disabledUnitIds,
  unitDescriptions,
  buildMenuSteps,
  buildMenuPacks,
  unitsDbNames,
  handleResetSummaryUnitEdits,
  handleResetAllSummaryUnitEdits,
  handleDeleteSummaryClone,
  handleDeleteAllSummaryClones,
  handleRevertSummaryRoster,
  handleResetAllSummaryRosters,
  handleDisableSummaryBuildMenuPack,
  handleRestoreSummaryUnit,
  handleRestoreAllSummaryUnits,
  handleResetAllProjectChanges,
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

      {showClonePanel && (
        <CloneCreatorDialog
          open={showClonePanel}
          baseId={cloneBaseId}
          baseName={selectedUnit?.name}
          baseIconUrl={getProjectUnitIconUrl ? getProjectUnitIconUrl(cloneBaseId) : undefined}
          baseFaction={selectedUnit?.faction}
          baseTier={selectedUnit?.tags?.find(tag => /^t[1-4]$/.test(tag))}
          newId={cloneNewId}
          name={cloneName}
          description={cloneDesc}
          builders={cloneBuilders}
          autoAssignBuilders={cloneAutoAssignBuilders}
          onNewIdChange={setCloneNewId}
          onNameChange={setCloneName}
          onDescriptionChange={setCloneDesc}
          onBuildersChange={setCloneBuilders}
          onAutoAssignChange={enabled => {
            if (setCloneAutoAssignBuilders) setCloneAutoAssignBuilders(enabled);
            if (setCloneBuilders && getAutomaticCloneBuilders) {
              setCloneBuilders(enabled ? getAutomaticCloneBuilders(cloneBaseId) : []);
            }
          }}
          onSubmit={handleCreateClone}
          onClose={() => setShowClonePanel && setShowClonePanel(false)}
        />
      )}

      {mutatorToolsEnabled && showBulkPanel && (
        <Suspense fallback={null}>
          <LazyBatchAdjustDialog
            open={showBulkPanel}
            onClose={() => setShowBulkPanel(false)}
            parameterGroups={bulkParameterGroups}
            statKey={bulkStatKey}
            onStatKeyChange={setBulkStatKey}
            mode={bulkMode}
            onModeChange={setBulkMode}
            value={bulkPercent}
            onValueChange={setBulkPercent}
            targetUnits={bulkTargetUnits}
            scopeLabel={activeCollection ? `Collection · ${activeCollection.name}` : 'Current filters'}
            onApply={handleApplyBulk}
          />
        </Suspense>
      )}

      {mutatorToolsEnabled && showFormulaMutator && (
        <Suspense fallback={null}>
          <LazyFormulaMutatorDialog
            open={showFormulaMutator}
            onClose={() => setShowFormulaMutator(false)}
            units={allUnitsList}
            selectedUnit={selectedUnit}
            activeCollection={activeCollection}
            filteredUnits={filteredUnits}
            defaultsDb={defaultsDb}
            tweaks={tweaks}
            onApplyFormula={handleApplyFormula}
          />
        </Suspense>
      )}

      {showCarrierWorkbench && (
        <Suspense fallback={null}>
          <LazyCarrierDroneWorkbenchDialog
            open={showCarrierWorkbench}
            onClose={() => setShowCarrierWorkbench(false)}
            units={allUnitsList}
            clones={clones}
            selectedUnit={selectedUnit}
            initialWeaponSlot={activeWeaponSlotTab}
            defaultsDb={defaultsDb}
            tweaks={tweaks}
            onApplyLinkage={handleApplyCarrierLinkage}
            onCreateClone={handleQuickCreateCloneFromWorkbench}
          />
        </Suspense>
      )}

      {showSummaryModal && (
        <Suspense fallback={null}>
          <LazySummaryExplorerDialog
            open={showSummaryModal}
            activeTab={activeSummaryTab}
            onTabChange={setActiveSummaryTab}
            onClose={() => setShowSummaryModal(false)}
            tweaks={tweaks}
            clones={clones}
            disabledUnitIds={disabledUnitIds}
            unitDescriptions={unitDescriptions}
            buildMenuSteps={buildMenuSteps}
            buildMenuPacks={buildMenuPacks}
            unitNames={unitsDbNames}
            onResetUnitEdits={handleResetSummaryUnitEdits}
            onResetAllUnitEdits={handleResetAllSummaryUnitEdits}
            onDeleteClone={handleDeleteSummaryClone}
            onDeleteAllClones={handleDeleteAllSummaryClones}
            onRevertRoster={handleRevertSummaryRoster}
            onResetAllRosters={handleResetAllSummaryRosters}
            onDisableBuildMenuPack={handleDisableSummaryBuildMenuPack}
            onRestoreUnit={handleRestoreSummaryUnit}
            onRestoreAllUnits={handleRestoreAllSummaryUnits}
            onResetAllChanges={handleResetAllProjectChanges}
          />
        </Suspense>
      )}
    </>
  );
}
