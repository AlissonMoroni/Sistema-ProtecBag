import React, { useState, useMemo } from 'react';
import { ShiftBilling, BillingStatus, ShiftType, User } from '../types';
import { 
  FRANCHISES, 
  formatCurrency, 
  formatDateBR, 
  formatMonthBR, 
  storage, 
  canAdminAccessFranchise,
  getAllowedFranchisesForAdmin,
  isGlobalAdmin as checkGlobalAdmin,
  useStoreVersion,
  todayLocalISO,
  csvCell,
} from '../store';
import { AuditModal } from './AuditModal';
import { CollaboratorsManager } from './CollaboratorsManager';
import { ReportPdfModal } from './ReportPdfModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Search, 
  Download, 
  ShieldCheck, 
  FileEdit, 
  Check, 
  PieChart as PieIcon, 
  BarChart3, 
  Users, 
  Cloud, 
  CalendarRange,
  Calendar,
  AlertCircle,
  Flame,
  CheckCheck,
  Trash2,
  FileText,
  Lock
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const adminName = currentUser.name;

  // Differentiate between Administrador Geral (Total network) vs Administrador de Franquia (Scoped base)
  const isGlobalAdmin = checkGlobalAdmin(currentUser);

  const allowedFranchises = useMemo(
    () => getAllowedFranchisesForAdmin(currentUser),
    [currentUser]
  );

  // Tabs: 'faturamento' vs 'colaboradores'
  const [activeTab, setActiveTab] = useState<'faturamento' | 'colaboradores'>('faturamento');

  // Billings list from storage
  // Atualiza em tempo real (Firestore onSnapshot) sem remontar o painel nem perder filtros.
  const storeVersion = useStoreVersion();
  const billings = useMemo<ShiftBilling[]>(() => storage.getBillings(), [storeVersion]);
  const dataLoaded = storage.isLoaded();

  // Feedback de operações (erros de gravação não são mais engolidos)
  const [actionError, setActionError] = useState<string | null>(null);

  // PDF Report Modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  // Filter states
  const [filterPeriodType, setFilterPeriodType] = useState<'month' | 'date'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedFranchise, setSelectedFranchise] = useState<string>(
    isGlobalAdmin ? 'TODAS' : currentUser.franchise
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [selectedShift, setSelectedShift] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterOnlyDivergent, setFilterOnlyDivergent] = useState<boolean>(false);
  const [chartViewMode, setChartViewMode] = useState<'total' | 'statusBreakdown'>('total');

  // Modal audit state
  const [auditingBilling, setAuditingBilling] = useState<ShiftBilling | null>(null);
  const [billingToDelete, setBillingToDelete] = useState<ShiftBilling | null>(null);

  // Executa uma gravação e mostra o erro na tela se falhar
  const runAction = async (fn: () => Promise<void>): Promise<boolean> => {
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao salvar. Tente novamente.');
      return false;
    }
  };

  // Helper to compute payment sum for a billing
  const getPaymentsSum = (b: ShiftBilling): number => {
    return (
      (b.payments.credit || 0) +
      (b.payments.debit || 0) +
      (b.payments.cash || 0) +
      (b.payments.pix || 0) +
      (b.payments.others || 0)
    );
  };

  // Helper to check if billing has payment vs total divergence
  const isDivergent = (b: ShiftBilling): boolean => {
    const paySum = getPaymentsSum(b);
    return Math.abs(b.totalAmount - paySum) > 0.01 || Math.abs(b.differenceAmount || 0) > 0.01;
  };

  // Authorized billings based on admin permissions:
  // Global admin sees all; franchise admin sees only their franchise/base
  const authorizedBillings = useMemo(() => {
    if (isGlobalAdmin) return billings;
    return billings.filter((b) => canAdminAccessFranchise(currentUser, b.franchise));
  }, [billings, currentUser, isGlobalAdmin]);

  // Extract distinct available months from authorized billings
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    authorizedBillings.forEach((b) => {
      const m = b.month || b.date.substring(0, 7);
      if (m) set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [authorizedBillings]);

  // Extract distinct available dates from authorized billings
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    authorizedBillings.forEach((b) => {
      if (b.date) set.add(b.date);
    });
    return Array.from(set).sort().reverse();
  }, [authorizedBillings]);

  // Filter billings by month OR by specific date
  const periodBillings = useMemo(() => {
    if (filterPeriodType === 'date') {
      if (!selectedDate || selectedDate === 'TODAS') return authorizedBillings;
      return authorizedBillings.filter((b) => b.date === selectedDate);
    }
    // filterPeriodType === 'month'
    if (selectedMonth === 'TODOS') return authorizedBillings;
    return authorizedBillings.filter((b) => (b.month || b.date.substring(0, 7)) === selectedMonth);
  }, [authorizedBillings, filterPeriodType, selectedDate, selectedMonth]);

  // Divergent count in currently selected month/period
  const divergentCount = useMemo(() => {
    return periodBillings.filter(isDivergent).length;
  }, [periodBillings]);

  // Distinct days in selected month/period for daily average calculation
  const distinctDaysCount = useMemo(() => {
    const daysSet = new Set<string>();
    periodBillings.forEach((b) => daysSet.add(b.date));
    return Math.max(1, daysSet.size);
  }, [periodBillings]);

  // KPI Calculations (Filtered by selected period: date or month)
  const kpis = useMemo(() => {
    const totalRevenue = periodBillings.reduce((sum, b) => sum + b.totalAmount, 0);
    const approvedRevenue = periodBillings
      .filter((b) => b.status === 'Aprovado')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const pendingRevenue = periodBillings
      .filter((b) => b.status === 'Pendente')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const pendingCount = periodBillings.filter((b) => b.status === 'Pendente').length;
    const approvedCount = periodBillings.filter((b) => b.status === 'Aprovado').length;
    const dailyAverage = totalRevenue / distinctDaysCount;

    // Best performing franchise
    const totalsByFranchise: Record<string, number> = {};
    periodBillings.forEach((b) => {
      totalsByFranchise[b.franchise] = (totalsByFranchise[b.franchise] || 0) + b.totalAmount;
    });

    let topFranchise = 'N/A';
    let topFranchiseAmount = 0;
    Object.entries(totalsByFranchise).forEach(([fr, amt]) => {
      if (amt > topFranchiseAmount) {
        topFranchiseAmount = amt;
        topFranchise = fr;
      }
    });

    return {
      totalRevenue,
      approvedRevenue,
      pendingRevenue,
      pendingCount,
      approvedCount,
      dailyAverage,
      totalCount: periodBillings.length,
      topFranchise,
      topFranchiseAmount,
    };
  }, [periodBillings, distinctDaysCount]);

  // RECHARTS DATA PREPARATION: Total billing amounts per franchise for the selected month/period
  const chartDataPerFranchise = useMemo(() => {
    const map: Record<
      string,
      {
        franchise: string;
        fullName: string;
        total: number;
        aprovado: number;
        pendente: number;
        rejeitado: number;
        turnos: number;
      }
    > = {};

    FRANCHISES.forEach((f) => {
      map[f.code] = {
        franchise: f.code,
        fullName: f.airport,
        total: 0,
        aprovado: 0,
        pendente: 0,
        rejeitado: 0,
        turnos: 0,
      };
    });

    periodBillings.forEach((b) => {
      if (!map[b.franchise]) {
        map[b.franchise] = {
          franchise: b.franchise,
          fullName: b.franchise,
          total: 0,
          aprovado: 0,
          pendente: 0,
          rejeitado: 0,
          turnos: 0,
        };
      }
      map[b.franchise].total += b.totalAmount;
      map[b.franchise].turnos += 1;
      if (b.status === 'Aprovado') map[b.franchise].aprovado += b.totalAmount;
      if (b.status === 'Pendente') map[b.franchise].pendente += b.totalAmount;
      if (b.status === 'Rejeitado') map[b.franchise].rejeitado += b.totalAmount;
    });

    return Object.values(map)
      .filter((item) => item.turnos > 0 || item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [periodBillings]);

  // Payment method global share for the selected month/period
  const paymentMethodsPieData = useMemo(() => {
    let credit = 0;
    let debit = 0;
    let pix = 0;
    let cash = 0;

    periodBillings.forEach((b) => {
      credit += b.payments.credit || 0;
      debit += b.payments.debit || 0;
      pix += b.payments.pix || 0;
      cash += b.payments.cash || 0;
    });

    return [
      { name: 'Crédito', value: credit, color: '#0284c7' },
      { name: 'Débito', value: debit, color: '#6366f1' },
      { name: 'Pix', value: pix, color: '#10b981' },
      { name: 'Dinheiro', value: cash, color: '#f59e0b' },
    ].filter((p) => p.value > 0);
  }, [periodBillings]);

  // Filtered billings for the audit table
  const filteredBillings = useMemo(() => {
    return periodBillings.filter((b) => {
      const matchFranchise =
        selectedFranchise === 'TODAS'
          ? true
          : selectedFranchise === 'CWB'
          ? b.franchise.startsWith('CWB')
          : selectedFranchise === 'REC'
          ? b.franchise.startsWith('REC')
          : b.franchise === selectedFranchise;
      const matchStatus = selectedStatus === 'TODOS' || b.status === selectedStatus;
      const matchShift = selectedShift === 'TODOS' || b.shift === selectedShift;
      const matchDivergence = !filterOnlyDivergent || isDivergent(b);
      const matchSearch =
        searchTerm.trim() === '' ||
        b.collaboratorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.franchise.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.collaboratorNotes && b.collaboratorNotes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.auditNotes && b.auditNotes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        b.id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchFranchise && matchStatus && matchShift && matchDivergence && matchSearch;
    });
  }, [periodBillings, selectedFranchise, selectedStatus, selectedShift, filterOnlyDivergent, searchTerm]);

  // Quick Approve
  const handleQuickApprove = (b: ShiftBilling) => {
    const updated: ShiftBilling = {
      ...b,
      status: 'Aprovado',
      auditedBy: adminName,
      auditedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditNotes: b.auditNotes || 'Aprovado em revisão direta pelo administrador.',
    };
    void runAction(() => storage.updateBilling(updated));
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Mês',
      'Data',
      'Turno',
      'Franquia',
      'Colaborador',
      'Qtd Itens',
      'Faturamento Total (R$)',
      'Soma Formas Pgto (R$)',
      'Divergência de Caixa (R$)',
      'Alerta Divergente',
      'Crédito',
      'Débito',
      'Pix',
      'Dinheiro',
      'Status',
      'Obs Colaborador',
      'Parecer Auditor',
      'Auditado Por',
    ];

    const rows = filteredBillings.map((b) => {
      const itemsCount = b.products.reduce((acc, p) => acc + p.quantity, 0);
      const paySum = getPaymentsSum(b);
      const divergent = isDivergent(b) ? 'SIM (DIVERGENTE)' : 'NAO (CONFERE)';
      const diff = b.totalAmount - paySum;

      // Valores com vírgula decimal (padrão do Excel em pt-BR)
      const money = (v: number | undefined) => (v || 0).toFixed(2).replace('.', ',');

      return [
        csvCell(b.id),
        csvCell(b.month || b.date.substring(0, 7)),
        csvCell(b.date),
        csvCell(b.shift),
        csvCell(b.franchise),
        csvCell(b.collaboratorName),
        itemsCount,
        money(b.totalAmount),
        money(paySum),
        money(diff),
        csvCell(divergent),
        money(b.payments.credit),
        money(b.payments.debit),
        money(b.payments.pix),
        money(b.payments.cash),
        csvCell(b.status),
        csvCell(b.collaboratorNotes),
        csvCell(b.auditNotes),
        csvCell(b.auditedBy),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `protecbag_faturamentos_${selectedMonth}_${todayLocalISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Bar with Admin Tabs and Cloud Sync Status */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('faturamento')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'faturamento'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Faturamentos Diários e Mensais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('colaboradores')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'colaboradores'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Gestão de Colaboradores & Acessos</span>
          </button>
        </div>

        {/* Status da sincronização em tempo real */}
        <div
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
          title="Os dados são sincronizados automaticamente com o Firestore"
        >
          <Cloud className={`w-3.5 h-3.5 ${dataLoaded ? 'text-emerald-400' : 'text-sky-400 animate-pulse'}`} />
          <span>{dataLoaded ? 'Sincronizado em tempo real' : 'Carregando dados...'}</span>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start justify-between gap-2.5">
          <span className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            {actionError}
          </span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-300 hover:text-white">✕</button>
        </div>
      )}

      {/* RENDER CONTENT BASED ON ACTIVE TAB */}
      {activeTab === 'colaboradores' ? (
        <CollaboratorsManager currentUser={currentUser} />
      ) : (
        /* FATURAMENTO & AUDITORIA VIEW */
        <div className="space-y-6">
          
          {/* Executive Header & Period Filter */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isGlobalAdmin ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Administrador Geral • Matriz (Visão Global)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    Administrador Regional • Base {currentUser.franchise} (Apenas sua Unidade)
                  </span>
                )}
                <span className="text-xs text-slate-400">• {adminName}</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Faturamento Diário e Mensal ProtecBag
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                {isGlobalAdmin
                  ? 'Consolidação financeira global de todas as unidades com auditoria e conciliação bancária.'
                  : `Visualização e auditoria restrita exclusivamente aos fechamentos de turno da Base ${currentUser.franchise}.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filter Mode Selector: Mês vs Data */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterPeriodType('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    filterPeriodType === 'month'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Por Mês</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterPeriodType('date');
                    if (!selectedDate && availableDates.length > 0) {
                      setSelectedDate(availableDates[0]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    filterPeriodType === 'date'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Por Data</span>
                </button>
              </div>

              {/* Monthly Filter Dropdown */}
              {filterPeriodType === 'month' ? (
                <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
                  <CalendarRange className="w-4 h-4 text-sky-400" />
                  <span className="text-xs text-slate-400 font-semibold">Mês:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="TODOS" className="bg-slate-900">Todos os Meses</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m} className="bg-slate-900">
                        {formatMonthBR(m)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Date Filter Picker */
                <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400 font-semibold">Data:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="text-[11px] text-sky-400 hover:underline px-1 font-semibold"
                      title="Exibir todas as datas"
                    >
                      Todas
                    </button>
                  )}
                </div>
              )}

              {/* Export PDF Button */}
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 flex items-center gap-2 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Exportar Relatório PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* KPI METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Billing */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-sky-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {filterPeriodType === 'date'
                    ? selectedDate
                      ? `Faturamento • ${formatDateBR(selectedDate)}`
                      : 'Faturamento • Todas as Datas'
                    : selectedMonth === 'TODOS'
                    ? 'Faturamento Acumulado'
                    : `Faturamento • ${formatMonthBR(selectedMonth)}`}
                </span>
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black font-mono text-white">
                {formatCurrency(kpis.totalRevenue)}
              </div>
              <div className="mt-1 text-xs text-slate-400 flex items-center justify-between">
                <span>{kpis.totalCount} turnos registrados</span>
                <span className="text-sky-400 font-mono font-semibold">
                  Média: {formatCurrency(kpis.dailyAverage)}/dia
                </span>
              </div>
            </div>

            {/* Approved Billing */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Faturamento Aprovado
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black font-mono text-emerald-300">
                {formatCurrency(kpis.approvedRevenue)}
              </div>
              <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                <span className="font-semibold text-emerald-400">{kpis.approvedCount}</span> turnos validados
              </div>
            </div>

            {/* Pending Audits */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Aguardando Auditoria
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black font-mono text-amber-300">
                {kpis.pendingCount} <span className="text-sm font-sans font-semibold text-slate-400">pendentes</span>
              </div>
              <div className="mt-1 text-xs text-amber-400/90 font-mono font-medium">
                {formatCurrency(kpis.pendingRevenue)} em conferência
              </div>
            </div>

            {/* Divergence Alert KPI Card */}
            <div
              onClick={() => setFilterOnlyDivergent(!filterOnlyDivergent)}
              className={`p-5 rounded-2xl border shadow-lg relative overflow-hidden cursor-pointer transition-all ${
                divergentCount > 0
                  ? 'bg-rose-950/30 border-rose-500/50 hover:border-rose-400'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <AlertTriangle className={`w-3.5 h-3.5 ${divergentCount > 0 ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
                  Divergências de Caixa
                </span>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    divergentCount > 0
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {divergentCount > 0 ? <Flame className="w-5 h-5" /> : <CheckCheck className="w-5 h-5" />}
                </div>
              </div>
              <div className="mt-3 text-2xl font-black font-mono text-white flex items-center gap-2">
                <span className={divergentCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {divergentCount}
                </span>
                <span className="text-xs font-sans font-normal text-slate-400">
                  {divergentCount === 1 ? 'turno com erro' : 'turnos com erro'}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {divergentCount > 0
                  ? `${filterOnlyDivergent ? '✓ Filtrando divergências' : 'Clique para filtrar na lista'}`
                  : 'Nenhuma divergência detectada'}
              </div>
            </div>
          </div>

          {/* DASHBOARD SUMMARY: RECHARTS BAR CHART (TOTAL BILLING PER FRANCHISE) */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sky-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Faturamento por Franquia •{' '}
                    <span className="text-sky-400 font-semibold">
                      {filterPeriodType === 'date'
                        ? selectedDate
                          ? `Data: ${formatDateBR(selectedDate)}`
                          : 'Todas as Datas'
                        : selectedMonth !== 'TODOS'
                        ? `Mês: ${formatMonthBR(selectedMonth)}`
                        : 'Todos os Meses (Consolidado)'}
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualização analítica com Recharts comparando o montante faturado em cada filial/aeroporto {filterPeriodType === 'date' ? 'no dia selecionado' : 'no mês selecionado'}.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800 border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setChartViewMode('total')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    chartViewMode === 'total'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Faturamento Consolidado
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('statusBreakdown')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    chartViewMode === 'statusBreakdown'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Aprovado vs Pendente
                </button>
              </div>
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="w-full h-80 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataPerFranchise}
                  margin={{ top: 15, right: 20, left: 15, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="barSkyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="barEmeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="barAmberGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />

                  <XAxis
                    dataKey="franchise"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    dy={8}
                  />

                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    width={70}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[200px]">
                            <div className="font-bold text-white text-sm flex items-center justify-between border-b border-slate-800 pb-1">
                              <span>Franquia {label}</span>
                              <span className="text-[10px] text-sky-400 font-mono font-semibold">
                                {item.turnos} {item.turnos === 1 ? 'turno' : 'turnos'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mb-1">{item.fullName}</div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Faturamento Total:</span>
                              <strong className="text-white font-mono">{formatCurrency(item.total)}</strong>
                            </div>
                            <div className="flex items-center justify-between text-emerald-400">
                              <span>Aprovado:</span>
                              <span className="font-mono">{formatCurrency(item.aprovado)}</span>
                            </div>
                            <div className="flex items-center justify-between text-amber-400">
                              <span>Pendente:</span>
                              <span className="font-mono">{formatCurrency(item.pendente)}</span>
                            </div>
                            {item.rejeitado > 0 && (
                              <div className="flex items-center justify-between text-rose-400">
                                <span>Rejeitado:</span>
                                <span className="font-mono">{formatCurrency(item.rejeitado)}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  />

                  {chartViewMode === 'total' ? (
                    <Bar
                      dataKey="total"
                      name="Faturamento Total (R$)"
                      fill="url(#barSkyGradient)"
                      radius={[8, 8, 0, 0]}
                      barSize={40}
                    />
                  ) : (
                    <>
                      <Bar
                        dataKey="aprovado"
                        name="Aprovado (R$)"
                        fill="url(#barEmeraldGradient)"
                        radius={[6, 6, 0, 0]}
                        barSize={24}
                      />
                      <Bar
                        dataKey="pendente"
                        name="Pendente (R$)"
                        fill="url(#barAmberGradient)"
                        radius={[6, 6, 0, 0]}
                        barSize={24}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Franchise ranking mini-chips */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-xs font-semibold text-slate-400 mb-2">
                Detalhamento Rápido por Unidade:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {chartDataPerFranchise.map((item) => (
                  <div
                    key={item.franchise}
                    onClick={() => setSelectedFranchise(item.franchise)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedFranchise === item.franchise
                        ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span>{item.franchise}</span>
                      <span className="text-[10px] text-slate-400">{item.turnos}t</span>
                    </div>
                    <div className="font-mono font-semibold text-white mt-1">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECONDARY CHART: MEIOS DE PAGAMENTO */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  Distribuição por Meio de Pagamento {selectedMonth !== 'TODOS' && `(${formatMonthBR(selectedMonth)})`}
                </h2>
              </div>
              <span className="text-xs text-slate-400">Total apurado em cartões, pix e dinheiro</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="h-48 md:col-span-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentMethodsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Volume']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paymentMethodsPieData.map((m) => {
                  const totalPaymentsSum = paymentMethodsPieData.reduce((acc, i) => acc + i.value, 0);
                  const percentage = totalPaymentsSum > 0 ? ((m.value / totalPaymentsSum) * 100).toFixed(1) : '0';
                  return (
                    <div key={m.name} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }}></span>
                        <span className="text-xs font-semibold text-slate-300">{m.name}</span>
                      </div>
                      <div className="font-mono text-sm font-bold text-white">{formatCurrency(m.value)}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{percentage}% do período</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AUDIT TABLE & FILTERS WITH AUTOMATIC VISUAL ALERT SYSTEM */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Auditoria de Faturamentos de Todas as Unidades
                </h2>
                <p className="text-xs text-slate-400">
                  O sistema confere e sinaliza automaticamente divergências entre o Valor Total e a soma das formas de pagamento.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 self-start sm:self-auto">
                Exibindo {filteredBillings.length} de {authorizedBillings.length} turnos
              </span>
            </div>

            {/* AUTOMATIC VISUAL ALERT BANNER IF DIVERGENT BILLINGS EXIST */}
            {divergentCount > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      <span>ALERTA DE DIVERGÊNCIA AUTOMÁTICO DETECTADO</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-xs font-black">
                        {divergentCount} {divergentCount === 1 ? 'INCONSISTÊNCIA' : 'INCONSISTÊNCIAS'}
                      </span>
                    </div>
                    <p className="text-xs text-rose-200 mt-0.5">
                      O <strong>Valor Total</strong> inserido pelo colaborador <strong>não coincide</strong> com a soma das formas de pagamento (Crédito + Débito + Dinheiro + Pix).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFilterOnlyDivergent(!filterOnlyDivergent)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                    filterOnlyDivergent
                      ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30'
                      : 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border-rose-500/40'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>{filterOnlyDivergent ? 'Exibir Todos os Turnos' : 'Filtrar Apenas Divergências'}</span>
                </button>
              </div>
            )}

            {/* Filter Controls Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Franchise Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Filtrar por Franquia / Filial
                </label>
                <select
                  value={selectedFranchise}
                  onChange={(e) => setSelectedFranchise(e.target.value)}
                  disabled={!isGlobalAdmin && allowedFranchises.length === 1}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
                >
                  {isGlobalAdmin && (
                    <option value="TODAS">Todas as Franquias ({periodBillings.length})</option>
                  )}
                  {isGlobalAdmin && (
                    <>
                      <option value="CWB">Base Curitiba (CWB01, CWB02, CWB03)</option>
                      <option value="REC">Base Recife (REC01, REC02, REC03)</option>
                    </>
                  )}
                  {allowedFranchises.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code} — {f.airport}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Status da Auditoria
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="Pendente">Pendentes (Aguardando Revisão)</option>
                  <option value="Aprovado">Aprovados</option>
                  <option value="Rejeitado">Rejeitados / Incorretos</option>
                </select>
              </div>

              {/* Shift Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Turno
                </label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                >
                  <option value="TODOS">Todos os Turnos</option>
                  <option value="Manhã">Manhã (06h - 14h)</option>
                  <option value="Tarde">Tarde (14h - 22h)</option>
                  <option value="Noite">Noite (22h - 06h)</option>
                </select>
              </div>

              {/* Search Term */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Busca Textual
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Colaborador, ID, notas..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Quick Divergence Filter Button */}
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => setFilterOnlyDivergent(!filterOnlyDivergent)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    filterOnlyDivergent
                      ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${divergentCount > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span>Divergências ({divergentCount})</span>
                </button>
              </div>
            </div>

            {/* Audit Table with Visual Divergence Alerts */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-3">Data / Turno</th>
                    <th className="py-3 px-3">Franquia</th>
                    <th className="py-3 px-3">Colaborador</th>
                    <th className="py-3 px-2 text-center">Itens</th>
                    <th className="py-3 px-3 text-right">Faturamento Total</th>
                    <th className="py-3 px-3">Soma das Formas de Pgto</th>
                    <th className="py-3 px-3 text-center">Status & Alerta</th>
                    <th className="py-3 px-3">Observações / Auditoria</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredBillings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredBillings.map((b) => {
                      const itemsCount = b.products.reduce((acc, p) => acc + p.quantity, 0);
                      const paymentsSum = getPaymentsSum(b);
                      const hasDivergence = isDivergent(b);
                      const diff = Number((b.totalAmount - paymentsSum).toFixed(2));

                      return (
                        <tr
                          key={b.id}
                          className={`transition-colors ${
                            hasDivergence
                              ? 'bg-rose-950/25 border-l-4 border-l-rose-500 hover:bg-rose-950/35'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Date & Shift */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{formatDateBR(b.date)}</div>
                            <div className="text-[11px] text-sky-400 font-medium">Turno: {b.shift}</div>
                          </td>

                          {/* Franchise */}
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {b.franchise}
                            </span>
                          </td>

                          {/* Collaborator */}
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-200 truncate max-w-[140px]">
                              {b.collaboratorName}
                            </div>
                          </td>

                          {/* Packaging Items */}
                          <td className="py-3 px-2 text-center font-mono text-slate-300">
                            {itemsCount} un
                          </td>

                          {/* Total Billing & Visual Alert */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-bold text-white text-sm">
                              {formatCurrency(b.totalAmount)}
                            </div>
                            {/* Prominent Visual Alert when Total does not match Payments */}
                            {hasDivergence ? (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/25 border border-rose-500/60 text-rose-300 font-mono font-black text-[10px] animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Dif: {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-emerald-400/90 font-mono block">
                                ✓ Caixa bateu
                              </span>
                            )}
                          </td>

                          {/* Payments breakdown & sum */}
                          <td className="py-3 px-3">
                            <div className="font-mono text-xs font-bold text-white mb-1">
                              Soma: <span className={hasDivergence ? 'text-rose-300' : 'text-slate-200'}>{formatCurrency(paymentsSum)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                              {b.payments.credit > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800" title="Crédito">
                                  CC: {formatCurrency(b.payments.credit)}
                                </span>
                              )}
                              {b.payments.debit > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800" title="Débito">
                                  CD: {formatCurrency(b.payments.debit)}
                                </span>
                              )}
                              {b.payments.pix > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800" title="Pix">
                                  PIX: {formatCurrency(b.payments.pix)}
                                </span>
                              )}
                              {b.payments.cash > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800" title="Dinheiro">
                                  DIN: {formatCurrency(b.payments.cash)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status & Divergence Badge */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
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
                              {b.status}
                            </span>

                            {hasDivergence && (
                              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/80">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>Caixa Divergente</span>
                              </div>
                            )}
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-3 max-w-xs">
                            {b.collaboratorNotes && (
                              <div className="text-[11px] text-slate-300 truncate" title={b.collaboratorNotes}>
                                <span className="text-slate-500">Colab:</span> "{b.collaboratorNotes}"
                              </div>
                            )}
                            {b.auditNotes && (
                              <div className="text-[11px] text-amber-300/90 truncate mt-0.5" title={b.auditNotes}>
                                <span className="text-amber-500">Auditor:</span> "{b.auditNotes}"
                              </div>
                            )}
                            {!b.collaboratorNotes && !b.auditNotes && (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setAuditingBilling(b)}
                                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all text-xs ${
                                  hasDivergence
                                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 border border-rose-400 animate-pulse'
                                    : 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30'
                                }`}
                                title={hasDivergence ? 'Auditar e corrigir divergência de caixa' : 'Abrir formulário de auditoria'}
                              >
                                <FileEdit className="w-3.5 h-3.5" />
                                <span>{hasDivergence ? 'Corrigir' : 'Auditar'}</span>
                              </button>

                              {b.status !== 'Aprovado' && !hasDivergence && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickApprove(b)}
                                  className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                                  title="Aprovar fechamento imediatamente"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setBillingToDelete(b)}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition-colors"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AUDIT MODAL */}
          {auditingBilling && (
            <AuditModal
              billing={auditingBilling}
              adminName={adminName}
              onClose={() => setAuditingBilling(null)}
              onSave={() => setAuditingBilling(null)}
              onRequestDelete={(b) => {
                setAuditingBilling(null);
                setBillingToDelete(b);
              }}
            />
          )}

          {/* DELETE BILLING CONFIRMATION MODAL */}
          {billingToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
              <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/40 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white text-center">Excluir Lançamento</h3>
                <p className="text-xs text-slate-300 text-center mt-2">
                  Deseja realmente excluir o lançamento de <strong className="text-white">{formatDateBR(billingToDelete.date)}</strong> ({billingToDelete.shift} - {billingToDelete.franchise})?
                </p>
                <div className="mt-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex justify-between items-center">
                  <span className="text-slate-400">Total Lançado:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatCurrency(billingToDelete.totalAmount)}</span>
                </div>
                <p className="text-[11px] text-rose-400/90 text-center mt-3">
                  Este registro será removido permanentemente da base de dados e do Firestore.
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setBillingToDelete(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const target = billingToDelete;
                      setBillingToDelete(null);
                      await runAction(() => storage.deleteBilling(target.id));
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REPORT PDF MODAL */}
          <ReportPdfModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            currentUser={currentUser}
            billings={authorizedBillings}
          />

        </div>
      )}

    </div>
  );
};
