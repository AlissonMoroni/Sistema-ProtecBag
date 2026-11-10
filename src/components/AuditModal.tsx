import React, { useState, useMemo } from 'react';
import { ShiftBilling, BillingStatus, ServiceProductItem } from '../types';
import { formatCurrency, formatDateBR, FRANCHISES, storage } from '../store';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Building2, 
  Calendar, 
  User as UserIcon,
  Save,
  MessageSquare,
  FileEdit,
  Trash2
} from 'lucide-react';

interface AuditModalProps {
  billing: ShiftBilling;
  onClose: () => void;
  onSave: (updated: ShiftBilling) => void;
  /** Abre a confirmação de exclusão (não exclui direto). */
  onRequestDelete: (billing: ShiftBilling) => void;
  adminName: string;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  billing,
  onClose,
  onSave,
  onRequestDelete,
  adminName,
}) => {
  const [saving, setSaving] = useState<boolean>(false);

  // Local state for editing
  const [status, setStatus] = useState<BillingStatus>(billing.status);
  const [auditNotes, setAuditNotes] = useState<string>(billing.auditNotes || '');
  
  // Editable payment amounts
  const [credit, setCredit] = useState<number>(billing.payments.credit);
  const [debit, setDebit] = useState<number>(billing.payments.debit);
  const [cash, setCash] = useState<number>(billing.payments.cash);
  const [pix, setPix] = useState<number>(billing.payments.pix);
  const [others, setOthers] = useState<number>(billing.payments.others || 0);

  // Editable products
  const [products, setProducts] = useState<ServiceProductItem[]>(
    JSON.parse(JSON.stringify(billing.products))
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Re-calculate totals
  const totalProducts = useMemo(() => {
    return products.reduce((acc, p) => acc + p.quantity * p.unitPrice, 0);
  }, [products]);

  const totalPayments = useMemo(() => {
    return credit + debit + cash + pix + others;
  }, [credit, debit, cash, pix, others]);

  const difference = useMemo(() => {
    return Number((totalPayments - totalProducts).toFixed(2));
  }, [totalPayments, totalProducts]);

  const franchiseInfo = useMemo(() => {
    return FRANCHISES.find((f) => f.code === billing.franchise);
  }, [billing.franchise]);

  const handleProductQuantityChange = (id: string, newQty: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: Math.max(0, newQty) } : p))
    );
  };

  const handleProductPriceChange = (id: string, newPrice: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, unitPrice: Math.max(0, newPrice) } : p))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (status === 'Rejeitado' && !auditNotes.trim()) {
      setErrorMessage('Para rejeitar o faturamento, é obrigatório inserir uma justificativa no parecer da auditoria.');
      return;
    }

    const updatedBilling: ShiftBilling = {
      ...billing,
      status,
      products,
      payments: {
        credit,
        debit,
        cash,
        pix,
        others,
      },
      totalProductsAmount: totalProducts,
      totalPaymentsAmount: totalPayments,
      totalAmount: totalPayments > 0 ? totalPayments : totalProducts,
      differenceAmount: difference,
      auditNotes: auditNotes.trim(),
      auditedBy: adminName,
      auditedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await storage.updateBilling(updatedBilling);
      onSave(updatedBilling);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao salvar a auditoria.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Auditoria de Fechamento de Turno
                <span className="text-xs font-mono text-slate-400 font-normal">#{billing.id}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Revise os valores lançados, ajuste divergências e emita o parecer oficial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shift Details Summary */}
        <div className="p-5 bg-slate-850 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-sky-400" /> Franquia
            </span>
            <span className="font-bold text-white font-mono text-sm">{billing.franchise}</span>
            <div className="text-[10px] text-slate-400 truncate">{franchiseInfo?.airport || 'Unidade Aeroporto'}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" /> Data & Turno
            </span>
            <span className="font-bold text-white text-sm">{formatDateBR(billing.date)}</span>
            <div className="text-[10px] text-sky-400 font-semibold">Turno {billing.shift}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5 text-sky-400" /> Colaborador
            </span>
            <span className="font-bold text-white text-sm truncate block">{billing.collaboratorName}</span>
            <div className="text-[10px] text-slate-400">Operador do Turno</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Status Atual</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                billing.status === 'Aprovado'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : billing.status === 'Rejeitado'
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {billing.status}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {billing.auditedBy ? `Por: ${billing.auditedBy}` : 'Sem auditoria'}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5 max-h-[calc(85vh-200px)] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Collaborator Initial Notes */}
          {billing.collaboratorNotes && (
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
              <span className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                Observação Original do Colaborador:
              </span>
              <p className="text-slate-300 italic">"{billing.collaboratorNotes}"</p>
            </div>
          )}

          {/* Editable Products Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                Conferência e Correção de Embalagens / Serviços
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Subtotal: <strong className="text-white">{formatCurrency(totalProducts)}</strong>
              </span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Item / Serviço</th>
                    <th className="py-2 px-3 text-center w-24">Qtd Lançada</th>
                    <th className="py-2 px-3 text-right w-28">Preço Unit.</th>
                    <th className="py-2 px-3 text-right w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/20">
                      <td className="py-2 px-3 text-slate-200 font-medium">{item.name}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) =>
                            handleProductQuantityChange(item.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-16 text-center py-1 bg-slate-800 border border-slate-700 rounded text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleProductPriceChange(item.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-right py-1 px-1 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Editable Payment Values */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                Valores Apurados por Meio de Pagamento
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Total Recebido: <strong className="text-white">{formatCurrency(totalPayments)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
                <span className="text-[11px] text-slate-400 font-medium block mb-1">
                  Crédito (R$)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={credit}
                  onChange={(e) => setCredit(parseFloat(e.target.value) || 0)}
                  className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
                <span className="text-[11px] text-slate-400 font-medium block mb-1">
                  Débito (R$)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={debit}
                  onChange={(e) => setDebit(parseFloat(e.target.value) || 0)}
                  className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
                <span className="text-[11px] text-slate-400 font-medium block mb-1">
                  Pix (R$)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pix}
                  onChange={(e) => setPix(parseFloat(e.target.value) || 0)}
                  className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
                <span className="text-[11px] text-slate-400 font-medium block mb-1">
                  Dinheiro (R$)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cash}
                  onChange={(e) => setCash(parseFloat(e.target.value) || 0)}
                  className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Live Difference Badge */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
              difference === 0 
                ? 'bg-slate-950 border-slate-800' 
                : 'bg-rose-950/40 border-rose-500/50'
            }`}>
              <div className="flex items-center gap-2">
                {difference !== 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className="text-slate-300">
                  {difference === 0 ? 'Conferência de Caixa Balanceada:' : 'Alerta de Divergência (Pagamentos vs Produtos):'}
                </span>
              </div>
              <span
                className={`font-mono font-bold text-sm ${
                  difference === 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {difference === 0 ? 'R$ 0,00 (Exato)' : `${difference > 0 ? '+' : ''}${formatCurrency(difference)}`}
              </span>
            </div>
          </div>

          {/* Decision: Status & Audit Notes */}
          <div className="pt-2 space-y-3 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Decisão da Auditoria (Definir Status)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('Aprovado')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    status === 'Aprovado'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aprovar
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('Rejeitado')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    status === 'Rejeitado'
                      ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/30'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Rejeitar / Incorreto
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('Pendente')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    status === 'Pendente'
                      ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/30'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Manter Pendente
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Parecer / Observação da Auditoria {status === 'Rejeitado' && <span className="text-rose-400">* (Obrigatório)</span>}
              </label>
              <textarea
                rows={2}
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="Ex: Conciliado com extrato Cielo lote #4029. Diferença de dinheiro ajustada."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onRequestDelete(billing)}
              className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Excluir este lançamento permanentemente"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Excluir Lançamento</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Auditoria e Correções'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
