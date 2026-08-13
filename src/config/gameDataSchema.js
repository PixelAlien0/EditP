// Shared by the snapshot generator and the browser integrity gate. Keep the
// supported schema in one place so a data migration cannot strand the editor
// behind a stale runtime-only version check.
export const GAME_DATA_SNAPSHOT_SCHEMA_VERSION = 2;
