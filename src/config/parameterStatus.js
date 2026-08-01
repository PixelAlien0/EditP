export const PARAMETER_STATUS_DEFINITIONS = Object.freeze({
  bar: Object.freeze({
    id: 'bar',
    label: 'BAR',
    tone: 'neutral',
    description: 'The value comes directly from the bundled BAR definition snapshot.',
  }),
  inherited: Object.freeze({
    id: 'inherited',
    label: 'Inherited',
    tone: 'neutral',
    description: 'No project override is stored; the source definition or engine supplies the value.',
  }),
  edited: Object.freeze({
    id: 'edited',
    label: 'Edited',
    tone: 'accent',
    description: 'An explicit override is stored in this project.',
  }),
  generated: Object.freeze({
    id: 'generated',
    label: 'Generated',
    tone: 'info',
    description: 'BAR Editor generates supporting Lua or a definition for this parameter.',
  }),
  gadget: Object.freeze({
    id: 'gadget',
    label: 'Gadget',
    tone: 'info',
    description: 'Runtime behavior is interpreted by a BAR LuaRules gadget.',
  }),
  external: Object.freeze({
    id: 'external',
    label: 'External mod',
    tone: 'warning',
    description: 'The value requires an asset, key, or behavior supplied outside the bundled BAR snapshot.',
  }),
});

function addStatus(statuses, id) {
  const definition = PARAMETER_STATUS_DEFINITIONS[id];
  if (definition && !statuses.some(status => status.id === id)) statuses.push(definition);
}

export function resolveParameterStatuses({
  modified = false,
  source = 'inherited',
  capabilityIds = [],
  generated = false,
  external = false,
} = {}) {
  const statuses = [];

  if (modified) addStatus(statuses, 'edited');
  else if (source === 'bar') addStatus(statuses, 'bar');
  else if (source === 'external') addStatus(statuses, 'external');
  else if (source === 'generated') addStatus(statuses, 'generated');
  else addStatus(statuses, 'inherited');

  if (generated || capabilityIds.includes('editor-generated')) addStatus(statuses, 'generated');
  if (capabilityIds.includes('bar-gadget')) addStatus(statuses, 'gadget');
  if (external) addStatus(statuses, 'external');

  return statuses;
}

