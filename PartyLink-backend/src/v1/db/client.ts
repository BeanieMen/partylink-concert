import sqlite3 from 'sqlite3';
import { env } from '../config/env';

let db: sqlite3.Database | null = null;

export function getDb(): sqlite3.Database {
  if (db) return db;
  db = new sqlite3.Database(env.LOCAL_DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
  return db;
}

export function run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row as T | undefined);
    });
  });
}

export function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve((rows as T[]) ?? []);
    });
  });
}
