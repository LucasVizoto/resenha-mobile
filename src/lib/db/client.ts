import * as SQLite from 'expo-sqlite';
import { CONTACTS_CACHE_EXTRA_COLUMNS, SCHEMA_SQL } from './schema';

let db: SQLite.SQLiteDatabase | null = null;
let dbKey: string | null = null;
let initChain: Promise<SQLite.SQLiteDatabase> = Promise.resolve(
  null as unknown as SQLite.SQLiteDatabase,
);

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('DB não inicializado — chame initDb() no boot');
  }
  return db;
}

function isBenignDbError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /closed resource|NullPointerException|prepareAsync|has been rejected|duplicate column name/i.test(
    message,
  );
}

async function ensureColumns(
  database: SQLite.SQLiteDatabase,
  table: string,
  columns: [string, string][],
) {
  const existing = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const names = new Set(existing.map((c) => c.name));
  for (const [name, type] of columns) {
    if (!names.has(name)) {
      try {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      } catch (e) {
        if (!isBenignDbError(e)) throw e;
      }
    }
  }
}

function fileForUser(userId?: string | null): { file: string; key: string } {
  if (!userId) return { file: 'resenha_anon.db', key: 'anon' };
  return { file: `resenha_${userId.replace(/-/g, '')}.db`, key: `u:${userId}` };
}

async function initDbUnlocked(userId?: string | null): Promise<SQLite.SQLiteDatabase> {
  const { file, key } = fileForUser(userId);
  if (db && dbKey === key) return db;
  const previous = db;
  db = null;
  dbKey = null;
  if (previous) {
    try {
      await previous.closeAsync();
    } catch {
      // o handle nativo já foi fechado
    }
  }
  const next = await SQLite.openDatabaseAsync(file);
  await next.execAsync(SCHEMA_SQL);
  await ensureColumns(next, 'contacts_cache', CONTACTS_CACHE_EXTRA_COLUMNS);
  await ensureColumns(next, 'conversations', [
    ['last_read_at', 'TEXT'],
    ['kind', "TEXT DEFAULT 'dm'"],
    ['description', 'TEXT'],
  ]);
  db = next;
  dbKey = key;
  return next;
}

export function initDb(userId?: string | null): Promise<SQLite.SQLiteDatabase> {
  initChain = initChain.then(
    () => initDbUnlocked(userId),
    () => initDbUnlocked(userId),
  );
  return initChain;
}
