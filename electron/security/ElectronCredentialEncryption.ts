import { safeStorage } from 'electron'
import type { CredentialEncryption } from './ProviderCredentialVault'

export class ElectronCredentialEncryption implements CredentialEncryption {
  isSecureStorageAvailable() {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false
      if (process.platform !== 'linux') return true
      return new Set([
        'gnome_libsecret',
        'kwallet',
        'kwallet5',
        'kwallet6',
      ]).has(safeStorage.getSelectedStorageBackend())
    } catch {
      return false
    }
  }

  encrypt(secret: string) {
    return safeStorage.encryptString(secret)
  }

  decrypt(ciphertext: Buffer) {
    return safeStorage.decryptString(ciphertext)
  }
}
