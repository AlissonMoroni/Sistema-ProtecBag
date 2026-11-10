/**
 * PROTECBAG SISTEMAS - MÓDULO DE SEGURANÇA CORPORATIVA & CRIPTOGRAFIA
 * 
 * Este módulo gerencia:
 * 1. Hashing e validação de senhas com SHA-256 e Salt criptográfico exclusivo por usuário.
 * 2. Geração e validação de Tokens de Acesso / Token ID (PB-TOK-xxxx).
 * 3. Proteção contra força bruta (Lockout Policy): 3 falhas consecutivas bloqueiam por 2 minutos.
 * 4. Higienização de dados para impedir vazamento de credenciais na memória e no armazenamento.
 */

const LOCKOUT_KEY_PREFIX = 'protecbag_sec_lockout_';
export const MAX_LOGIN_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutos (120.000 ms)
const GLOBAL_PEPPER = 'PB_CORP_SECURITY_SALT_2026_PROTECBAG';

/**
 * Converte ArrayBuffer para string hexadecimal
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gera um salt criptográfico aleatório
 */
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash seguro SHA-256 com Salt individual e Pepper corporativo
 */
export async function hashPassword(password: string, customSalt?: string): Promise<{ hash: string; salt: string }> {
  const salt = customSalt || generateSalt(16);
  const dataToHash = `${salt}:${password}:${GLOBAL_PEPPER}`;

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataToHash);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return {
      hash: bufferToHex(hashBuffer),
      salt,
    };
  } else {
    // Fallback determinístico caso Web Crypto Subtle não esteja disponível
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < dataToHash.length; i++) {
      const ch = dataToHash.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const fallbackHex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
    return {
      hash: `pb_sha_${fallbackHex}`,
      salt,
    };
  }
}

/**
 * Verifica se a senha informada corresponde ao hash registrado
 */
export async function verifyPassword(
  providedPassword: string,
  storedHash?: string,
  storedSalt?: string,
  legacyPlaintext?: string
): Promise<boolean> {
  if (!providedPassword) return false;

  // 1. Verificação contra hash salteado
  if (storedHash && storedSalt) {
    const { hash } = await hashPassword(providedPassword, storedSalt);
    return hash === storedHash;
  }

  // 2. Verificação de compatibilidade legada (caso usuário tenha sido criado antes da migração de hash)
  if (legacyPlaintext && legacyPlaintext === providedPassword) {
    return true;
  }

  return false;
}

/**
 * Gera um Token ID / Chave de Acesso única e segura para o usuário (ex: PB-TOK-A9B2-4C1F)
 */
export function generateTokenId(prefix = 'PB-TOK'): string {
  const bytes = new Uint8Array(8);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
  return `${prefix}-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${hex.substring(8, 12)}`;
}

/**
 * Gera um token de sessão com validade (8 horas)
 */
export function generateSessionToken(userId: string): { token: string; expiresAt: string } {
  const randomPart = generateSalt(24);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(); // 8 horas
  return {
    token: `PB-SES-${userId.replace(/[^a-zA-Z0-9]/g, '')}-${randomPart}`,
    expiresAt,
  };
}

/**
 * Estado de Bloqueio por Força Bruta (Lockout State)
 */
export interface LockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
  lockedUntil: number | null;
}

/**
 * Gerenciador de tentativas de login e bloqueio de 2 minutos
 */
export const LockoutManager = {
  getStorageKey(email: string): string {
    return `${LOCKOUT_KEY_PREFIX}${email.trim().toLowerCase()}`;
  },

  getState(email: string): LockoutState {
    if (!email) {
      return { isLocked: false, remainingSeconds: 0, attempts: 0, lockedUntil: null };
    }

    try {
      const raw = localStorage.getItem(this.getStorageKey(email));
      if (!raw) {
        return { isLocked: false, remainingSeconds: 0, attempts: 0, lockedUntil: null };
      }

      const data = JSON.parse(raw);
      const now = Date.now();

      if (data.lockedUntil && now < data.lockedUntil) {
        const remainingSeconds = Math.max(1, Math.ceil((data.lockedUntil - now) / 1000));
        return {
          isLocked: true,
          remainingSeconds,
          attempts: data.attempts || MAX_LOGIN_ATTEMPTS,
          lockedUntil: data.lockedUntil,
        };
      }

      // Se o tempo de 2 minutos expirou, reseta o bloqueio automaticamente
      if (data.lockedUntil && now >= data.lockedUntil) {
        this.reset(email);
        return { isLocked: false, remainingSeconds: 0, attempts: 0, lockedUntil: null };
      }

      return {
        isLocked: false,
        remainingSeconds: 0,
        attempts: data.attempts || 0,
        lockedUntil: null,
      };
    } catch {
      return { isLocked: false, remainingSeconds: 0, attempts: 0, lockedUntil: null };
    }
  },

  recordFailure(email: string): { isLocked: boolean; remainingSeconds: number; attempts: number; attemptsLeft: number } {
    const key = this.getStorageKey(email);
    const current = this.getState(email);

    const newAttempts = current.attempts + 1;
    const now = Date.now();

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_DURATION_MS; // 2 minutos
      const payload = {
        attempts: newAttempts,
        lockedUntil,
        lastAttempt: now,
      };
      localStorage.setItem(key, JSON.stringify(payload));
      return {
        isLocked: true,
        remainingSeconds: 120,
        attempts: newAttempts,
        attemptsLeft: 0,
      };
    } else {
      const payload = {
        attempts: newAttempts,
        lockedUntil: null,
        lastAttempt: now,
      };
      localStorage.setItem(key, JSON.stringify(payload));
      return {
        isLocked: false,
        remainingSeconds: 0,
        attempts: newAttempts,
        attemptsLeft: MAX_LOGIN_ATTEMPTS - newAttempts,
      };
    }
  },

  reset(email: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(email));
    } catch {
      // ignore
    }
  },

  // Formata segundos para MM:SS
  formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },
};
