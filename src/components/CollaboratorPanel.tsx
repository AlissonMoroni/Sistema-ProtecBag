import React, { useState, useMemo } from 'react';
import { User, ShiftBilling, ShiftType, ServiceProductItem, PaymentMethods } from '../types';
import { DEFAULT_CATALOG, FRANCHISES, formatCurrency, formatDateBR, storage, todayLocalISO, newId, useStoreVersion } from '../store';
import { 
  Lock, 
  Send, 
  Calendar, 
  Clock, 
  Package, 
  CreditCard, 
  Banknote, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  History, 
  Building2, 
  ShieldAlert,
  Info,
  FileText,
  DollarSign
} from 'lucide-react';

interface CollaboratorPanelProps {
  currentUser: User;
  onBillingCreated: () => void;
}

export const CollaboratorPanel: React.FC<CollaboratorPanelProps> = ({
  currentUser,
  onBillingCreated,
}) => {
  // Today's date YYYY-MM-DD
  // Data LOCAL (antes usava UTC e, depois das 21h no Brasil, já marcava o dia seguinte)
  const todayStr = useMemo(() => todayLocalISO(), []);
  const canSubmit = currentUser.role === 'colaborador';
  const [submitting, setSubmitting] = useState<boolean>(false);
  const storeVersion = useStoreVersion();

  // Form State
  const [date, setDate] = useState<string>(todayStr);
  const [shift, setShift] = useState<ShiftType>('Manhã');
  const [notes, setNotes] = useState<string>('');

  // Products
  const [products, setProducts] = useState<ServiceProductItem[]>(
    DEFAULT_CATALOG.map((item) => ({
      ...item,
      quantity: 0,
    }))
  );

  // Payment Methods
  const [credit, setCredit] = useState<number | ''>('');
  const [debit, setDebit] = useState<number | ''>('');
  const [cash, setCash] = useState<number | ''>('');
  const [pix, setPix] = useState<number | ''>('');
  const [others, setOthers] = useState<number | ''>('');

  // Field for Direct Total of Products without quantities (as requested by user)
  const [manualProductsAmount, setManualProductsAmount] = useState<number | ''>('');

  // UI feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Calculate product total from catalog items
  const catalogProductsAmount = useMemo(() => {
    return products.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }, [products]);

  // Overall product total including the direct/manual total
  const totalProductsAmount = useMemo(() => {
    const manual = typeof manualProductsAmount === 'number' ? manualProductsAmount : 0;
    return Number((catalogProductsAmount + manual).toFixed(2));
  }, [catalogProductsAmount, manualProductsAmount]);

  const totalItemsCount = useMemo(() => {
    return products.reduce((acc, item) => acc + item.quantity, 0);
  }, [products]);

  // Calculate payments total
  const totalPaymentsAmount = useMemo(() => {
    const c = typeof credit === 'number' ? credit : 0;
    const d = typeof debit === 'number' ? debit : 0;
    const m = typeof cash === 'number' ? cash : 0;
    const p = typeof pix === 'number' ? pix : 0;
    const o = typeof others === 'number' ? others : 0;
    return Number((c + d + m + p + o).toFixed(2));
  }, [credit, debit, cash, pix, others]);

  // Difference
  const difference = useMemo(() => {
    return Number((totalPaymentsAmount - totalProductsAmount).toFixed(2));
  }, [totalPaymentsAmount, totalProductsAmount]);

  // Collaborator's own franchise info
  const franchiseDetails = useMemo(() => {
    return FRANCHISES.find((f) => f.code === currentUser.franchise);
  }, [currentUser.franchise]);

  // Colaborador: somente os próprios lançamentos (por ID — antes também casava pelo NOME,
  // o que mostrava lançamentos de homônimos). Usuário de consulta: todos da sua franquia.
  // O Firestore já entrega apenas o que o perfil pode ver; o filtro aqui é uma segunda barreira.
  const myBillings = useMemo(() => {
    const all = storage.getBillings();
    return canSubmit
      ? all.filter((b) => b.collaboratorId === currentUser.id)
      : all.filter((b) => b.franchise === currentUser.franchise);
  }, [currentUser.id, currentUser.franchise, canSubmit, storeVersion]);

  // Product quantity change handler
  const handleQuantityChange = (id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: nextQty };
        }
        return item;
      })
    );
  };

  const handleQuantityDirectInput = (id: string, val: string) => {
    const num = parseInt(val, 10);
    const safeNum = isNaN(num) || num < 0 ? 0 : num;
    setProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: safeNum } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!canSubmit) {
      setFeedback({ type: 'error', message: 'Seu perfil é somente de consulta e não pode enviar lançamentos.' });
      return;
    }

    if (date > todayLocalISO()) {
      setFeedback({ type: 'error', message: 'A data do turno não pode estar no futuro.' });
      return;
    }

    const manualVal = typeof manualProductsAmount === 'number' ? manualProductsAmount : 0;

    if (totalItemsCount === 0 && manualVal === 0 && totalPaymentsAmount === 0) {
      setFeedback({
        type: 'error',
        message: 'Por favor, informe a quantidade de itens vendidos, o valor total avulso de produtos ou valores recebidos no turno.',
      });
      return;
    }

    const recordedProducts = products.filter((p) => p.quantity > 0);
    if (manualVal > 0) {
      recordedProducts.push({
        id: `prod_manual_${Date.now()}`,
        name: 'Total Avulso de Produtos (Valor Direto)',
        quantity: 1,
        unitPrice: manualVal,
      });
    }

    const newBilling: ShiftBilling = {
      id: newId('bil'),
      date,
      month: date.substring(0, 7),
      shift,
      franchise: currentUser.franchise, // ENFORCED CRITICAL BUSINESS RULE: Locked to user's assigned franchise
      collaboratorId: currentUser.id,
      collaboratorName: currentUser.name,
      products: recordedProducts,
      manualProductsAmount: manualVal,
      payments: {
        credit: typeof credit === 'number' ? credit : 0,
        debit: typeof debit === 'number' ? debit : 0,
        cash: typeof cash === 'number' ? cash : 0,
        pix: typeof pix === 'number' ? pix : 0,
        others: typeof others === 'number' ? others : 0,
      },
      totalProductsAmount,
      totalPaymentsAmount,
      totalAmount: totalPaymentsAmount > 0 ? totalPaymentsAmount : totalProductsAmount,
      differenceAmount: difference,
      status: 'Pendente', // Mandatory initial status
      collaboratorNotes: notes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      await storage.saveBilling(newBilling);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Não foi possível enviar o lançamento: ${err instanceof Error ? err.message : 'erro desconhecido'}. Seus dados continuam no formulário — tente novamente.`,
      });
      return;
    } finally {
      setSubmitting(false);
    }
    onBillingCreated();

    // Reset Form completely
    setProducts(
      DEFAULT_CATALOG.map((item) => ({
        ...item,
        quantity: 0,
      }))
    );
    setManualProductsAmount('');
    setCredit('');
    setDebit('');
    setCash('');
    setPix('');
    setOthers('');
    setNotes('');

    setFeedback({
      type: 'success',
      message: `Fechamento do turno ${shift} enviado com sucesso para auditoria! Status: Pendente.`,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner / Welcome with Franchise Lock Highlight */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-slate-900 border border-sky-800/40 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  currentUser.role === 'colaborador'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                }`}
              >
                {currentUser.role === 'colaborador' ? 'Colaborador • Permissão de Edição' : 'Usuário Normal • Consulta'}
              </span>
              <span className="text-xs text-slate-400">
                {currentUser.role === 'colaborador' ? '• Lançamento e Edição de Turnos' : '• Modo Apenas Visualização'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Olá, {currentUser.name}!
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              {currentUser.role === 'colaborador'
                ? 'Registre o faturamento e a conferência de embalagens do seu turno. Os dados serão salvos no banco de dados e enviados para auditoria da ProtecBag.'
                : 'Acesso de consulta da filial. Você pode acompanhar todos os fechamentos de turnos e status de auditoria da sua franquia.'}
            </p>
          </div>

          {/* CRITICAL BUSINESS RULE HIGHLIGHT: FRANCHISE IS LOCKED */}
          <div className="bg-slate-900/90 border-2 border-sky-500/50 rounded-xl p-4 md:min-w-[280px] shadow-lg shadow-sky-950/40">
            <div className="flex items-center justify-between text-xs text-sky-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-sky-400" />
                Unidade Operacional
              </span>
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-700/60 font-bold">
                <Lock className="w-3 h-3 text-amber-400" />
                TRAVADO
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white tracking-wider">
              {currentUser.franchise}
            </div>
            <div className="text-xs text-slate-300 truncate font-medium">
              {franchiseDetails ? `${franchiseDetails.airport} • ${franchiseDetails.city}` : 'Aeroporto Afonso Pena'}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-amber-300/90 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0 text-amber-400" />
              <span>Restrição de filial ativa (não editável)</span>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:no-underline opacity-80"
          >
            Fechar
          </button>
        </div>
      )}

      {/* MAIN FORM (somente colaboradores; perfil de consulta vê apenas o histórico) */}
      {canSubmit && (
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Header information (Date, Shift, Franchise Lock) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              1. Dados do Turno e Identificação da Franquia
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Franchise Lock Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Franquia / Filial</span>
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Fixo
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`${currentUser.franchise} - ${franchiseDetails?.airport || 'Filial Autorizada'}`}
                  className="w-full px-3 py-2.5 bg-slate-950/80 border-2 border-slate-700/80 rounded-xl text-sky-300 text-sm font-semibold cursor-not-allowed select-none shadow-inner"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Segurança: Colaborador restrito à própria franquia.
              </p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data do Faturamento
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  max={todayStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Shift */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Turno de Trabalho
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Manhã', 'Tarde', 'Noite'] as ShiftType[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setShift(st)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                      shift === st
                        ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-600/30'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {shift === 'Manhã' ? '06h00 às 14h00' : shift === 'Tarde' ? '14h00 às 22h00' : '22h00 às 06h00'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Products & Packaging items */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                2. Embalagens e Serviços Vendidos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Informe as quantidades de malas e itens selados ou informe o valor total avulso de produtos.
              </p>
            </div>
            <span className="text-xs text-sky-400 font-medium bg-sky-950/60 border border-sky-800/60 px-2.5 py-1 rounded-lg">
              Tabela Oficial ProtecBag
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <th className="pb-3 pr-4">Descrição do Serviço / Embalagem</th>
                  <th className="pb-3 px-3 text-center w-36">Quantidade</th>
                  <th className="pb-3 px-3 text-right w-36">Preço Unitário</th>
                  <th className="pb-3 pl-4 text-right w-36">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((item) => {
                  const subtotal = item.quantity * item.unitPrice;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-slate-200">{item.name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center border border-slate-700 active:scale-95"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.quantity === 0 ? '' : item.quantity}
                            placeholder="0"
                            onChange={(e) => handleQuantityDirectInput(item.id, e.target.value)}
                            className="w-14 text-center py-1 bg-slate-800/80 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center border border-slate-700 active:scale-95"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-xs text-sky-400 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded">
                          {formatCurrency(item.unitPrice)}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right font-mono font-bold text-white">
                        {formatCurrency(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Campo Especial Solicitado: Total de Produtos sem quantidade apenas Valor total */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-800/90 to-slate-800/50 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Total de Produtos (Apenas Valor Total R$ — sem quantidade)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Lançamento avulso direto caso precise somar um valor de produtos/serviços sem especificar quantidades individuais.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 pointer-events-none font-bold">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualProductsAmount}
                  onChange={(e) => setManualProductsAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0,00"
                  className="w-40 pl-9 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Consolidação do Total da Seção 2 */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-400">
              <span>Itens Tabela: <strong className="text-white">{totalItemsCount} un</strong> ({formatCurrency(catalogProductsAmount)})</span>
              {typeof manualProductsAmount === 'number' && manualProductsAmount > 0 && (
                <span>Avulso: <strong className="text-emerald-400">{formatCurrency(manualProductsAmount)}</strong></span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Valor Total de Produtos:</span>
              <span className="font-mono text-base font-black text-white">
                {formatCurrency(totalProductsAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Payment Breakdown & Smart Cash Reconciliation */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-400" />
                3. Formas de Recebimento no Caixa
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Digite os valores apurados nas maquininhas (POS) e no caixa físico do quiosque.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Credit */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  Cartão de Crédito
                </span>
                <span className="text-[10px] text-slate-400">Cielo/Stone</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Debit */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  Cartão de Débito
                </span>
                <span className="text-[10px] text-slate-400">À vista</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={debit}
                  onChange={(e) => setDebit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Pix */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  Pix ProtecBag
                </span>
                <span className="text-[10px] text-slate-400">Chave/QR</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pix}
                  onChange={(e) => setPix(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Cash */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-amber-400" />
                  Dinheiro em Espécie
                </span>
                <span className="text-[10px] text-slate-400">Gaveta</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cash}
                  onChange={(e) => setCash(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* REAL-TIME CASH RECONCILIATION SUMMARY */}
          <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Conferência do Fechamento de Caixa
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Total Produtos:</span>{' '}
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(totalProductsAmount)}
                    </span>
                  </div>
                  <span className="text-slate-600">vs</span>
                  <div>
                    <span className="text-slate-400">Total Recebimentos:</span>{' '}
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(totalPaymentsAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance status pill */}
              <div className="flex items-center gap-2">
                {difference === 0 ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Fechamento Balanceado (Diferença: R$ 0,00)</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>
                      Divergência detectada:{' '}
                      <strong className="font-mono">
                        {difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Observations & Submit */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-400" />
              Observações do Colaborador (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Troca de bobinas da máquina 2 realizada às 16h; voo atrasado gerou pico de vendas..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-500"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>O lançamento entrará como: <strong>Pendente / Aguardando Revisão</strong></span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-sky-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Enviando...' : 'Enviar Fechamento de Turno'}</span>
            </button>
          </div>
        </div>
      </form>
      )}

      {/* Section 5: Collaborator's Own History Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              {canSubmit ? 'Histórico dos Meus Lançamentos' : 'Lançamentos da Franquia'} ({currentUser.franchise})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {canSubmit
                ? `Visualizando exclusivamente os lançamentos de turno enviados pelo seu usuário (${currentUser.name}).`
                : 'Modo consulta: todos os fechamentos de turno da sua franquia e o status de auditoria.'}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {myBillings.length} {canSubmit ? 'meus registros' : 'registros'}
          </span>
        </div>

        {myBillings.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            Você ainda não possui nenhum lançamento registrado no sistema.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <th className="pb-3 pr-4">Data & Turno</th>
                  <th className="pb-3 px-3">Colaborador</th>
                  <th className="pb-3 px-3">Itens</th>
                  <th className="pb-3 px-3 text-right">Faturamento Total</th>
                  <th className="pb-3 px-3 text-center">Status</th>
                  <th className="pb-3 pl-3">Parecer do Auditor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {myBillings.map((b) => {
                  const itemsCount = b.products.reduce((acc, p) => acc + p.quantity, 0);
                  return (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-white">{formatDateBR(b.date)}</div>
                        <div className="text-xs text-sky-400 font-medium">Turno: {b.shift}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-xs">
                        {b.collaboratorName}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-300">
                        {itemsCount} un
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        {formatCurrency(b.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            b.status === 'Aprovado'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : b.status === 'Rejeitado'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {b.status === 'Aprovado' && <CheckCircle2 className="w-3 h-3" />}
                          {b.status === 'Rejeitado' && <AlertTriangle className="w-3 h-3" />}
                          {b.status === 'Pendente' && <Clock className="w-3 h-3" />}
                          {b.status === 'Pendente' ? 'Aguardando Revisão' : b.status}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-xs text-slate-400 max-w-xs truncate">
                        {b.auditNotes ? (
                          <span className="text-slate-300 italic">"{b.auditNotes}"</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
