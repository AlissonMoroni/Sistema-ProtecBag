import React, { useState } from 'react';
import { User } from '../types';
import { storage } from '../mockData';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  LogIn, 
  CheckCircle2,
  AlertCircle,
  Building2,
  Info
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: User) => void;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess }) => {
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const users = storage.getUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
    );

    if (!found) {
      setError('Usuário não encontrado. Verifique o e-mail informado ou contate a administração.');
      return;
    }

    if (found.active === false) {
      setError('Este usuário está desativado no sistema. Contate a administração.');
      return;
    }

    if (found.password && found.password !== loginPassword) {
      setError('Senha incorreta. Tente novamente.');
      return;
    }

    // Reset login fields so no sensitive data remains in state
    setLoginEmail('');
    setLoginPassword('');

    setSuccessMsg(`Autenticado com sucesso! Entrando como ${found.name}...`);
    storage.setCurrentUser(found);

    setTimeout(() => {
      onSuccess(found);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8">
        
        {/* Header Visual */}
        <div className="bg-gradient-to-r from-sky-900/60 via-slate-900 to-indigo-900/40 p-6 border-b border-slate-800/80 text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-600 items-center justify-center shadow-xl shadow-sky-500/20 border border-sky-400/40 mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            FATURAMENTO DIÁRIO
          </h2>
          <p className="text-xs text-sky-400 font-semibold tracking-wide uppercase mt-0.5">
            PROTECBAG • Acesso Corporativo
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
            <Building2 className="w-3 h-3 text-sky-400" />
            <span>Rede Aeroportos • CWB & REC</span>
          </div>
        </div>

        <div className="p-6">
          {/* Notifications */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM EXCLUSIVE */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ex: seu.email@protecbag.com.br"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar no Sistema</span>
            </button>
          </form>

          {/* Security Notice: Self registration is disabled */}
          <div className="mt-6 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Acesso Restrito a Colaboradores Autorizados</span>
            </div>
            <p>
              Novos operadores e perfis administrativos são cadastrados diretamente pela gestão central no banco de dados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
