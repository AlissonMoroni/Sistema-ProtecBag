import { useSyncExternalStore } from 'react';
import { User, ShiftBilling, FranchiseInfo, ServiceProductItem } from './types';
import { db, createAuthAccount, friendlyFirebaseError } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Query,
  DocumentData,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Catálogo fixo
// ---------------------------------------------------------------------------

/** Dono do sistema: sempre Administrador Geral (precisa entrar com e-mail verificado). */
export const OWNER_EMAIL = 'thetoic@gmail.com';

export const FRANCHISES: FranchiseInfo[] = [
  { code: 'CWB01', name: 'Curitiba - Terminal Principal', airport: 'Afonso Pena (CWB)', city: 'Curitiba', state: 'PR' },
  { code: 'CWB02', name: 'Curitiba - Embarque Doméstico', airport: 'Afonso Pena (CWB)', city: 'Curitiba', state: 'PR' },
  { code: 'CWB03', name: 'Curitiba - Embarque Internacional', airport: 'Afonso Pena (CWB)', city: 'Curitiba', state: 'PR' },
  { code: 'REC01', name: 'Recife - Sagüão Principal', airport: 'Guararapes (REC)', city: 'Recife', state: 'PE' },
  { code: 'REC02', name: 'Recife - Embarque Sul', airport: 'Guararapes (REC)', city: 'Recife', state: 'PE' },
  { code: 'REC03', name: 'Recife - Embarque Norte', airport: 'Guararapes (REC)', city: 'Recife', state: 'PE' },
];

export const REGIONAL_BASES = [
  { code: 'CWB', name: 'Base Curitiba (CWB01, CWB02, CWB03)' },
  { code: 'REC', name: 'Base Recife (REC01, REC02, REC03)' },
];

export const DEFAULT_CATALOG: Omit<ServiceProductItem, 'quantity'>[] = [
  { id: 'prod_aerobag_mg', name: 'Aerobag M/G', unitPrice: 199.0 },
  { id: 'prod_aerobag_parceria', name: 'Aerobag Parceria', unitPrice: 179.0 },
  { id: 'prod_lacracao_basico', name: 'Lacração Básico Pequeno', unitPrice: 149.0 },
  { id: 'prod_lacre_especial', name: 'Lacre Especial', unitPrice: 298.0 },
  { id: 'prod_extra_grande', name: 'Extra Grande', unitPrice: 398.0 },
  { id: 'prod_tag_digital', name: 'Tag Digital', unitPrice: 60.0 },
];

// ---------------------------------------------------------------------------
// Permissões (espelham as regras do Firestore — a segurança real está lá)
// ---------------------------------------------------------------------------

/** "CWB01" -> "CWB"; "TODAS / Matriz" ou vazio -> "TODAS". */
export const regionOf = (franchise: string | undefined): string => {
  const f = (franchise || '').trim().toUpperCase();
  if (!f || f.startsWith('TODAS')) return 'TODAS';
  return f.substring(0, 3);
};

export const isGlobalAdmin = (u: User | null | undefined): boolean =>
  !!u && (u.role === 'admin' || u.email?.toLowerCase() === OWNER_EMAIL);

export const isAnyAdmin = (u: User | null | undefined): boolean =>
  !!u && (isGlobalAdmin(u) || u.role === 'admin_franquia');

// Helper to determine if an admin user can access a specific franchise code
export const canAdminAccessFranchise = (admin: User, franchiseCode: string): boolean => {
  if (isGlobalAdmin(admin)) return true;
  if (admin.role !== 'admin_franquia') return false;
  // Franquia vazia NÃO libera acesso (antes, ''.startsWith('') liberava tudo).
  if (!admin.franchise || !franchiseCode) return false;
  return franchiseCode === admin.franchise || regionOf(franchiseCode) === admin.franchise;
};

// Helper to get list of franchises an admin has authorization to manage/view
export const getAllowedFranchisesForAdmin = (admin: User): FranchiseInfo[] => {
  if (isGlobalAdmin(admin)) return FRANCHISES;
  return FRANCHISES.filter((f) => canAdminAccessFranchise(admin, f.code));
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Data local (não UTC) no formato YYYY-MM-DD. Evita "pular" para o dia seguinte após as 21h. */
export const todayLocalISO = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const newId = (prefix: string): string => {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${rand}`;
};

/** Senha temporária forte (sem caracteres ambíguos). */
export const generateTempPassword = (length = 12): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
};

/** Remove campos que nunca devem ir para o Firestore. */
const toUserDoc = (u: User): Omit<User, 'docId' | 'password'> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { docId, password, ...rest } = u;
  const clean: Record<string, unknown> = {};
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  return clean as Omit<User, 'docId' | 'password'>;
};

const stripUndefined = <T extends object>(obj: T): T =>
  JSON.parse(JSON.stringify(obj)) as T;

const sortBillings = (list: ShiftBilling[]) =>
  list.sort(
    (a, b) =>
      new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
  );

// ---------------------------------------------------------------------------
// Store em memória, alimentado em tempo real pelo Firestore
// ---------------------------------------------------------------------------

let users: User[] = [];
let billings: ShiftBilling[] = [];
let syncError: string | null = null;
let loaded = { users: false, billings: false };
let version = 0;
const listeners = new Set<() => void>();
let unsubs: Array<() => void> = [];

const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

const wrapWriteError = (err: unknown): never => {
  throw new Error(friendlyFirebaseError(err));
};

export const storage = {
  // ----- leitura (síncrona, do cache em memória) -----
  getUsers(): User[] {
    return users;
  },

  getBillings(): ShiftBilling[] {
    return billings;
  },

  getSyncError(): string | null {
    return syncError;
  },

  isLoaded(): boolean {
    return loaded.users && loaded.billings;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getVersion(): number {
    return version;
  },

  // ----- sincronização por perfil -----
  /**
   * Abre listeners do Firestore apenas com os dados que o perfil pode ver.
   * As consultas precisam bater com as regras, senão o Firestore recusa a lista inteira.
   */
  startSync(me: User): void {
    this.stopSync();
    loaded = { users: false, billings: false };

    const billingsCol = collection(db, 'billings');
    const usersCol = collection(db, 'users');
    let billingsQuery: Query<DocumentData> | null = null;
    let usersQuery: Query<DocumentData> | null = null;

    if (isGlobalAdmin(me)) {
      billingsQuery = billingsCol;
      usersQuery = usersCol;
    } else if (me.role === 'admin_franquia') {
      // Franquia "CWB" = base inteira (campo region); "CWB01" = só a unidade.
      const field = me.franchise.length <= 3 ? 'region' : 'franchise';
      billingsQuery = query(billingsCol, where(field, '==', me.franchise));
      usersQuery = query(usersCol, where(field, '==', me.franchise));
    } else if (me.role === 'colaborador') {
      billingsQuery = query(billingsCol, where('collaboratorId', '==', me.id));
    } else {
      billingsQuery = query(billingsCol, where('franchise', '==', me.franchise));
    }

    const onError = (what: string) => (error: unknown) => {
      console.error(`Erro ao sincronizar ${what}:`, error);
      syncError = `Não foi possível carregar ${what}: ${friendlyFirebaseError(error)}`;
      notify();
    };

    unsubs.push(
      onSnapshot(
        billingsQuery,
        (snap) => {
          const list: ShiftBilling[] = [];
          snap.forEach((d) => list.push({ ...(d.data() as ShiftBilling), id: d.id }));
          billings = sortBillings(list);
          loaded.billings = true;
          syncError = null;
          notify();
        },
        onError('os faturamentos')
      )
    );

    if (usersQuery) {
      unsubs.push(
        onSnapshot(
          usersQuery,
          (snap) => {
            const list: User[] = [];
            snap.forEach((d) => list.push({ ...(d.data() as User), docId: d.id }));
            list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            users = list;
            loaded.users = true;
            notify();
          },
          onError('os usuários')
        )
      );
    } else {
      users = [me];
      loaded.users = true;
    }
    notify();
  },

  stopSync(): void {
    unsubs.forEach((u) => u());
    unsubs = [];
    users = [];
    billings = [];
    syncError = null;
    loaded = { users: false, billings: false };
    notify();
  },

  // ----- faturamentos -----
  async saveBilling(billing: ShiftBilling): Promise<void> {
    const data: ShiftBilling = stripUndefined({
      ...billing,
      region: regionOf(billing.franchise),
    });
    try {
      await setDoc(doc(db, 'billings', data.id), data);
    } catch (err) {
      wrapWriteError(err);
    }
  },

  async updateBilling(updated: ShiftBilling): Promise<void> {
    await this.saveBilling(updated);
  },

  async deleteBilling(billingId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'billings', billingId));
    } catch (err) {
      wrapWriteError(err);
    }
  },

  /** Lê o perfil de quem acabou de logar (documento /users/{email} ou por campo de e-mail). */
  async fetchOwnProfile(email: string): Promise<User | null> {
    const key = email.trim().toLowerCase();
    try {
      const snap = await getDoc(doc(db, 'users', key));
      if (snap.exists()) {
        return { ...(snap.data() as User), docId: snap.id };
      }
    } catch (e) {
      console.warn('Erro ao buscar perfil por chave direta:', e);
    }

    try {
      const q = query(collection(db, 'users'), where('email', '==', key));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const d = qSnap.docs[0];
        return { ...(d.data() as User), docId: d.id };
      }
    } catch (e) {
      console.warn('Erro ao buscar perfil por query:', e);
    }
    return null;
  },

  /** Escuta mudanças no próprio perfil (desativação, troca de papel). */
  watchOwnProfile(email: string, onChange: (u: User | null) => void): () => void {
    const key = email.trim().toLowerCase();
    return onSnapshot(
      doc(db, 'users', key),
      (snap) => onChange(snap.exists() ? { ...(snap.data() as User), docId: snap.id } : null),
      (err) => console.error('Erro ao observar perfil:', err)
    );
  },

  /** Grava (cria ou atualiza) um perfil já vinculado a uma conta do Firebase Auth. */
  async saveUserProfile(user: User): Promise<void> {
    const email = user.email.trim().toLowerCase();
    const data = toUserDoc({
      ...user,
      email,
      region: regionOf(user.franchise),
      active: user.active !== false,
      updatedAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'users', email), data);
    } catch (err) {
      wrapWriteError(err);
    }
  },

  /**
   * Cria a conta de acesso (Firebase Auth) e o perfil no Firestore.
   * A senha vai somente para o Firebase Auth — nunca para o banco.
   */
  async createUserWithAccess(user: User, password: string): Promise<User> {
    const email = user.email.trim().toLowerCase();
    let authUid: string;
    try {
      authUid = await createAuthAccount(email, password);
    } catch (err) {
      throw new Error(friendlyFirebaseError(err));
    }
    const profile: User = { ...user, email, authUid };
    await this.saveUserProfile(profile);
    return profile;
  },

  /** Apaga o perfil. A conta no Firebase Auth fica sem acesso a nada (pode ser removida no Console). */
  async deleteUser(user: User): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', user.docId || user.email.toLowerCase()));
    } catch (err) {
      wrapWriteError(err);
    }
  },

  // ----- migração do formato antigo -----
  /** Perfis antigos: ID "usr_..." em vez do e-mail, sem conta no Auth, possivelmente com senha em texto puro. */
  getLegacyUsers(): User[] {
    return users.filter(
      (u) => !u.authUid || (u.docId && u.docId !== u.email?.toLowerCase()) || 'password' in u
    );
  },

  getBillingsMissingRegion(): ShiftBilling[] {
    return billings.filter((b) => !b.region);
  },

  /**
   * Converte usuários antigos: cria a conta no Firebase Auth com senha temporária,
   * grava o perfil novo em /users/{email} (sem senha) e apaga o documento antigo.
   * Também preenche o campo "region" dos faturamentos antigos.
   */
  async migrateLegacyData(): Promise<{
    users: Array<{ name: string; email: string; tempPassword?: string; status: 'ok' | 'erro'; message?: string }>;
    billingsUpdated: number;
    billingsFailed: number;
  }> {
    const results: Array<{ name: string; email: string; tempPassword?: string; status: 'ok' | 'erro'; message?: string }> = [];

    for (const legacy of this.getLegacyUsers()) {
      const email = (legacy.email || '').trim().toLowerCase();
      if (!email) {
        results.push({ name: legacy.name, email: '(sem e-mail)', status: 'erro', message: 'Perfil sem e-mail.' });
        continue;
      }
      try {
        let authUid = legacy.authUid;
        let tempPassword: string | undefined;
        if (!authUid) {
          tempPassword = generateTempPassword();
          authUid = await createAuthAccount(email, tempPassword);
        }
        await this.saveUserProfile({
          ...legacy,
          email,
          authUid,
          franchise: legacy.role === 'admin' ? 'TODAS / Matriz' : legacy.franchise,
        });
        if (legacy.docId && legacy.docId !== email) {
          await deleteDoc(doc(db, 'users', legacy.docId));
        }
        results.push({ name: legacy.name, email, tempPassword, status: 'ok' });
      } catch (err) {
        const code = (err as { code?: string })?.code;
        results.push({
          name: legacy.name,
          email,
          status: 'erro',
          message:
            code === 'auth/email-already-in-use'
              ? 'Já existe conta no Firebase Auth com este e-mail. Apague-a no Firebase Console (Authentication > Users) e rode a migração de novo.'
              : friendlyFirebaseError(err),
        });
      }
    }

    let billingsUpdated = 0;
    let billingsFailed = 0;
    for (const b of this.getBillingsMissingRegion()) {
      try {
        await updateDoc(doc(db, 'billings', b.id), { region: regionOf(b.franchise) });
        billingsUpdated += 1;
      } catch (err) {
        console.error('Falha ao atualizar faturamento', b.id, err);
        billingsFailed += 1;
      }
    }

    return { users: results, billingsUpdated, billingsFailed };
  },
};

/** Hook React: re-renderiza o componente sempre que os dados do Firestore mudam. */
export const useStoreVersion = (): number =>
  useSyncExternalStore(storage.subscribe.bind(storage), storage.getVersion.bind(storage));

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const formatMonthBR = (monthStr: string): string => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(month, 10) - 1;
  return `${monthNames[idx] || month} de ${year}`;
};

/** Célula de CSV segura: escapa aspas e neutraliza fórmulas (=, +, -, @) no Excel. */
export const csvCell = (value: unknown): string => {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
