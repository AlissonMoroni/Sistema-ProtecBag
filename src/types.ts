export type UserRole = 'admin' | 'admin_franquia' | 'colaborador' | 'usuario_normal';

export type ShiftType = 'Manhã' | 'Tarde' | 'Noite';

export type BillingStatus = 'Pendente' | 'Aprovado' | 'Rejeitado';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  franchise: string; // "TODAS / Matriz" (Admin Geral), "CWB" (Base Curitiba), "REC" (Base Recife), or specific: "CWB01", "CWB02", "CWB03", "REC01", "REC02", "REC03"
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
