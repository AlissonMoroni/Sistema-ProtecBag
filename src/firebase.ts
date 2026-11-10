import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Must use firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Cria uma conta no Firebase Authentication SEM derrubar a sessão do administrador.
 * O SDK web troca o usuário logado ao criar uma conta, então usamos uma segunda
 * instância do app só para isso e saímos dela logo em seguida.
 */
export async function createAuthAccount(email: string, password: string): Promise<string> {
  const SECONDARY = 'protecbag-account-creator';
  const secondaryApp: FirebaseApp = getApps().some((a) => a.name === SECONDARY)
    ? getApp(SECONDARY)
    : initializeApp(firebaseConfig, SECONDARY);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
}

/** Traduz códigos de erro do Firebase para mensagens em português. */
export function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta de acesso com este e-mail.';
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.';
    case 'auth/operation-not-allowed':
      return 'O login por e-mail/senha não está ativado no Firebase Console.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Login cancelado.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Sem conexão com o servidor. Verifique sua internet.';
    case 'permission-denied':
      return 'Você não tem permissão para esta operação.';
    default:
      return err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.';
  }
}
