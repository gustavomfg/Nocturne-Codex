import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Sqlite from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectDatabaseFile, isRecoverableDatabaseCorruption, listDatabaseRecoveryCandidates, restoreDatabaseFile } from '../electron/database/recovery'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

function createDatabase(filePath: string, value: string) {
  const database = new Sqlite(filePath)
  database.exec('CREATE TABLE state (value TEXT NOT NULL); PRAGMA user_version = 1;')
  database.prepare('INSERT INTO state(value) VALUES(?)').run(value)
  database.close()
}

describe('recuperação do banco', () => {
  it('distingue corrupção de falhas de permissão ou acesso', () => {
    expect(isRecoverableDatabaseCorruption(Object.assign(new Error('file is not a database'), { code: 'SQLITE_NOTADB' }))).toBe(true)
    expect(isRecoverableDatabaseCorruption(Object.assign(new Error('permission denied'), { code: 'EACCES' }))).toBe(false)
  })

  it('oferece somente snapshots íntegros e compatíveis, do mais recente ao mais antigo', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-recovery-list-'))
    directories.push(root)
    const backups = path.join(root, 'backups')
    fs.mkdirSync(backups)
    const older = path.join(root, 'nocturne.db.backup-1.db')
    const newer = path.join(backups, 'nocturne-before-restore-2.db')
    const invalid = path.join(backups, 'nocturne-before-restore-invalid.db')
    createDatabase(older, 'older')
    createDatabase(newer, 'newer')
    fs.writeFileSync(invalid, 'arquivo inválido')
    const oldTime = new Date('2026-01-01T00:00:00.000Z')
    const newTime = new Date('2026-01-02T00:00:00.000Z')
    fs.utimesSync(older, oldTime, oldTime)
    fs.utimesSync(newer, newTime, newTime)

    const candidates = await listDatabaseRecoveryCandidates(root)

    expect(candidates.map((item) => item.path)).toEqual([newer, older])
    expect(candidates.every((item) => item.schemaVersion === 1)).toBe(true)
  })

  it('restaura uma cópia verificada e preserva o banco corrompido em quarentena', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-recovery-restore-'))
    directories.push(root)
    const current = path.join(root, 'nocturne.db')
    const backup = path.join(root, 'nocturne.db.backup-valid.db')
    fs.writeFileSync(current, 'banco corrompido')
    fs.writeFileSync(`${current}-wal`, 'wal corrompido')
    createDatabase(backup, 'restored')

    const quarantine = await restoreDatabaseFile(root, backup)

    expect(inspectDatabaseFile(current)).toEqual({ schemaVersion: 1 })
    const restored = new Sqlite(current, { readonly: true })
    expect((restored.prepare('SELECT value FROM state').get() as { value: string }).value).toBe('restored')
    restored.close()
    expect(fs.readFileSync(path.join(quarantine, 'nocturne.db'), 'utf8')).toBe('banco corrompido')
    expect(fs.readFileSync(path.join(quarantine, 'nocturne.db-wal'), 'utf8')).toBe('wal corrompido')
  })

  it('devolve o arquivo original ao lugar quando a cópia de recuperação é inválida', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-recovery-rollback-'))
    directories.push(root)
    const current = path.join(root, 'nocturne.db')
    const invalidBackup = path.join(root, 'invalid-backup.db')
    fs.writeFileSync(current, 'estado original')
    fs.writeFileSync(invalidBackup, 'cópia inválida')

    await expect(restoreDatabaseFile(root, invalidBackup)).rejects.toThrow(/arquivo original foi preservado/)

    expect(fs.readFileSync(current, 'utf8')).toBe('estado original')
    expect(fs.readdirSync(root).some((name) => name.startsWith('database-corrupt-'))).toBe(false)
  })
})
