import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './logger';

/**
 * Secure, chunked token storage backed by the OS keychain/keystore
 * (expo-secure-store), with safe fallbacks.
 *
 * Why this exists: auth tokens were previously kept in AsyncStorage, which is
 * unencrypted (readable on rooted/jailbroken devices and in unencrypted
 * backups). SecureStore encrypts at rest — but on Android a single value must
 * be < ~2048 bytes, and Cognito JWTs can exceed that. So we chunk values
 * across multiple SecureStore entries.
 *
 * Fallbacks (so auth NEVER breaks):
 *  - On any SecureStore error, fall back to AsyncStorage.
 *  - On read, if nothing is in SecureStore, check the legacy AsyncStorage key
 *    and migrate it into SecureStore (one-time, transparent to the user).
 */

const CHUNK_SIZE = 1800; // safely under SecureStore's ~2048-byte Android cap

export async function setSecureItem(key: string, value: string): Promise<void> {
  // Drop any legacy plaintext copy first.
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }

  try {
    // Clear any previous chunks for this key before writing new ones.
    await clearSecureChunks(key);
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE) || 1;
    await SecureStore.setItemAsync(`${key}__count`, String(chunkCount));
    for (let i = 0; i < chunkCount; i++) {
      await SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  } catch (e) {
    // SecureStore unavailable (e.g. no keystore) — fall back so login still works.
    logger.log('[secureTokens] SecureStore set failed, using AsyncStorage fallback', e);
    try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ }
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      let out = '';
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}__${i}`);
        if (part == null) return null; // corrupt/partial — treat as absent
        out += part;
      }
      return out;
    }
  } catch (e) {
    logger.log('[secureTokens] SecureStore get failed', e);
  }

  // Migration / fallback: legacy AsyncStorage value.
  try {
    const legacy = await AsyncStorage.getItem(key);
    if (legacy != null) {
      await setSecureItem(key, legacy); // migrate into secure storage (also clears the legacy copy)
      return legacy;
    }
  } catch { /* ignore */ }

  return null;
}

async function clearSecureChunks(key: string): Promise<void> {
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    const count = countStr ? parseInt(countStr, 10) : 0;
    await SecureStore.deleteItemAsync(`${key}__count`);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}__${i}`);
    }
  } catch { /* ignore */ }
}

export async function deleteSecureItem(key: string): Promise<void> {
  await clearSecureChunks(key);
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
}
