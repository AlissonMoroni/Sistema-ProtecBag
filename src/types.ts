export type UserRole = 'admin' | 'admin_franquia' | 'colaborador' | 'usuario_normal';

export type ShiftType = 'Manhã' | 'Tarde' | 'Noite';

export type BillingStatus = 'Pendente' | 'Aprovado' | 'Rejeitado';

export interface User {
  id: string;
  name: string;
  email: string; // sempre em minúsculas; também é o ID do documento em /users
  role: UserRole;
  franchise: string; // "TODAS / Matriz" (Admin Geral), "CWB" (Base Curitiba), "REC" (Base Recife), or specific: "CWB01", "CWB02", "CWB03", "REC01", "REC02", "REC03"
  region?: string; // "TODAS", "CWB" ou "REC" — usado pelas regras do Firestore para isolar franquias
  authUid?: string; // UID da conta no Firebase Authentication vinculada a este perfil
  /** @deprecated Só existe em documentos antigos (antes da migração). Nunca gravar. */
  password?: string;
  /** Só em memória: ID real do documento no Firestore (difere do e-mail em perfis antigos). */
  docId?: string;
  active?: boolean;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServiceProductItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentMethods {
  credit: number;
  debit: number;
  cash: number;
  pix: number;
  others?: number;
}

export interface ShiftBilling {
  id: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM for monthly consolidation
  shift: ShiftType;
  franchise: string; // Locked to user's franchise for colaborador
  region?: string; // "CWB" ou "REC" — derivado da franquia, usado pelas regras do Firestore
  collaboratorId: string;
  collaboratorName: string;
  products: ServiceProductItem[];
  payments: PaymentMethods;
  totalProductsAmount: number;
  totalPaymentsAmount: number;
  manualProductsAmount?: number; // Optional direct total of products without quantity breakdown
  totalAmount: number; // Final registered amount
  differenceAmount: number; // totalPayments - totalProducts
  status: BillingStatus;
  collaboratorNotes?: string;
  auditNotes?: string;
  auditedBy?: string;
  auditedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FranchiseInfo {
  code: string;
  name: string;
  airport: string;
  city: string;
  state: string;
}
