import { getOfflineAuth, saveOfflineAuth, removeOfflineAuth } from './offlineAuthStore'

const ITERATIONS = 310000
const KEY_LENGTH = 256

function toBase64(bytes) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

async function deriveVerifier(password, salt) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    KEY_LENGTH,
  )

  return new Uint8Array(bits)
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i]
  return result === 0
}

export async function rememberOfflineLogin({ email, password, user }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail || !password || !user) return

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const verifier = await deriveVerifier(password, salt)

  await saveOfflineAuth({
    email: normalizedEmail,
    user,
    salt: toBase64(salt),
    verifier: toBase64(verifier),
    updatedAt: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000),
  })
}

export async function offlineLogin({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const record = await getOfflineAuth(normalizedEmail)

  if (!record) {
    throw new Error('This account has not been enabled for offline sign in. Connect to the internet and sign in once.')
  }

  if (record.expiresAt && Date.now() > record.expiresAt) {
    await removeOfflineAuth(normalizedEmail)
    throw new Error('Offline sign in has expired. Connect to the internet and sign in again.')
  }

  const verifier = await deriveVerifier(password, fromBase64(record.salt))
  if (!constantTimeEqual(verifier, fromBase64(record.verifier))) {
    throw new Error('Invalid email or password.')
  }

  return {
    token: null,
    user: record.user,
    offline: true,
  }
}
