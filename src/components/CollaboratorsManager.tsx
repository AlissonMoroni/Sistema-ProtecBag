import React, { useState, useMemo } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { User, UserRole } from '../types';
import {
  FRANCHISES,
  storage,
  useStoreVersion,
  isGlobalAdmin,
  canAdminAccessFranchise,
  getAllowedFranchisesForAdmin,
  generateTempPassword,
  regionOf,
  csvCell,
  todayLocalISO,
} from '../store';
import { auth, friendlyFirebaseError } from '../firebase';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Lock,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  CloudCheck,
  Sparkles,
  Key,
  Shield,
  Eye,
  FileEdit,
  X,
  AlertTriangle,
  RefreshCw,
  Download,
} from 'lucide-react';

interface CollaboratorsManagerProps {
  currentUser: User;
}

type MigrationResult = Awaited<ReturnType<typeof storage.migrateLegacyData>>;

export const CollaboratorsManager: React.FC<CollaboratorsManagerProps> = ({ currentUser }) => {
  const storeVersion = useStoreVersion();
  const users = useMemo<User[]>(() => storage.getUsers(), [storeVersion]);
  const globalAdmin = isGlobalAdmin(currentUser);
  const allowedFranchises = useMemo(() => getAllowedFranchisesForAdmin(currentUser), [currentUser]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('TODOS');
  const [franchiseFilter, setFranchiseFilter] = useState<string>('TODAS');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('colaborador');
  const [formFranchise, setFormFranchise] = useState(allowedFranchises[0]?.code || 'CWB01');
  const [formPhone, setFormPhone] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Migração de dados antigos (somente Administrador Geral)
  const legacyUsers = useMemo(() => (globalAdmin ? storage.getLegacyUsers() : []), [globalAdmin, storeVersion]);
  const billingsMissingRegion = useMemo(
    () => (globalAdmin ? storage.getBillingsMissingRegion().length : 0),
    [globalAdmin, storeVersion]
  );
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  /** Admin de franquia só gerencia colaboradores/consulta da própria base; ninguém altera a si mesmo aqui. */
  const canManage = (u: User): boolean => {
    if (u.email?.toLowerCase() === currentUser.email.toLowerCase()) return false;
    if (globalAdmin) return true;
    return (
      (u.role === 'colaborador' || u.role === 'usuario_normal') &&
      canAdminAccessFranchise(currentUser, u.franchise)
    );
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPhone('');
    setFormRole('colaborador');
    setFormFranchise(allowedFranchises[0]?.code || 'CWB01');
    setFormActive(true);
    setFormError(null);
    setFormInfo(null);
    setEditingUser(null);
  };

  const openNewUserModal = () => {
    resetForm();
    setFormPassword(generateTempPassword(10));
    setIsModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    resetForm();
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormFranchise(u.franchise);
    setFormPhone(u.phone || '');
    setFormActive(u.active !== false);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const email = formEmail.trim().toLowerCase();
    if (!formName.trim() || !email) {
      setFormError('Por favor, informe ao menos o Nome e o E-mail.');
      return;
    }

    // Admin de franquia não pode criar administradores nem usar outra base
    if (!globalAdmin) {
      if (formRole !== 'colaborador' && formRole !== 'usuario_normal') {
        setFormError('Administradores de franquia só podem cadastrar Colaboradores ou Usuários de Consulta.');
        return;
      }
      if (!canAdminAccessFranchise(currentUser, formFranchise)) {
        setFormError('Você só pode cadastrar usuários na sua base.');
        return;
      }
    }

    // Check duplicate email
    const duplicate = users.find(
      (u) =>
        u.email.toLowerCase() === email &&
        (!editingUser || u.docId !== editingUser.docId)
    );
    if (duplicate) {
      setFormError('Já existe um usuário cadastrado com este e-mail corporativo.');
      return;
    }

    if (!editingUser && formPassword.length < 6) {
      setFormError('A senha inicial precisa ter pelo menos 6 caracteres.');
      return;
    }

    const franchiseValue = formRole === 'admin' ? 'TODAS / Matriz' : formFranchise;

    setSaving(true);
    try {
      if (editingUser) {
        if (!editingUser.authUid) {
          setFormError('Este perfil ainda está no formato antigo. Use "Migrar usuários antigos" antes de editá-lo.');
          return;
        }
        await storage.saveUserProfile({
          ...editingUser,
          name: formName.trim(),
          email: editingUser.email.toLowerCase(), // e-mail é a chave da conta: não muda
          role: formRole,
          franchise: franchiseValue,
          phone: formPhone.trim(),
          active: formActive,
        });
      } else {
        await storage.createUserWithAccess(
          {
            id: `usr_${Date.now()}`,
            name: formName.trim(),
            email,
            role: formRole,
            franchise: franchiseValue,
            phone: formPhone.trim(),
            active: formActive,
            createdAt: new Date().toISOString(),
          },
          formPassword
        );
      }
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar o usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendReset = async () => {
    if (!editingUser) return;
    setFormError(null);
    setFormInfo(null);
    try {
      await sendPasswordResetEmail(auth, editingUser.email);
      setFormInfo(`Link de redefinição de senha enviado para ${editingUser.email}.`);
    } catch (err) {
      setFormError(friendlyFirebaseError(err));
    }
  };

  const handleToggleActive = async (u: User) => {
    if (!canManage(u)) return;
    if (!u.authUid) {
      setListError('Este perfil ainda está no formato antigo. Rode a migração primeiro.');
      return;
    }
    setListError(null);
    try {
      await storage.saveUserProfile({ ...u, active: u.active === false });
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Falha ao alterar o status.');
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setListError(null);
    try {
      setMigrationResult(await storage.migrateLegacyData());
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Falha na migração.');
    } finally {
      setMigrating(false);
    }
  };

  const downloadMigrationCsv = () => {
    if (!migrationResult) return;
    const rows = [
      ['Nome', 'E-mail', 'Senha temporária', 'Status', 'Observação'].map(csvCell).join(';'),
      ...migrationResult.users.map((r) =>
        [r.name, r.email, r.tempPassword || '', r.status, r.message || ''].map(csvCell).join(';')
      ),
    ];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protecbag_senhas_temporarias_${todayLocalISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.trim().toLowerCase();
    const matchSearch =
      term === '' ||
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.franchise.toLowerCase().includes(term);

    const matchRole = roleFilter === 'TODOS' || u.role === roleFilter;
    // "CWB" agora inclui CWB01/02/03 (antes só achava quem tinha exatamente "CWB")
    const matchFranchise =
      franchiseFilter === 'TODAS' ||
      u.franchise === franchiseFilter ||
      (franchiseFilter.length === 3 && regionOf(u.franchise) === franchiseFilter);

    return matchSearch && matchRole && matchFranchise;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner for Team Management */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
              Controle de Acesso & Equipes
            </span>
            <span className="text-xs text-slate-400">• Banco de Dados na Nuvem</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            Gestão de Colaboradores e Administradores
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Adicione e configure o perfil de cada membro: <strong>Colaborador</strong> (com permissão de lançamento e edição na sua franquia), <strong>Usuário Normal</strong> (consulta operacional), ou <strong>Administrador</strong> (acesso ao painel gerencial global).
          </p>
        </div>

        <button
          type="button"
          onClick={openNewUserModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Colaborador</span>
        </button>
      </div>

      {listError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start justify-between gap-2">
          <span>{listError}</span>
          <button type="button" onClick={() => setListError(null)} className="hover:text-white">✕</button>
        </div>
      )}

      {/* MIGRAÇÃO DO FORMATO ANTIGO (senhas em texto puro -> Firebase Authentication) */}
      {globalAdmin && (legacyUsers.length > 0 || billingsMissingRegion > 0 || migrationResult) && (
        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/40 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <div className="text-sm font-bold text-amber-300">Migração de segurança pendente</div>
              {legacyUsers.length > 0 && (
                <p>
                  <strong>{legacyUsers.length}</strong> usuário(s) ainda estão no formato antigo (senha salva em texto puro no banco).
                  A migração cria uma conta segura no Firebase Authentication para cada um, com uma <strong>senha temporária nova</strong>,
                  e apaga a senha antiga do banco.
                </p>
              )}
              {billingsMissingRegion > 0 && (
                <p>
                  <strong>{billingsMissingRegion}</strong> faturamento(s) antigos precisam do campo de região para aparecer para os administradores de franquia.
                </p>
              )}
            </div>
          </div>

          {(legacyUsers.length > 0 || billingsMissingRegion > 0) && (
            <button
              type="button"
              onClick={handleMigrate}
              disabled={migrating}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
              {migrating ? 'Migrando...' : 'Migrar dados antigos agora'}
            </button>
          )}

          {migrationResult && (
            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                Faturamentos atualizados: <strong>{migrationResult.billingsUpdated}</strong>
                {migrationResult.billingsFailed > 0 && (
                  <span className="text-rose-300"> • falharam: {migrationResult.billingsFailed}</span>
                )}
              </p>
              {migrationResult.users.length > 0 && (
                <>
                  <p className="text-xs text-amber-200">
                    ⚠️ Copie ou baixe as senhas temporárias agora — elas <strong>não serão mostradas de novo</strong>. Entregue a cada pessoa por um canal privado
                    (ou peça para usar "Esqueci minha senha" na tela de login).
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="py-2 px-3">Nome</th>
                          <th className="py-2 px-3">E-mail</th>
                          <th className="py-2 px-3">Senha temporária</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {migrationResult.users.map((r) => (
                          <tr key={r.email}>
                            <td className="py-2 px-3 text-white">{r.name}</td>
                            <td className="py-2 px-3 text-slate-300">{r.email}</td>
                            <td className="py-2 px-3 font-mono text-emerald-300 select-all">{r.tempPassword || '—'}</td>
                            <td className={`py-2 px-3 ${r.status === 'ok' ? 'text-emerald-400' : 'text-rose-300'}`}>
                              {r.status === 'ok' ? 'Migrado' : r.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={downloadMigrationCsv}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar lista (CSV)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMigrationResult(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs border border-slate-700"
                    >
                      Já guardei, fechar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou filial..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500"
          />
        </div>

        {/* Role Filter */}
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-sky-500"
          >
            <option value="TODOS">Todos os Perfis de Acesso</option>
            <option value="colaborador">Colaborador (Lança e Edita)</option>
            <option value="usuario_normal">Usuário Normal (Consulta)</option>
            <option value="admin">Administrador Geral (Global)</option>
            <option value="admin_franquia">Administrador de Franquia (Regional)</option>
          </select>
        </div>

        {/* Franchise Filter */}
        <div>
          <select
            value={franchiseFilter}
            onChange={(e) => setFranchiseFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-sky-500"
          >
            <option value="TODAS">Todas as Franquias ({users.length} usuários)</option>
            {globalAdmin && <option value="CWB">Base Curitiba (CWB)</option>}
            {globalAdmin && <option value="REC">Base Recife (REC)</option>}
            {allowedFranchises.map((f) => (
              <option key={f.code} value={f.code}>
                {f.code} — {f.airport}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold">
            <tr>
              <th className="py-3.5 px-4">Colaborador / E-mail</th>
              <th className="py-3.5 px-3">Perfil & Permissões</th>
              <th className="py-3.5 px-3">Franquia Vinculada</th>
              <th className="py-3.5 px-3">Contato</th>
              <th className="py-3.5 px-3 text-center">Status</th>
              <th className="py-3.5 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  Nenhum colaborador encontrado com os filtros informados.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const franchiseDetails = FRANCHISES.find((f) => f.code === u.franchise);

                return (
                  <tr key={u.docId || u.email} className="hover:bg-slate-800/40 transition-colors">
                    {/* Name & Email */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sky-400 text-xs shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Access Badge */}
                    <td className="py-3.5 px-3">
                      {u.role === 'admin' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Shield className="w-3 h-3" />
                            Administrador Geral
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Acesso global a todas as franquias
                          </p>
                        </div>
                      ) : u.role === 'admin_franquia' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Building2 className="w-3 h-3" />
                            Admin de Franquia
                          </span>
                          <p className="text-[10px] text-purple-300/90 font-medium">
                            Gestão restrita à base {u.franchise}
                          </p>
                        </div>
                      ) : u.role === 'colaborador' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <FileEdit className="w-3 h-3" />
                            Colaborador
                          </span>
                          <p className="text-[10px] text-emerald-400/90 font-medium">
                            Pode lançar e editar faturamentos
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            <Eye className="w-3.5 h-3.5" />
                            Usuário Normal
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Apenas consulta da franquia
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Franchise */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <div>
                          <div className="font-mono font-bold text-white text-xs">
                            {u.franchise}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {franchiseDetails ? franchiseDetails.airport : 'Matriz'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-3 text-slate-300 text-xs">
                      {u.phone || <span className="text-slate-600">—</span>}
                    </td>

                    {/* Active Status */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        disabled={!canManage(u)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                          u.active !== false
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                        }`}
                        title={canManage(u) ? 'Clique para alternar status ativo/inativo' : 'Sem permissão para alterar este usuário'}
                      >
                        {u.active !== false ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-400" />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      {!canManage(u) ? (
                        <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1" title="Sem permissão para alterar este usuário">
                          <Lock className="w-3 h-3" /> {u.email?.toLowerCase() === currentUser.email.toLowerCase() ? 'Você' : 'Restrito'}
                        </span>
                      ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        {!u.authUid && (
                          <span className="text-[10px] text-amber-400" title="Formato antigo — rode a migração">antigo</span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditUserModal(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors"
                          title="Editar colaborador e permissões"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserToDelete(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-colors"
                          title="Excluir colaborador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingUser ? 'Editar Acesso do Colaborador' : 'Adicionar Novo Colaborador'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Defina as permissões, papel e a franquia vinculada no banco de dados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              {formError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {formError}
                </div>
              )}
              {formInfo && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  {formInfo}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Completo do Colaborador *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo ou Juliana Santos"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail Corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    readOnly={!!editingUser}
                    title={editingUser ? 'O e-mail é a chave da conta de acesso e não pode ser alterado' : undefined}
                    placeholder="nome@protecbag.com.br"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500 read-only:opacity-60"
                  />
                </div>

                {editingUser ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Senha</label>
                    <button
                      type="button"
                      onClick={handleSendReset}
                      className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sky-300 text-xs flex items-center justify-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" /> Enviar link de nova senha
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Senha Inicial * (mín. 6)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setFormPassword(generateTempPassword(10))}
                        className="px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                        title="Gerar outra senha"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Entregue por canal privado. Não fica salva no banco.</p>
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Telefone / WhatsApp (opcional)
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="(41) 99876-5432"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* ROLE SELECTION: Colaborador vs Usuario Normal vs Admin Geral vs Admin de Franquia */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nível de Acesso (Papel no Sistema) *
                </label>
                <div className="space-y-2">
                  {/* Colaborador */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      formRole === 'colaborador'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                        : 'bg-slate-800/40 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formRole"
                      checked={formRole === 'colaborador'}
                      onChange={() => setFormRole('colaborador')}
                      className="mt-1 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <FileEdit className="w-3.5 h-3.5" />
                        Colaborador (Operador com Edição)
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Pode preencher e enviar o fechamento de turno da sua franquia vinculada. O campo de franquia fica travado na sua unidade.
                      </p>
                    </div>
                  </label>

                  {/* Usuário Normal */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      formRole === 'usuario_normal'
                        ? 'bg-sky-500/10 border-sky-500/50 text-white'
                        : 'bg-slate-800/40 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formRole"
                      checked={formRole === 'usuario_normal'}
                      onChange={() => setFormRole('usuario_normal')}
                      className="mt-1 text-sky-500 focus:ring-sky-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Usuário Normal (Consulta / Operacional)
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Acesso de visualização e consulta aos faturamentos da unidade, sem permissões de auditoria.
                      </p>
                    </div>
                  </label>

                  {globalAdmin && (<>
                  {/* Administrador Geral */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      formRole === 'admin'
                        ? 'bg-amber-500/10 border-amber-500/50 text-white'
                        : 'bg-slate-800/40 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formRole"
                      checked={formRole === 'admin'}
                      onChange={() => setFormRole('admin')}
                      className="mt-1 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        Administrador Geral (Matriz • Visão Total)
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Pode visualizar todas as franquias da rede, gráficos consolidados, auditar qualquer unidade e gerenciar colaboradores.
                      </p>
                    </div>
                  </label>

                  {/* Administrador de Franquia / Regional */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      formRole === 'admin_franquia'
                        ? 'bg-purple-500/10 border-purple-500/50 text-white'
                        : 'bg-slate-800/40 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formRole"
                      checked={formRole === 'admin_franquia'}
                      onChange={() => setFormRole('admin_franquia')}
                      className="mt-1 text-purple-500 focus:ring-purple-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Administrador de Franquia / Regional (Restrito à Base)
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Acesso administrativo restrito à sua franquia/base (ex: Admin de CWB só visualiza e aprova lançamentos de CWB).
                      </p>
                    </div>
                  </label>
                  </>)}
                </div>
              </div>

              {/* Franchise Selection (for Colaborador, Usuario Normal, and Admin de Franquia) */}
              {formRole !== 'admin' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {formRole === 'admin_franquia'
                      ? 'Base Regional ou Franquia sob Gestão *'
                      : 'Franquia / Filial Vinculada *'}
                  </label>
                  <select
                    value={formFranchise}
                    onChange={(e) => setFormFranchise(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-sky-500"
                  >
                    {formRole === 'admin_franquia' && globalAdmin && (
                      <>
                        <option value="CWB">Base Curitiba — Todas as Unidades CWB (CWB01, CWB02, CWB03)</option>
                        <option value="REC">Base Recife — Todas as Unidades REC (REC01, REC02, REC03)</option>
                      </>
                    )}
                    {allowedFranchises.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.code} — {f.airport} ({f.city} - {f.state})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-amber-400 mt-1">
                    {formRole === 'admin_franquia'
                      ? '* O gestor só terá acesso e permissão de auditoria para os lançamentos desta base.'
                      : '* O operador ficará travado nesta filial para lançamentos.'}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Administradores Gerais possuem acesso consolidado a <strong>todas as unidades da rede (CWB e REC)</strong>.
                  </span>
                </div>
              )}

              {/* Status active checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Usuário Ativo (pode fazer login e acessar o sistema)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {saving ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Criar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL (No window.confirm, 100% works in iframe) */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/40 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white text-center">Excluir Colaborador</h3>
            <p className="text-xs text-slate-300 text-center mt-2">
              Tem certeza que deseja excluir o cadastro de <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email})?
            </p>
            <p className="text-[11px] text-rose-400/90 text-center mt-1">
              Esta ação removerá permanentemente o acesso deste usuário do banco de dados (Firestore).
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = userToDelete;
                  setUserToDelete(null);
                  try {
                    await storage.deleteUser(target);
                  } catch (err) {
                    setListError(err instanceof Error ? err.message : 'Falha ao excluir o usuário.');
                  }
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

    </div>
  );
};
