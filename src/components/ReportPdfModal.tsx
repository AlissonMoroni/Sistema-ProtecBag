import React, { useState, useMemo } from 'react';
import { User, ShiftBilling } from '../types';
import { 
  FRANCHISES, 
  DEFAULT_CATALOG, 
  formatCurrency, 
  formatDateBR, 
  formatMonthBR, 
  canAdminAccessFranchise,
  getAllowedFranchisesForAdmin,
  isGlobalAdmin as checkGlobalAdmin,
  todayLocalISO,
} from '../store';
// jsPDF é carregado só quando o usuário clica em gerar o PDF (deixa o site mais leve)
import { 
  FileText, 
  Download, 
  Calendar, 
  Building2, 
  Package, 
  DollarSign, 
  CheckCircle2, 
  X, 
  Printer,
  Sparkles,
  BarChart3,
  CreditCard,
  ShieldCheck,
  Clock
} from 'lucide-react';

interface ReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  billings: ShiftBilling[];
}

export const ReportPdfModal: React.FC<ReportPdfModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  billings,
}) => {
  const isGlobalAdmin = checkGlobalAdmin(currentUser);

  const allowedFranchises = useMemo(
    () => getAllowedFranchisesForAdmin(currentUser),
    [currentUser]
  );

  // Available months extracted from billings
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(billings.map((b) => b.month || b.date.substring(0, 7)))).filter(Boolean);
    const current = todayLocalISO().substring(0, 7);
    if (!months.includes(current)) months.push(current);
    return months.sort().reverse();
  }, [billings]);

  // Form states
  const [periodType, setPeriodType] = useState<'monthly' | 'weekly'>('monthly');
  // Padrões: mês atual e semana atual (antes eram datas fixas de demonstração)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => todayLocalISO().substring(0, 7));
  const [weekStartDate, setWeekStartDate] = useState<string>(() => {
    const d = new Date();
    const diffToMonday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    return todayLocalISO(d);
  });
  const [selectedFranchise, setSelectedFranchise] = useState<string>(
    isGlobalAdmin ? 'TODAS' : currentUser.franchise
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Calculate week end date
  const weekEndDate = useMemo(() => {
    if (!weekStartDate) return '';
    const d = new Date(weekStartDate + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    return todayLocalISO(d);
  }, [weekStartDate]);

  // Filtered billings for the report
  const filteredReportBillings = useMemo(() => {
    return billings.filter((b) => {
      // 1. Franchise Access Restriction
      if (!isGlobalAdmin && !canAdminAccessFranchise(currentUser, b.franchise)) {
        return false;
      }

      // 2. Specific Franchise Filter in modal
      if (selectedFranchise !== 'TODAS') {
        if (selectedFranchise === 'CWB') {
          if (!b.franchise.startsWith('CWB')) return false;
        } else if (selectedFranchise === 'REC') {
          if (!b.franchise.startsWith('REC')) return false;
        } else if (b.franchise !== selectedFranchise) {
          return false;
        }
      }

      // 3. Status Filter
      if (selectedStatus !== 'TODOS' && b.status !== selectedStatus) {
        return false;
      }

      // 4. Period Filter
      if (periodType === 'monthly') {
        const bMonth = b.month || b.date.substring(0, 7);
        return bMonth === selectedMonth;
      } else {
        // Weekly
        return b.date >= weekStartDate && b.date <= weekEndDate;
      }
    });
  }, [
    billings,
    currentUser,
    isGlobalAdmin,
    selectedFranchise,
    selectedStatus,
    periodType,
    selectedMonth,
    weekStartDate,
    weekEndDate,
  ]);

  // Packaging & Services Breakdown Summary
  const productStats = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; unitPrice: number; quantity: number; totalAmount: number }
    >();

    // Initialize with standard catalog
    DEFAULT_CATALOG.forEach((item) => {
      map.set(item.name.toLowerCase(), {
        id: item.id,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: 0,
        totalAmount: 0,
      });
    });

    let manualProductsTotal = 0;

    filteredReportBillings.forEach((b) => {
      if (b.manualProductsAmount) {
        manualProductsTotal += b.manualProductsAmount;
      }

      b.products.forEach((p) => {
        const key = p.name.toLowerCase();
        if (key.includes('total avulso')) {
          manualProductsTotal += p.quantity * p.unitPrice;
          return;
        }

        const existing = map.get(key);
        if (existing) {
          existing.quantity += p.quantity;
          existing.totalAmount += p.quantity * existing.unitPrice;
        } else {
          map.set(key, {
            id: p.id,
            name: p.name,
            unitPrice: p.unitPrice,
            quantity: p.quantity,
            totalAmount: p.quantity * p.unitPrice,
          });
        }
      });
    });

    const items = Array.from(map.values());
    const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
    const catalogAmount = items.reduce((acc, item) => acc + item.totalAmount, 0);
    const totalAmount = catalogAmount + manualProductsTotal;

    return {
      items,
      manualProductsTotal,
      totalUnits,
      catalogAmount,
      totalAmount,
    };
  }, [filteredReportBillings]);

  // Payment totals
  const paymentTotals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    let pix = 0;
    let cash = 0;
    let others = 0;

    filteredReportBillings.forEach((b) => {
      credit += b.payments.credit || 0;
      debit += b.payments.debit || 0;
      pix += b.payments.pix || 0;
      cash += b.payments.cash || 0;
      others += b.payments.others || 0;
    });

    const total = credit + debit + pix + cash + others;
    return { credit, debit, pix, cash, others, total };
  }, [filteredReportBillings]);

  // Franchise totals
  const franchiseTotals = useMemo(() => {
    const fMap = new Map<string, { code: string; count: number; totalAmount: number; units: number }>();

    filteredReportBillings.forEach((b) => {
      const existing = fMap.get(b.franchise) || {
        code: b.franchise,
        count: 0,
        totalAmount: 0,
        units: 0,
      };
      existing.count += 1;
      existing.totalAmount += b.totalAmount || 0;
      existing.units += b.products.reduce((acc, p) => acc + p.quantity, 0);
      fMap.set(b.franchise, existing);
    });

    return Array.from(fMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredReportBillings]);

  // Overall Financial Total
  const totalRevenue = useMemo(() => {
    return filteredReportBillings.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
  }, [filteredReportBillings]);

  if (!isOpen) return null;

  // Period label for titles
  const periodLabel =
    periodType === 'monthly'
      ? formatMonthBR(selectedMonth)
      : `Semana de ${formatDateBR(weekStartDate)} a ${formatDateBR(weekEndDate)}`;

  // Franchise label for titles
  const franchiseLabel =
    selectedFranchise === 'TODAS'
      ? 'Todas as Franquias (Consolidado Rede)'
      : selectedFranchise === 'CWB'
      ? 'Base Curitiba (CWB01, CWB02, CWB03)'
      : selectedFranchise === 'REC'
      ? 'Base Recife (REC01, REC02, REC03)'
      : `${selectedFranchise} — ${FRANCHISES.find((f) => f.code === selectedFranchise)?.airport || ''}`;

  // PDF Generation Logic
  const handleDownloadPdf = async () => {
    setIsGenerating(true);

    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setFillColor(2, 132, 199); // sky-600
      doc.rect(0, 28, pageWidth, 2, 'F');

      // Title & Logo Text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('PROTECBAG • SISTEMAS DE PROTEÇÃO E EMBALAGEM', 14, 12);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(186, 230, 253); // sky-200
      doc.text('RELATÓRIO OFICIAL DE FATURAMENTO E CONFERÊNCIA DE EMBALAGENS', 14, 19);

      // Metadata section
      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Período de Referência: ${periodLabel.toUpperCase()}`, 14, 37);
      doc.setFont('helvetica', 'normal');
      doc.text(`Unidade / Abrangência: ${franchiseLabel}`, 14, 42);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 47);
      doc.text(`Responsável pela Emissão: ${currentUser.name} (${currentUser.role === 'admin' ? 'Administrador Geral' : 'Gestor Regional'})`, 14, 52);

      let currentY = 56;

      // Table 1: Executive KPI Summary
      autoTable(doc, {
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        head: [['FATURAMENTO TOTAL', 'TOTAL DE EMBALAGENS', 'TURNOS AUDITADOS', 'TICKET MÉDIO / TURNO']],
        body: [
          [
            formatCurrency(totalRevenue),
            `${productStats.totalUnits} un`,
            `${filteredReportBillings.length} turnos`,
            formatCurrency(filteredReportBillings.length > 0 ? totalRevenue / filteredReportBillings.length : 0),
          ],
        ],
      });

      // @ts-expect-error jsPDF autotable lastAutoTable position
      currentY = doc.lastAutoTable.finalY + 8;

      // Section 2: Detailed Packaging & Services Breakdown
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('1. CONFERÊNCIA DETALHADA DE EMBALAGENS E SERVIÇOS VENDIDOS NO PERÍODO', 14, currentY);

      currentY += 4;

      const productRows = productStats.items.map((item) => {
        const share = productStats.totalUnits > 0 ? ((item.quantity / productStats.totalUnits) * 100).toFixed(1) + '%' : '0%';
        return [
          item.name,
          formatCurrency(item.unitPrice),
          `${item.quantity} un`,
          formatCurrency(item.totalAmount),
          share,
        ];
      });

      if (productStats.manualProductsTotal > 0) {
        productRows.push([
          'Total Avulso de Produtos (Valor Direto sem Qtd)',
          '—',
          '—',
          formatCurrency(productStats.manualProductsTotal),
          '—',
        ]);
      }

      autoTable(doc, {
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        bodyStyles: { fontSize: 8.5 },
        head: [['DESCRIÇÃO DO SERVIÇO / EMBALAGEM', 'PREÇO UNITÁRIO', 'QTD VENDIDA (UN)', 'TOTAL FATURADO (R$)', '% PARTICIPAÇÃO']],
        body: productRows,
        foot: [
          [
            'TOTAL GERAL DE EMBALAGENS E SERVIÇOS',
            '—',
            `${productStats.totalUnits} un`,
            formatCurrency(productStats.totalAmount),
            '100.0%',
          ],
        ],
        footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      });

      // @ts-expect-error jsPDF autotable lastAutoTable position
      currentY = doc.lastAutoTable.finalY + 8;

      // Section 3: Financial Payment Methods
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. CONCILIAÇÃO FINANCEIRA POR FORMAS DE RECEBIMENTO', 14, currentY);

      currentY += 4;

      const payRows = [
        ['Cartão de Crédito', formatCurrency(paymentTotals.credit), paymentTotals.total > 0 ? ((paymentTotals.credit / paymentTotals.total) * 100).toFixed(1) + '%' : '0%'],
        ['Cartão de Débito', formatCurrency(paymentTotals.debit), paymentTotals.total > 0 ? ((paymentTotals.debit / paymentTotals.total) * 100).toFixed(1) + '%' : '0%'],
        ['Pix / Transferência Instantânea', formatCurrency(paymentTotals.pix), paymentTotals.total > 0 ? ((paymentTotals.pix / paymentTotals.total) * 100).toFixed(1) + '%' : '0%'],
        ['Dinheiro em Espécie (Caixa)', formatCurrency(paymentTotals.cash), paymentTotals.total > 0 ? ((paymentTotals.cash / paymentTotals.total) * 100).toFixed(1) + '%' : '0%'],
      ];

      if (paymentTotals.others > 0) {
        payRows.push(['Outros Meios', formatCurrency(paymentTotals.others), ((paymentTotals.others / paymentTotals.total) * 100).toFixed(1) + '%']);
      }

      autoTable(doc, {
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        head: [['FORMA DE PAGAMENTO', 'VALOR RECEBIDO (R$)', '% PARTICIPAÇÃO']],
        body: payRows,
        foot: [['TOTAL ARRECADADO', formatCurrency(paymentTotals.total), '100.0%']],
        footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      });

      // @ts-expect-error jsPDF autotable lastAutoTable position
      currentY = doc.lastAutoTable.finalY + 8;

      // Section 4: Franchises Breakdown
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('3. DESEMPENHO CONSOLIDADO POR FRANQUIA / FILIAL', 14, currentY);

      currentY += 4;

      const franchiseRows = franchiseTotals.map((f) => {
        const info = FRANCHISES.find((fi) => fi.code === f.code);
        return [
          f.code,
          info ? `${info.airport} (${info.city})` : 'Aeroporto ProtecBag',
          `${f.count} turnos`,
          `${f.units} un`,
          formatCurrency(f.totalAmount),
          totalRevenue > 0 ? ((f.totalAmount / totalRevenue) * 100).toFixed(1) + '%' : '0%',
        ];
      });

      autoTable(doc, {
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        head: [['CÓDIGO', 'AEROPORTO / UNIDADE', 'TURNOS', 'TOTAL ITENS', 'FATURAMENTO TOTAL', '% PARTICIPAÇÃO']],
        body: franchiseRows,
        foot: [['TOTAL', 'TODAS AS UNIDADES AUDITADAS', `${filteredReportBillings.length} turnos`, `${productStats.totalUnits} un`, formatCurrency(totalRevenue), '100.0%']],
        footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      });

      // Footer and Page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          `Documento Oficial ProtecBag • Hash de Autenticidade: PB-${Date.now().toString(36).toUpperCase()} • Página ${i} de ${totalPages}`,
          14,
          290
        );
      }

      // Trigger direct download
      const cleanPeriodName = periodType === 'monthly' ? selectedMonth : `semana-${weekStartDate}`;
      const cleanFranchise = selectedFranchise.toLowerCase().replace(/[^a-z0-9]/g, '-');
      doc.save(`faturamento-protecbag-${cleanPeriodName}-${cleanFranchise}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      window.alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Exportar Relatório em PDF
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  ProtecBag Executivo
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gere o documento oficial consolidado semanal ou mensal com contagem exata de embalagens vendidas.
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

        {/* Modal Controls / Filters */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/40 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Period Type: Monthly vs Weekly */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tipo de Período
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPeriodType('monthly')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    periodType === 'monthly'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('weekly')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    periodType === 'weekly'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semanal
                </button>
              </div>
            </div>

            {/* Selector based on period type */}
            {periodType === 'monthly' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mês de Referência
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthBR(m)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Início da Semana (7 dias)
                </label>
                <input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>
            )}

            {/* Franchise Scope */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Franquia / Abrangência
              </label>
              <select
                value={selectedFranchise}
                onChange={(e) => setSelectedFranchise(e.target.value)}
                disabled={!isGlobalAdmin && allowedFranchises.length === 1}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
              >
                {isGlobalAdmin && <option value="TODAS">Todas as Franquias (Consolidado)</option>}
                {isGlobalAdmin && <option value="CWB">Base Curitiba (CWB01, CWB02, CWB03)</option>}
                {isGlobalAdmin && <option value="REC">Base Recife (REC01, REC02, REC03)</option>}
                {allowedFranchises.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} — {f.airport}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Scope */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Status da Auditoria
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
              >
                <option value="TODOS">Todos os Faturamentos</option>
                <option value="Aprovado">Apenas Aprovados</option>
                <option value="Pendente">Apenas Pendentes</option>
              </select>
            </div>
          </div>

          {/* Example callout box matching prompt */}
          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/40 flex items-center gap-3 text-xs text-sky-200">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              <strong>Relatório Personalizado:</strong> O PDF demonstra exatamente a quantidade de cada embalagem vendida (ex: em Setembro teve 600un de Aerobag M/G de R$ 199,00).
            </span>
          </div>
        </div>

        {/* Live Executive Summary in Modal */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
              <div className="text-[11px] text-slate-400 font-medium">Faturamento do Período</div>
              <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                {formatCurrency(totalRevenue)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
              <div className="text-[11px] text-slate-400 font-medium">Total de Embalagens</div>
              <div className="text-lg font-black font-mono text-sky-400 mt-0.5">
                {productStats.totalUnits} un
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
              <div className="text-[11px] text-slate-400 font-medium">Turnos Analisados</div>
              <div className="text-lg font-black font-mono text-white mt-0.5">
                {filteredReportBillings.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
              <div className="text-[11px] text-slate-400 font-medium">Ticket Médio / Turno</div>
              <div className="text-lg font-black font-mono text-purple-400 mt-0.5">
                {formatCurrency(
                  filteredReportBillings.length > 0
                    ? totalRevenue / filteredReportBillings.length
                    : 0
                )}
              </div>
            </div>
          </div>

          {/* Table: Packaging breakdown */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
            <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-sky-400" />
                <span>Embalagens e Serviços Vendidos no Período ({periodLabel})</span>
              </div>
              <span className="text-[11px] font-mono text-sky-400 font-semibold">
                {productStats.totalUnits} unidades totais
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Serviço / Embalagem</th>
                  <th className="py-2.5 px-3 text-right">Preço Unitário</th>
                  <th className="py-2.5 px-3 text-center">Qtd Vendida</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3 text-right">% Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {productStats.items.map((item) => {
                  const share =
                    productStats.totalUnits > 0
                      ? ((item.quantity / productStats.totalUnits) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                        <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/40">
                          {item.quantity} un
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {share}%
                      </td>
                    </tr>
                  );
                })}

                {productStats.manualProductsTotal > 0 && (
                  <tr className="bg-slate-800/30">
                    <td className="py-2.5 px-3 font-medium text-slate-300">
                      Total Avulso de Produtos (Valor Direto sem Quantidade)
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(productStats.manualProductsTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-900 border-t border-slate-800 font-bold">
                <tr>
                  <td className="py-2.5 px-3 text-white">TOTAL GERAL DE EMBALAGENS</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                  <td className="py-2.5 px-3 text-center text-sky-400 font-mono">
                    {productStats.totalUnits} un
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-mono text-sm">
                    {formatCurrency(productStats.totalAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white font-mono">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Visualizando <strong>{filteredReportBillings.length}</strong> fechamentos de turno com abrangência: <strong>{selectedFranchise}</strong>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Fechar
            </button>

            <button
              type="button"
              disabled={isGenerating || filteredReportBillings.length === 0}
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Gerando PDF Oficial...' : 'Baixar Relatório em PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
