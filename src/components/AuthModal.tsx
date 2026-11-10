import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, friendlyFirebaseError } from '../firebase';
import {
  ShieldCheck,
  Lock,
  Mail,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  /** Erro vindo do App (ex.: perfil não cadastrado / desativado). */
  externalError?: { message: string; at: number } | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, externalError }) => {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (externalError) {
      setError(externalError.message);
      setSuccessMsg(null);
      setBusy(false);
    }
  }, [externalError]);

  useEffect(() => {
    if (!isOpen) {
      setLoginPassword('');
      setBusy(false);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), loginPassword);
      setSuccessMsg('Autenticado! Carregando seu perfil...');
      setLoginPassword('');
      // O App fecha este modal quando o perfil for validado.
    } catch (err) {
      setError(friendlyFirebaseError(err));
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccessMsg(null);
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setError('Digite seu e-mail no campo acima e clique novamente em "Esqueci minha senha".');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // Não revela se o e-mail existe ou não.
      if (code !== 'auth/user-not-found' && code !== 'auth/invalid-email') {
        setError(friendlyFirebaseError(err));
        return;
      }
    }
    setSuccessMsg('Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8"
      >
        {/* Header Visual */}
        <div className="bg-gradient-to-r from-sky-900/60 via-slate-900 to-indigo-900/40 p-6 border-b border-slate-800/80 text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-600 items-center justify-center shadow-xl shadow-sky-500/20 border border-sky-400/40 mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 id="auth-title" className="text-xl font-bold text-white tracking-tight">
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
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
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

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ex: seu.email@protecbag.com.br"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{busy ? 'Entrando...' : 'Entrar no Sistema'}</span>
            </button>
          </form>

          <div className="mt-6 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Acesso Direto com E-mail e Senha</span>
            </div>
            <p>
              Digite o e-mail e senha cadastrados no Firebase para acessar seu painel de faturamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
