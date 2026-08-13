const TRACE_LANES = Object.freeze(['defs', 'units']);

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), 'en');
}

function findEffectiveBlock(block, effectiveBlocks) {
  return effectiveBlocks.find(candidate => (
    candidate.id === block.id
    || candidate.deduplicatedBlockIds?.includes(block.id)
    || candidate.provenance?.some(item => item.id === block.id)
  )) || null;
}

function sourceIdentity(block) {
  if (block.metadata?.unitId) return block.metadata.unitId;
  if (block.metadata?.label) return block.metadata.label;
  if (block.metadata?.sourceName) return block.metadata.sourceName;
  if (block.metadata?.moduleId) return block.metadata.moduleId;
  return block.sourceFeature || block.category || block.id;
}

export function buildExportTraceReport(compiledModules) {
  const canonical = compiledModules?.canonicalBlocks || {};
  const effective = compiledModules?.effectiveBlocks || canonical;
  const slots = compiledModules?.slots || [];
  const traces = TRACE_LANES.flatMap(lane => {
    const canonicalBlocks = canonical[lane] || [];
    const effectiveBlocks = effective[lane] || [];
    return canonicalBlocks.map(block => {
      const effectiveBlock = findEffectiveBlock(block, effectiveBlocks);
      const slot = slots.find(item => (
        item.kind === lane
        && (item.blockIds || []).some(id => id === block.id || id === effectiveBlock?.id)
      )) || null;
      const deduplicated = Boolean(effectiveBlock && effectiveBlock.id !== block.id);
      const laneOverflow = Boolean(compiledModules?.[lane]?.overflow);
      return {
        id: block.id,
        lane,
        source: block.source || 'generated',
        sourceIdentity: sourceIdentity(block),
        sourceFeature: block.sourceFeature || 'editor-generated',
        category: block.category || 'compiler-block',
        label: block.label || block.id,
        stage: block.stage || 'editor',
        sequence: Number(block.sequence) || 0,
        rawBytes: Number(block.rawBytes) || 0,
        dependencies: [...(block.dependencies || [])],
        effectiveBlockId: effectiveBlock?.id || '',
        deduplicated,
        slotFieldName: slot?.fieldName || '',
        slotLabel: slot?.label || '',
        slotEncodedBytes: Number(slot?.encodedBytes) || 0,
        compatibility: slot?.compatibility || (laneOverflow ? 'overflow' : 'unpacked'),
        status: slot?.compatibility === 'blocked'
          ? 'blocked'
          : slot
            ? 'delivered'
            : laneOverflow
              ? 'overflow'
              : 'unpacked',
      };
    });
  }).sort((left, right) => (
    TRACE_LANES.indexOf(left.lane) - TRACE_LANES.indexOf(right.lane)
    || left.sequence - right.sequence
    || compareText(left.id, right.id)
  ));

  return {
    traces,
    summary: {
      canonicalBlocks: traces.length,
      executedBlocks: (effective.all || []).length,
      deliveredBlocks: traces.filter(trace => trace.slotFieldName).length,
      deduplicatedBlocks: traces.filter(trace => trace.deduplicated).length,
      unpackedBlocks: traces.filter(trace => !trace.slotFieldName).length,
      slots: slots.length,
    },
  };
}
