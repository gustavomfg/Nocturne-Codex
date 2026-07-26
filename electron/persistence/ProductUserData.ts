import fs from 'node:fs'
import path from 'node:path'

const DATABASE_FILENAME = 'nocturne.db'

export function migrateProductUserData(appDataPath: string, currentName: string, legacyName: string) {
  const currentPath = path.join(appDataPath, currentName)
  const legacyPath = path.join(appDataPath, legacyName)

  if (fs.existsSync(currentPath)) {
    const currentDatabase = path.join(currentPath, DATABASE_FILENAME)
    const legacyDatabase = path.join(legacyPath, DATABASE_FILENAME)
    return !fs.existsSync(currentDatabase) && fs.existsSync(legacyDatabase)
      ? legacyPath
      : currentPath
  }

  if (!fs.existsSync(legacyPath)) return currentPath

  try {
    fs.renameSync(legacyPath, currentPath)
    return currentPath
  } catch {
    return legacyPath
  }
}
