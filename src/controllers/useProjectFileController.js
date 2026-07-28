import { useCallback } from 'react';
import {
  assertProjectSize,
  normalizeProjectDocumentWithReport,
} from '../project/projectDocument.js';
import { projectStorage } from '../storage/projectStorage.js';

function buildProjectFileName(projectName) {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${safeName}_mod_${new Date().toISOString().slice(0, 10)}.json`;
}

export function useProjectFileController({
  projectDocument,
  projectName,
  createCheckpoint,
  hydrateProjectStore,
  showToast,
  onImported,
  onRejected,
}) {
  const handleExportConfig = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify(projectDocument, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildProjectFileName(projectName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast('Configuration exported!');
  }, [projectDocument, projectName, showToast]);

  const handleImportConfig = useCallback(event => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      assertProjectSize(file.size);
    } catch (error) {
      showToast(error.message);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async loadEvent => {
      const rawText = String(loadEvent.target.result || '');
      try {
        const prepared = normalizeProjectDocumentWithReport(
          JSON.parse(rawText)
        );
        await createCheckpoint('Before project import').catch(() => undefined);
        hydrateProjectStore(prepared.document);
        onImported(prepared);
      } catch (error) {
        await projectStorage.saveRejectedProject({
          sourceName: file.name,
          rawText,
          error: error?.message,
          code: error?.code,
        }).catch(() => undefined);
        onRejected(error);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }, [
    createCheckpoint,
    hydrateProjectStore,
    onImported,
    onRejected,
    showToast,
  ]);

  return { handleExportConfig, handleImportConfig };
}
