import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'

function key(): Buffer {
  const hex = process.env.DRIVE_TOKEN_ENCRYPTION_KEY
  if (!hex) throw new Error('DRIVE_TOKEN_ENCRYPTION_KEY não configurada')
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('DRIVE_TOKEN_ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)')
  return buf
}

// Formato: iv(12) + tag(16) + ciphertext → base64
export function encrypt(text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(encryptedBase64: string): string {
  const buf = Buffer.from(encryptedBase64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = createDecipheriv(ALGO, key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
