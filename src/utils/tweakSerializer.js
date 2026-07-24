// Lua key validation regex
const keyRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;

function Jo(str) {
  return `"${str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`;
}

function Yo(key) {
  if (/^\d+$/.test(key)) {
    return `[${key}]`;
  }
  return keyRegex.test(key) ? key : `[${Jo(key)}]`;
}

function Xo(val, depth) {
  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);

  if (val === null || val === undefined) {
    return 'nil';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'string') {
    return Jo(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '{}';
    return `{\n${val.map(item => `${nextIndent}${Xo(item, depth + 1)},`).join('\n')}\n${indent}}`;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).sort((a, b) => a.localeCompare(b));
    if (keys.length === 0) return '{}';
    return `{\n${keys
      .map(k => `${nextIndent}${Yo(k)} = ${Xo(val[k], depth + 1)},`)
      .join('\n')}\n${indent}}`;
  }
  return 'nil';
}

export function serializeLuaTable(obj) {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) {
    return '{\n}';
  }
  return `{\n${keys
    .map(key => {
      const serialized = Xo(obj[key], 1);
      return `  ${Yo(key)} = ${serialized},`;
    })
    .join('\n')}\n}`;
}

export function encodeBase64(str, options = { urlSafe: false, padding: false }) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected string for base64 encoding');
  }

  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let base64 = btoa(binary);

  if (!options.padding) {
    base64 = base64.replace(/=+$/, '');
  }

  if (options.urlSafe) {
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_');
  }
  return base64;
}

// BAR start scripts do not preserve `+` reliably inside modoption values.
// Always use the URL-safe alphabet for lobby exports so decoded Lua operators
// (notably `~=`) cannot be corrupted before tweakdefs is parsed.
export function encodeLobbyBase64(str, options = {}) {
  return encodeBase64(str, {
    urlSafe: true,
    padding: options.padding ?? false,
  });
}

export function estimateLobbyRisk(luaCode, customUnitClones = []) {
  const cloneCount = customUnitClones.length;
  const tableCopyCount = (luaCode.match(/table\.copy\s*\(\s*UnitDefs/g) || []).length;
  const unitDefsLoopCount = (luaCode.match(/for\s+\w+\s*,\s*\w+\s+in\s+pairs\s*\(\s*UnitDefs\s*\)/g) || []).length;
  const charLength = luaCode.length;
  
  const isSuspicious = charLength >= 25000 || Math.max(cloneCount, tableCopyCount) >= 8 || unitDefsLoopCount >= 5;
  const isHigh = charLength >= 35000 || Math.max(cloneCount, tableCopyCount) >= 12 || unitDefsLoopCount >= 10 || (isSuspicious && [charLength >= 25000, cloneCount >= 8].filter(Boolean).length >= 2);
  
  if (isHigh) return 'high';
  if (isSuspicious) return 'caution';
  return 'none';
}
