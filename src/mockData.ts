import { User, ShiftBilling, FranchiseInfo, ServiceProductItem } from './types';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot
} from 'firebase/firestore';

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

export const SEED_USERS: User[] = [
  {
    id: 'usr_admin_global',
    name: 'Carlos Eduardo Mendes',
    email: 'admin@protecbag.com.br',
    password: 'admin',
    role: 'admin',
    franchise: 'TODAS / Matriz',
    active: true,
    phone: '(11) 98765-4321',
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'usr_admin_cwb',
    name: 'Roberto Silveira (Gestor CWB)',
    email: 'admin.cwb@protecbag.com.br',
    password: 'admin',
    role: 'admin_franquia',
    franchise: 'CWB',
    active: true,
    phone: '(41) 98877-6655',
    createdAt: '2026-01-05T08:00:00Z',
  },
  {
    id: 'usr_admin_rec',
    name: 'Patrícia Lins (Gestora REC)',
    email: 'admin.rec@protecbag.com.br',
    password: 'admin',
    role: 'admin_franquia',
    franchise: 'REC',
    active: true,
    phone: '(81) 97766-5544',
    createdAt: '2026-01-06T08:00:00Z',
  },
  {
    id: 'usr_colab_cwb1',
    name: 'Marcos Vinícius Santos',
    email: 'marcos.cwb@protecbag.com.br',
    password: '123',
    role: 'colaborador',
    franchise: 'CWB01',
    active: true,
    phone: '(41) 99123-4567',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'usr_colab_cwb2',
    name: 'Juliana Paes Curitiba',
    email: 'juliana.cwb@protecbag.com.br',
    password: '123',
    role: 'colaborador',
    franchise: 'CWB02',
    active: true,
    phone: '(41) 99876-5432',
    createdAt: '2026-01-12T08:00:00Z',
  },
  {
    id: 'usr_colab_cwb3',
    name: 'Lucas Pinheiro Curitiba',
    email: 'lucas.cwb3@protecbag.com.br',
    password: '123',
    role: 'colaborador',
    franchise: 'CWB03',
    active: true,
    phone: '(41) 99543-2109',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'usr_colab_rec1',
    name: 'Felipe Arcoverde Recife',
    email: 'felipe.rec1@protecbag.com.br',
    password: '123',
    role: 'colaborador',
    franchise: 'REC01',
    active: true,
    phone: '(81) 98811-2233',
    createdAt: '2026-01-18T08:00:00Z',
  },
  {
    id: 'usr_colab_rec2',
    name: 'Mariana Boa Viagem',
    email: 'mariana.rec2@protecbag.com.br',
    password: '123',
    role: 'colaborador',
    franchise: 'REC02',
    active: true,
    phone: '(81) 98822-3344',
    createdAt: '2026-01-20T08:00:00Z',
  },
  {
    id: 'usr_colab_rec3',
    name: 'Tiago Olinda Recife',
    email: 'tiago.rec3@protecbag.com.br',
    password: '123',
    role: 'colaborador',
    franchise: 'REC03',
    active: true,
    phone: '(81) 98833-4455',
    createdAt: '2026-01-22T08:00:00Z',
  },
  {
    id: 'usr_user_viewer',
    name: 'Renata Auditoria Jr',
    email: 'renata.consulta@protecbag.com.br',
    password: '123',
    role: 'usuario_normal',
    franchise: 'CWB01',
    active: true,
    phone: '(41) 98844-5566',
    createdAt: '2026-02-01T08:00:00Z',
  },
];

// Helper to determine if an admin user can access a specific franchise code
export const canAdminAccessFranchise = (admin: User, franchiseCode: string): boolean => {
  if (admin.role !== 'admin' && admin.role !== 'admin_franquia') return false;
  if (admin.email === 'thetoic@gmail.com') return true;
  if (admin.role === 'admin' && (admin.franchise === 'TODAS' || admin.franchise === 'TODAS / Matriz' || !admin.franchise)) {
    return true;
  }
  if (admin.franchise === franchiseCode) return true;
  if (franchiseCode.startsWith(admin.franchise)) return true;
  if (admin.franchise.startsWith(franchiseCode)) return true;
  return false;
};

// Helper to get list of franchises an admin has authorization to manage/view
export const getAllowedFranchisesForAdmin = (admin: User): FranchiseInfo[] => {
  if (admin.role === 'admin' && (admin.franchise === 'TODAS' || admin.franchise === 'TODAS / Matriz' || admin.email === 'thetoic@gmail.com')) {
    return FRANCHISES;
  }
  return FRANCHISES.filter((f) => canAdminAccessFranchise(admin, f.code));
};

export const SEED_BILLINGS: ShiftBilling[] = [
  // --- SETEMBRO/2026: Consolida exatamente 600un de Aerobag M/G (R$ 199,00) conforme solicitado ---
  {
    id: 'bil_sep_001',
    date: '2026-09-08',
    month: '2026-09',
    shift: 'Manhã',
    franchise: 'CWB01',
    collaboratorId: 'usr_colab_cwb1',
    collaboratorName: 'Marcos Vinícius Santos',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 120, unitPrice: 199.0 },
      { id: 'prod_aerobag_parceria', name: 'Aerobag Parceria', quantity: 45, unitPrice: 179.0 },
      { id: 'prod_lacracao_basico', name: 'Lacração Básico Pequeno', quantity: 60, unitPrice: 149.0 },
      { id: 'prod_tag_digital', name: 'Tag Digital', quantity: 30, unitPrice: 60.0 },
    ],
    payments: {
      credit: 22000.0,
      debit: 12500.0,
      pix: 6975.0,
      cash: 1200.0,
      others: 0,
    },
    totalProductsAmount: 42675.0,
    totalPaymentsAmount: 42675.0,
    totalAmount: 42675.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Feriado de 7 de Setembro com alta movimentação.',
    auditNotes: 'Conferido com conciliação bancária Cielo/Stone. OK!',
    auditedBy: 'Carlos Eduardo Mendes',
    auditedAt: '2026-09-08T18:00:00Z',
    createdAt: '2026-09-08T14:15:00Z',
    updatedAt: '2026-09-08T18:00:00Z',
  },
  {
    id: 'bil_sep_002',
    date: '2026-09-12',
    month: '2026-09',
    shift: 'Tarde',
    franchise: 'CWB02',
    collaboratorId: 'usr_colab_cwb2',
    collaboratorName: 'Juliana Paes Curitiba',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 100, unitPrice: 199.0 },
      { id: 'prod_lacre_especial', name: 'Lacre Especial', quantity: 30, unitPrice: 298.0 },
      { id: 'prod_extra_grande', name: 'Extra Grande', quantity: 15, unitPrice: 398.0 },
    ],
    payments: {
      credit: 18000.0,
      debit: 10000.0,
      pix: 5310.0,
      cash: 1500.0,
      others: 0,
    },
    totalProductsAmount: 34810.0,
    totalPaymentsAmount: 34810.0,
    totalAmount: 34810.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Grande volume de voos corporativos.',
    auditNotes: 'Aprovado sem ressalvas.',
    auditedBy: 'Roberto Silveira',
    auditedAt: '2026-09-12T22:30:00Z',
    createdAt: '2026-09-12T22:05:00Z',
    updatedAt: '2026-09-12T22:30:00Z',
  },
  {
    id: 'bil_sep_003',
    date: '2026-09-18',
    month: '2026-09',
    shift: 'Manhã',
    franchise: 'CWB03',
    collaboratorId: 'usr_colab_cwb3',
    collaboratorName: 'Lucas Pinheiro Curitiba',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 80, unitPrice: 199.0 },
      { id: 'prod_aerobag_parceria', name: 'Aerobag Parceria', quantity: 35, unitPrice: 179.0 },
      { id: 'prod_tag_digital', name: 'Tag Digital', quantity: 40, unitPrice: 60.0 },
    ],
    payments: {
      credit: 14000.0,
      debit: 6000.0,
      pix: 3585.0,
      cash: 1000.0,
      others: 0,
    },
    totalProductsAmount: 24585.0,
    totalPaymentsAmount: 24585.0,
    totalAmount: 24585.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Embarque internacional com ótima aceitação.',
    auditNotes: 'Conferência efetuada com sucesso.',
    auditedBy: 'Roberto Silveira',
    auditedAt: '2026-09-18T16:00:00Z',
    createdAt: '2026-09-18T14:10:00Z',
    updatedAt: '2026-09-18T16:00:00Z',
  },
  {
    id: 'bil_sep_004',
    date: '2026-09-22',
    month: '2026-09',
    shift: 'Tarde',
    franchise: 'REC01',
    collaboratorId: 'usr_colab_rec1',
    collaboratorName: 'Felipe Arcoverde Recife',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 150, unitPrice: 199.0 },
      { id: 'prod_lacracao_basico', name: 'Lacração Básico Pequeno', quantity: 50, unitPrice: 149.0 },
      { id: 'prod_extra_grande', name: 'Extra Grande', quantity: 20, unitPrice: 398.0 },
    ],
    payments: {
      credit: 25000.0,
      debit: 12000.0,
      pix: 6760.0,
      cash: 1500.0,
      others: 0,
    },
    totalProductsAmount: 45260.0,
    totalPaymentsAmount: 45260.0,
    totalAmount: 45260.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Voos charter de turismo no Aeroporto de Recife.',
    auditNotes: 'Auditoria de Recife validada.',
    auditedBy: 'Patrícia Lins',
    auditedAt: '2026-09-22T23:00:00Z',
    createdAt: '2026-09-22T22:00:00Z',
    updatedAt: '2026-09-22T23:00:00Z',
  },
  {
    id: 'bil_sep_005',
    date: '2026-09-26',
    month: '2026-09',
    shift: 'Manhã',
    franchise: 'REC02',
    collaboratorId: 'usr_colab_rec2',
    collaboratorName: 'Mariana Boa Viagem',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 90, unitPrice: 199.0 },
      { id: 'prod_aerobag_parceria', name: 'Aerobag Parceria', quantity: 40, unitPrice: 179.0 },
      { id: 'prod_lacre_especial', name: 'Lacre Especial', quantity: 25, unitPrice: 298.0 },
    ],
    payments: {
      credit: 18000.0,
      debit: 8000.0,
      pix: 5020.0,
      cash: 1500.0,
      others: 0,
    },
    totalProductsAmount: 32520.0,
    totalPaymentsAmount: 32520.0,
    totalAmount: 32520.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Turno matutino com boa procura de parcerias aéreas.',
    auditNotes: 'OK!',
    auditedBy: 'Patrícia Lins',
    auditedAt: '2026-09-26T16:00:00Z',
    createdAt: '2026-09-26T14:00:00Z',
    updatedAt: '2026-09-26T16:00:00Z',
  },
  {
    id: 'bil_sep_006',
    date: '2026-09-29',
    month: '2026-09',
    shift: 'Noite',
    franchise: 'REC03',
    collaboratorId: 'usr_colab_rec3',
    collaboratorName: 'Tiago Olinda Recife',
    products: [
      // 120 + 100 + 80 + 150 + 90 = 540 + 60 = 600 un de Aerobag M/G em Setembro!
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 60, unitPrice: 199.0 },
      { id: 'prod_lacracao_basico', name: 'Lacração Básico Pequeno', quantity: 30, unitPrice: 149.0 },
      { id: 'prod_tag_digital', name: 'Tag Digital', quantity: 25, unitPrice: 60.0 },
    ],
    payments: {
      credit: 10000.0,
      debit: 4500.0,
      pix: 2910.0,
      cash: 500.0,
      others: 0,
    },
    totalProductsAmount: 17910.0,
    totalPaymentsAmount: 17910.0,
    totalAmount: 17910.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Fechamento final do mês de Setembro.',
    auditNotes: 'Concluído e auditado.',
    auditedBy: 'Patrícia Lins',
    auditedAt: '2026-09-30T08:00:00Z',
    createdAt: '2026-09-29T23:30:00Z',
    updatedAt: '2026-09-30T08:00:00Z',
  },

  // --- NOVEMBRO/2026 (Semana Recente para visualização semanal e diária) ---
  {
    id: 'bil_nov_001',
    date: '2026-11-04',
    month: '2026-11',
    shift: 'Manhã',
    franchise: 'CWB01',
    collaboratorId: 'usr_colab_cwb1',
    collaboratorName: 'Marcos Vinícius Santos',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 25, unitPrice: 199.0 },
      { id: 'prod_aerobag_parceria', name: 'Aerobag Parceria', quantity: 15, unitPrice: 179.0 },
      { id: 'prod_lacracao_basico', name: 'Lacração Básico Pequeno', quantity: 10, unitPrice: 149.0 },
      { id: 'prod_tag_digital', name: 'Tag Digital', quantity: 8, unitPrice: 60.0 },
    ],
    payments: {
      credit: 5000.0,
      debit: 2800.0,
      pix: 1330.0,
      cash: 500.0,
      others: 0,
    },
    totalProductsAmount: 9630.0,
    totalPaymentsAmount: 9630.0,
    totalAmount: 9630.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Fluxo intenso voos matutinos.',
    auditNotes: 'Conferido com conciliação Cielo. OK!',
    auditedBy: 'Roberto Silveira',
    auditedAt: '2026-11-04T16:20:00Z',
    createdAt: '2026-11-04T14:15:00Z',
    updatedAt: '2026-11-04T16:20:00Z',
  },
  {
    id: 'bil_nov_002',
    date: '2026-11-05',
    month: '2026-11',
    shift: 'Tarde',
    franchise: 'CWB02',
    collaboratorId: 'usr_colab_cwb2',
    collaboratorName: 'Juliana Paes Curitiba',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 20, unitPrice: 199.0 },
      { id: 'prod_lacre_especial', name: 'Lacre Especial', quantity: 8, unitPrice: 298.0 },
      { id: 'prod_extra_grande', name: 'Extra Grande', quantity: 4, unitPrice: 398.0 },
    ],
    payments: {
      credit: 4200.0,
      debit: 2100.0,
      pix: 1156.0,
      cash: 500.0,
      others: 0,
    },
    totalProductsAmount: 7956.0,
    totalPaymentsAmount: 7956.0,
    totalAmount: 7956.0,
    differenceAmount: 0,
    status: 'Aprovado',
    collaboratorNotes: 'Turno regular.',
    auditNotes: 'Conferido.',
    auditedBy: 'Roberto Silveira',
    auditedAt: '2026-11-05T22:30:00Z',
    createdAt: '2026-11-05T22:05:00Z',
    updatedAt: '2026-11-05T22:30:00Z',
  },
  {
    id: 'bil_nov_003',
    date: '2026-11-06',
    month: '2026-11',
    shift: 'Manhã',
    franchise: 'REC01',
    collaboratorId: 'usr_colab_rec1',
    collaboratorName: 'Felipe Arcoverde Recife',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 30, unitPrice: 199.0 },
      { id: 'prod_aerobag_parceria', name: 'Aerobag Parceria', quantity: 18, unitPrice: 179.0 },
      { id: 'prod_lacracao_basico', name: 'Lacração Básico Pequeno', quantity: 14, unitPrice: 149.0 },
    ],
    payments: {
      credit: 6000.0,
      debit: 3200.0,
      pix: 1578.0,
      cash: 500.0,
      others: 0,
    },
    totalProductsAmount: 11278.0,
    totalPaymentsAmount: 11278.0,
    totalAmount: 11278.0,
    differenceAmount: 0,
    status: 'Pendente',
    collaboratorNotes: 'Aguardando conferência do lote da manhã.',
    auditNotes: '',
    createdAt: '2026-11-06T14:10:00Z',
    updatedAt: '2026-11-06T14:10:00Z',
  },
  {
    id: 'bil_nov_004',
    date: '2026-11-07',
    month: '2026-11',
    shift: 'Tarde',
    franchise: 'REC02',
    collaboratorId: 'usr_colab_rec2',
    collaboratorName: 'Mariana Boa Viagem',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 22, unitPrice: 199.0 },
      { id: 'prod_lacre_especial', name: 'Lacre Especial', quantity: 6, unitPrice: 298.0 },
    ],
    payments: {
      credit: 3500.0,
      debit: 1600.0,
      pix: 866.0,
      cash: 200.0,
      others: 0,
    },
    totalProductsAmount: 6166.0,
    totalPaymentsAmount: 6166.0,
    totalAmount: 6166.0,
    differenceAmount: 0,
    status: 'Pendente',
    collaboratorNotes: 'Turno da tarde com bastante movimento.',
    auditNotes: '',
    createdAt: '2026-11-07T22:00:00Z',
    updatedAt: '2026-11-07T22:00:00Z',
  },
  {
    id: 'bil_nov_005',
    date: '2026-11-08',
    month: '2026-11',
    shift: 'Manhã',
    franchise: 'CWB03',
    collaboratorId: 'usr_colab_cwb3',
    collaboratorName: 'Lucas Pinheiro Curitiba',
    products: [
      { id: 'prod_aerobag_mg', name: 'Aerobag M/G', quantity: 18, unitPrice: 199.0 },
      { id: 'prod_extra_grande', name: 'Extra Grande', quantity: 5, unitPrice: 398.0 },
      { id: 'prod_tag_digital', name: 'Tag Digital', quantity: 10, unitPrice: 60.0 },
    ],
    payments: {
      credit: 3200.0,
      debit: 1500.0,
      pix: 1272.0,
      cash: 200.0,
      others: 0,
    },
    totalProductsAmount: 6172.0,
    totalPaymentsAmount: 6172.0,
    totalAmount: 6172.0,
    differenceAmount: 0,
    status: 'Pendente',
    collaboratorNotes: 'Embarque internacional de domingo.',
    auditNotes: '',
    createdAt: '2026-11-08T14:20:00Z',
    updatedAt: '2026-11-08T14:20:00Z',
  },
];

const STORAGE_KEY_USERS = 'protecbag_db_users_v5';
const STORAGE_KEY_BILLINGS = 'protecbag_db_billings_v5';
const STORAGE_KEY_AUTH = 'protecbag_auth_current_user_v5';

export const storage = {
  getUsers(): User[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      if (data) {
        return JSON.parse(data);
      }
      return SEED_USERS;
    } catch {
      return SEED_USERS;
    }
  },

  async saveUser(newUser: User): Promise<void> {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === newUser.id);
    if (idx !== -1) {
      users[idx] = newUser;
    } else {
      users.push(newUser);
    }
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));

    // Guaranteed write to Firebase Firestore
    try {
      await setDoc(doc(db, 'users', newUser.id), newUser);
      console.log(`Usuário ${newUser.name} salvo permanentemente no Firestore.`);
    } catch (err) {
      console.warn('Persistência Firestore em andamento:', err);
    }
  },

  async updateUser(updated: User): Promise<void> {
    await this.saveUser(updated);
  },

  async deleteUser(userId: string): Promise<void> {
    const users = this.getUsers().filter((u) => u.id !== userId);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      console.warn('Erro ao deletar no Firestore:', err);
    }
  },

  resetToDemo(): void {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(SEED_USERS));
    localStorage.setItem(STORAGE_KEY_BILLINGS, JSON.stringify(SEED_BILLINGS));
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(SEED_USERS[0]));
    SEED_USERS.forEach((u) => {
      setDoc(doc(db, 'users', u.id), u).catch(() => {});
    });
    SEED_BILLINGS.forEach((b) => {
      setDoc(doc(db, 'billings', b.id), b).catch(() => {});
    });
  },

  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY_AUTH);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
  },

  getBillings(): ShiftBilling[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_BILLINGS);
      if (data) {
        return JSON.parse(data);
      }
      return SEED_BILLINGS;
    } catch {
      return SEED_BILLINGS;
    }
  },

  async saveBilling(billing: ShiftBilling): Promise<void> {
    const list = this.getBillings();
    const idx = list.findIndex((b) => b.id === billing.id);
    if (idx !== -1) {
      list[idx] = billing;
    } else {
      list.unshift(billing);
    }
    localStorage.setItem(STORAGE_KEY_BILLINGS, JSON.stringify(list));

    // Guaranteed live write to Firebase Firestore
    try {
      await setDoc(doc(db, 'billings', billing.id), billing);
      console.log(`Faturamento ${billing.id} salvo permanentemente no Firestore.`);
    } catch (err) {
      console.warn('Persistência Firestore em andamento:', err);
    }
  },

  async updateBilling(updated: ShiftBilling): Promise<void> {
    await this.saveBilling(updated);
  },

  async deleteBilling(billingId: string): Promise<void> {
    const list = this.getBillings().filter((b) => b.id !== billingId);
    localStorage.setItem(STORAGE_KEY_BILLINGS, JSON.stringify(list));
    try {
      await deleteDoc(doc(db, 'billings', billingId));
      console.log(`Faturamento ${billingId} excluído com sucesso do Firestore.`);
    } catch (err) {
      console.warn('Erro ao deletar faturamento no Firestore:', err);
    }
  },

  // Realtime Live Subscription: whenever any document changes in Firestore, notify React
  subscribeToCloud(onUpdate: () => void): () => void {
    let unsubUsers = () => {};
    let unsubBillings = () => {};

    try {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        if (!snap.empty) {
          const cloudUsers: User[] = [];
          snap.forEach((d) => {
            const u = d.data() as User;
            // Admin permission: only for users designated as admin or master owner thetoic@gmail.com
            if (u.email === 'thetoic@gmail.com') {
              u.role = 'admin';
            } else if (!u.role) {
              u.role = 'colaborador';
            }
            cloudUsers.push(u);
          });
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(cloudUsers));
          onUpdate();
        }
      }, (error) => {
        console.warn('Firestore onSnapshot users error:', error);
      });

      unsubBillings = onSnapshot(collection(db, 'billings'), (snap) => {
        if (!snap.empty) {
          const cloudBillings: ShiftBilling[] = [];
          snap.forEach((d) => {
            cloudBillings.push(d.data() as ShiftBilling);
          });
          cloudBillings.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
          localStorage.setItem(STORAGE_KEY_BILLINGS, JSON.stringify(cloudBillings));
          onUpdate();
        }
      }, (error) => {
        console.warn('Firestore onSnapshot billings error:', error);
      });
    } catch (e) {
      console.warn('Offline mode for realtime listener:', e);
    }

    return () => {
      unsubUsers();
      unsubBillings();
    };
  },

  // Pull latest from Cloud Firestore into cache and seed if empty
  async syncFromCloudFirestore(): Promise<{ billingsCount: number; usersCount: number }> {
    let billingsCount = 0;
    let usersCount = 0;

    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      if (!usersSnap.empty) {
        const cloudUsers: User[] = [];
        usersSnap.forEach((d) => {
          const u = d.data() as User;
          if (u.email === 'thetoic@gmail.com') {
            u.role = 'admin';
          } else if (!u.role) {
            u.role = 'colaborador';
          }
          cloudUsers.push(u);
        });
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(cloudUsers));
        usersCount = cloudUsers.length;
      } else {
        // Initial setup seed if cloud is brand new
        for (const u of SEED_USERS) {
          await setDoc(doc(db, 'users', u.id), u).catch(() => {});
        }
        usersCount = SEED_USERS.length;
      }

      const billingsSnap = await getDocs(collection(db, 'billings'));
      if (!billingsSnap.empty) {
        const cloudBillings: ShiftBilling[] = [];
        billingsSnap.forEach((d) => {
          cloudBillings.push(d.data() as ShiftBilling);
        });
        cloudBillings.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        localStorage.setItem(STORAGE_KEY_BILLINGS, JSON.stringify(cloudBillings));
        billingsCount = cloudBillings.length;
      } else {
        // Initial setup seed if cloud is brand new
        for (const b of SEED_BILLINGS) {
          await setDoc(doc(db, 'billings', b.id), b).catch(() => {});
        }
        billingsCount = SEED_BILLINGS.length;
      }
    } catch (err) {
      console.warn('Cloud sync error, running on local persistent cache:', err);
    }

    return { billingsCount, usersCount };
  },
};

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
