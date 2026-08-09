const S3O_MAGIC = 'Spring unit\0';
const HEADER_SIZE = 52;
const PIECE_SIZE = 52;
const VERTEX_SIZE = 32;
const STRIP_RESTART = 0xffffffff;

function assertRange(byteLength, offset, size, label) {
  if (!Number.isInteger(offset) || offset < 0 || offset + size > byteLength) {
    throw new Error(`Invalid S3O ${label} offset.`);
  }
}

function readCString(bytes, offset) {
  assertRange(bytes.byteLength, offset, 1, 'string');
  let end = offset;
  while (end < bytes.byteLength && bytes[end] !== 0) end += 1;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

function triangulate(indices, primitiveType) {
  if (primitiveType === 0) {
    return indices.filter(index => index !== STRIP_RESTART);
  }
  if (primitiveType === 2) {
    const triangles = [];
    for (let index = 0; index + 3 < indices.length; index += 4) {
      triangles.push(indices[index], indices[index + 1], indices[index + 2]);
      triangles.push(indices[index], indices[index + 2], indices[index + 3]);
    }
    return triangles;
  }
  if (primitiveType !== 1) throw new Error(`Unsupported S3O primitive type ${primitiveType}.`);

  const triangles = [];
  let strip = [];
  const flush = () => {
    for (let index = 0; index + 2 < strip.length; index += 1) {
      const a = strip[index];
      const b = strip[index + 1];
      const c = strip[index + 2];
      if (a === b || b === c || a === c) continue;
      if (index % 2 === 0) triangles.push(a, b, c);
      else triangles.push(b, a, c);
    }
    strip = [];
  };
  indices.forEach(index => {
    if (index === STRIP_RESTART) flush();
    else strip.push(index);
  });
  flush();
  return triangles;
}

export function parseS3oModel(input) {
  const buffer = input instanceof ArrayBuffer
    ? input
    : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  assertRange(view.byteLength, 0, HEADER_SIZE, 'header');
  if (new TextDecoder().decode(bytes.subarray(0, 12)) !== S3O_MAGIC) throw new Error('Not a valid Spring S3O model.');

  const header = {
    version: view.getInt32(12, true),
    radius: view.getFloat32(16, true),
    height: view.getFloat32(20, true),
    midpoint: [view.getFloat32(24, true), view.getFloat32(28, true), view.getFloat32(32, true)],
    rootPieceOffset: view.getInt32(36, true),
    texture1: readCString(bytes, view.getInt32(44, true)),
    texture2: readCString(bytes, view.getInt32(48, true)),
  };
  if (header.version !== 0) throw new Error(`Unsupported S3O version ${header.version}.`);

  const activeOffsets = new Set();
  const parsePiece = offset => {
    assertRange(view.byteLength, offset, PIECE_SIZE, 'piece');
    if (activeOffsets.has(offset)) throw new Error('Cyclic S3O piece hierarchy.');
    activeOffsets.add(offset);

    const nameOffset = view.getInt32(offset, true);
    const childCount = view.getInt32(offset + 4, true);
    const childrenOffset = view.getInt32(offset + 8, true);
    const vertexCount = view.getInt32(offset + 12, true);
    const verticesOffset = view.getInt32(offset + 16, true);
    const primitiveType = view.getInt32(offset + 24, true);
    const indexCount = view.getInt32(offset + 28, true);
    const indicesOffset = view.getInt32(offset + 32, true);
    if (childCount < 0 || vertexCount < 0 || indexCount < 0) throw new Error('Invalid negative S3O collection size.');
    assertRange(view.byteLength, verticesOffset, vertexCount * VERTEX_SIZE, 'vertices');
    assertRange(view.byteLength, indicesOffset, indexCount * 4, 'index table');
    if (childCount > 0) assertRange(view.byteLength, childrenOffset, childCount * 4, 'child table');

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    for (let index = 0; index < vertexCount; index += 1) {
      const vertexOffset = verticesOffset + index * VERTEX_SIZE;
      positions.set([
        view.getFloat32(vertexOffset, true),
        view.getFloat32(vertexOffset + 4, true),
        view.getFloat32(vertexOffset + 8, true),
      ], index * 3);
      normals.set([
        view.getFloat32(vertexOffset + 12, true),
        view.getFloat32(vertexOffset + 16, true),
        view.getFloat32(vertexOffset + 20, true),
      ], index * 3);
      uvs.set([
        view.getFloat32(vertexOffset + 24, true),
        view.getFloat32(vertexOffset + 28, true),
      ], index * 2);
    }

    const rawIndices = Array.from({ length: indexCount }, (_, index) => view.getUint32(indicesOffset + index * 4, true));
    const children = Array.from({ length: childCount }, (_, index) => parsePiece(view.getInt32(childrenOffset + index * 4, true)));
    activeOffsets.delete(offset);
    return {
      name: readCString(bytes, nameOffset),
      offset: [view.getFloat32(offset + 40, true), view.getFloat32(offset + 44, true), view.getFloat32(offset + 48, true)],
      positions,
      normals,
      uvs,
      indices: new Uint32Array(triangulate(rawIndices, primitiveType)),
      children,
    };
  };

  return { ...header, root: parsePiece(header.rootPieceOffset) };
}

export function countS3oPieces(piece) {
  return 1 + piece.children.reduce((total, child) => total + countS3oPieces(child), 0);
}
