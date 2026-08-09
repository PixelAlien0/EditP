import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countS3oPieces, parseS3oModel } from './s3oModel.js';

describe('S3O model parser', () => {
  it('parses the pinned CORAK prototype and its piece hierarchy', () => {
    const source = readFileSync('public/bar-models/corak/corak.s3o');
    const model = parseS3oModel(source);

    expect(model.texture1).toBe('cor_color.dds');
    expect(model.texture2).toBe('cor_other.dds');
    expect(model.root.name).toBe('pelvis');
    expect(countS3oPieces(model.root)).toBeGreaterThan(5);
    expect(model.root.indices.length % 3).toBe(0);
  });

  it('rejects invalid binary input', () => {
    expect(() => parseS3oModel(new Uint8Array(52))).toThrow(/valid Spring S3O/i);
  });
});
