import luaparse from 'luaparse';
import { encodeLobbyBase64 } from './tweakSerializer.js';

const { tokenTypes } = luaparse;
const textEncoder = new TextEncoder();
const WORD_TOKENS = new Set([
  tokenTypes.Keyword,
  tokenTypes.Identifier,
  tokenTypes.NumericLiteral,
  tokenTypes.BooleanLiteral,
  tokenTypes.NilLiteral,
]);
const MERGING_PUNCTUATORS = new Set(['==', '~=', '<=', '>=', '..', '...', '--']);

function normalizeLua(lua) {
  return String(lua || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}

function parseLua(lua, kind) {
  return luaparse.parse(kind === 'units' ? `return ${lua}` : lua, {
    luaVersion: '5.1',
    comments: false,
  });
}

function astSignature(lua, kind) {
  return JSON.stringify(parseLua(lua, kind));
}

function lexLua(source) {
  luaparse.parse(source, {
    luaVersion: '5.1',
    comments: false,
    wait: true,
  });
  const tokens = [];
  while (true) {
    const token = luaparse.lex();
    if (token.type === tokenTypes.EOF) break;
    tokens.push({
      type: token.type,
      raw: source.slice(token.range[0], token.range[1]),
    });
  }
  return tokens;
}

function needsSpace(previous, current) {
  if (!previous) return false;
  if (WORD_TOKENS.has(previous.type) && WORD_TOKENS.has(current.type)) return true;
  if (previous.type === tokenTypes.NumericLiteral && current.raw.startsWith('.')) return true;
  if (previous.raw.endsWith('.') && current.type === tokenTypes.NumericLiteral) return true;
  if (MERGING_PUNCTUATORS.has(`${previous.raw}${current.raw}`)) return true;
  return false;
}

function leadingCommentHeader(source) {
  const lines = source.split('\n');
  const header = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (header.length) header.push('');
      continue;
    }
    if (!trimmed.startsWith('--')) break;
    header.push(trimmed);
  }
  while (header.at(-1) === '') header.pop();
  return header.join('\n');
}

function compactTokens(source) {
  const tokens = lexLua(source);
  let compacted = '';
  let previous = null;
  tokens.forEach(token => {
    if (needsSpace(previous, token)) compacted += ' ';
    compacted += token.raw;
    previous = token;
  });
  const header = leadingCommentHeader(source);
  return header && compacted ? `${header}\n${compacted}` : compacted || header;
}

export function areLuaProgramsEquivalent(originalLua, candidateLua, kind = 'defs') {
  try {
    return astSignature(normalizeLua(originalLua), kind) === astSignature(normalizeLua(candidateLua), kind);
  } catch {
    return false;
  }
}

export function compactLuaIfEquivalent(lua, {
  kind = 'defs',
  enabled = true,
  padding = false,
} = {}) {
  const originalLua = normalizeLua(lua);
  const originalRawBytes = textEncoder.encode(originalLua).byteLength;
  const originalEncodedBytes = encodeLobbyBase64(`${originalLua} `, { padding }).length;
  const unchanged = reason => ({
    lua: originalLua,
    attempted: enabled,
    applied: false,
    equivalent: reason === 'not-smaller' || reason === 'empty-source',
    reason,
    rawBytesBefore: originalRawBytes,
    rawBytesAfter: originalRawBytes,
    rawBytesSaved: 0,
    encodedBytesBefore: originalEncodedBytes,
    encodedBytesAfter: originalEncodedBytes,
    encodedBytesSaved: 0,
  });

  if (!enabled) return unchanged('disabled');
  if (!originalLua) return unchanged('empty-source');

  let candidateLua;
  try {
    candidateLua = normalizeLua(compactTokens(originalLua));
  } catch {
    return unchanged('tokenization-failed');
  }
  if (!candidateLua) return unchanged('empty-candidate');
  if (candidateLua.length >= originalLua.length) return unchanged('not-smaller');
  if (!areLuaProgramsEquivalent(originalLua, candidateLua, kind)) {
    return unchanged('equivalence-failed');
  }

  const compactedRawBytes = textEncoder.encode(candidateLua).byteLength;
  const compactedEncodedBytes = encodeLobbyBase64(`${candidateLua} `, { padding }).length;
  return {
    lua: candidateLua,
    attempted: true,
    applied: true,
    equivalent: true,
    reason: 'equivalent',
    rawBytesBefore: originalRawBytes,
    rawBytesAfter: compactedRawBytes,
    rawBytesSaved: originalRawBytes - compactedRawBytes,
    encodedBytesBefore: originalEncodedBytes,
    encodedBytesAfter: compactedEncodedBytes,
    encodedBytesSaved: originalEncodedBytes - compactedEncodedBytes,
  };
}
