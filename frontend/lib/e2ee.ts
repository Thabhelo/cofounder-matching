/**
 * End-to-End Encryption for media messaging.
 *
 * Uses ECDH (P-256) for key exchange and AES-GCM (256-bit) for encryption.
 * All crypto operations use the Web Crypto API (hardware-accelerated).
 *
 * Flow:
 * 1. On match connect, both users generate ECDH key pairs
 * 2. Public keys are exchanged via WebSocket
 * 3. Both derive the same shared AES key using ECDH
 * 4. Media is encrypted with AES-GCM before upload
 * 5. Recipient decrypts with the same derived key
 */

const ALGO_ECDH = { name: "ECDH", namedCurve: "P-256" } as const
const ALGO_AES = { name: "AES-GCM", length: 256 } as const

// ─── Key Management ──────────────────────────────────────────────

export interface SerializedKeyPair {
  publicKey: string   // base64-encoded raw public key
  privateKey: string  // base64-encoded PKCS8 private key
}

/** Generate a new ECDH key pair. */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ALGO_ECDH, true, ["deriveKey"])
}

/** Export public key to base64 for transmission. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key)
  return bufferToBase64(raw)
}

/** Import a base64 public key received from the other user. */
export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToBuffer(base64)
  return crypto.subtle.importKey("raw", raw, ALGO_ECDH, true, [])
}

/** Export key pair to storage (localStorage). */
export async function exportKeyPair(keyPair: CryptoKeyPair): Promise<SerializedKeyPair> {
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey)
  const privPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
  return {
    publicKey: bufferToBase64(pubRaw),
    privateKey: bufferToBase64(privPkcs8),
  }
}

/** Import key pair from storage. */
export async function importKeyPair(serialized: SerializedKeyPair): Promise<CryptoKeyPair> {
  const publicKey = await crypto.subtle.importKey(
    "raw", base64ToBuffer(serialized.publicKey), ALGO_ECDH, true, []
  )
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", base64ToBuffer(serialized.privateKey), ALGO_ECDH, true, ["deriveKey"]
  )
  return { publicKey, privateKey }
}

// ─── Key Derivation ──────────────────────────────────────────────

/** Derive a shared AES-GCM key from our private key + their public key. */
export async function deriveSharedKey(
  ourPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    ourPrivateKey,
    ALGO_AES,
    false,
    ["encrypt", "decrypt"]
  )
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────

export interface EncryptedPayload {
  iv: string       // base64 initialization vector (12 bytes)
  data: string     // base64 ciphertext
}

/** Encrypt a file/blob with AES-GCM. Returns IV + ciphertext. */
export async function encryptMedia(
  file: ArrayBuffer,
  sharedKey: CryptoKey
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    file
  )
  return {
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(ciphertext),
  }
}

/** Decrypt ciphertext back to original file bytes. */
export async function decryptMedia(
  payload: EncryptedPayload,
  sharedKey: CryptoKey
): Promise<ArrayBuffer> {
  const iv = base64ToBuffer(payload.iv)
  const ciphertext = base64ToBuffer(payload.data)
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    ciphertext
  )
}

// ─── Session Key Storage ─────────────────────────────────────────

const KEYS_PREFIX = "e2ee_keys_"
const SHARED_PREFIX = "e2ee_shared_"

/** Store our key pair for a match in localStorage. */
export async function storeKeyPair(matchId: string, keyPair: CryptoKeyPair) {
  const serialized = await exportKeyPair(keyPair)
  try {
    localStorage.setItem(KEYS_PREFIX + matchId, JSON.stringify(serialized))
  } catch {
    // localStorage unavailable — keys live only in memory
  }
}

/** Retrieve our key pair for a match. */
export async function loadKeyPair(matchId: string): Promise<CryptoKeyPair | null> {
  try {
    const stored = localStorage.getItem(KEYS_PREFIX + matchId)
    if (!stored) return null
    return importKeyPair(JSON.parse(stored))
  } catch {
    return null
  }
}

/** Store the derived shared key indicator (we store their public key, derive on demand). */
export function storeTheirPublicKey(matchId: string, publicKeyBase64: string) {
  try {
    localStorage.setItem(SHARED_PREFIX + matchId, publicKeyBase64)
  } catch {
    // Ignore
  }
}

/** Load their public key. */
export function loadTheirPublicKey(matchId: string): string | null {
  try {
    return localStorage.getItem(SHARED_PREFIX + matchId)
  } catch {
    return null
  }
}

// ─── Utilities ───────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
