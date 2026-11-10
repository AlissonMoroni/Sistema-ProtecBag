import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { User } from './types';
import { auth } from './firebase';
import { storage, OWNER_EMAIL, isAnyAdmin, useStoreVersion } from './store';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CollaboratorPanel } from './components/CollaboratorPanel';
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import './index.css';

// O painel administrativo (gráficos + PDF) é pesado: só carrega para administradores.
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel }))
);

type AuthState = 'loading' | 'signedOut' | 'signedIn';

/**
 * Resolve o perfil de quem fez login no Firebase Auth.
 * Usuários criados diretamente no Firebase entram direto no app como Administrador.
 */
async function resolveProfile(fbUser: FirebaseUser): Promise<User> {
  const email = (fbUser.email || '').toLowerCase().trim();
  if (!email) throw new Error('Esta conta não possui e-mail.');

  let profile = await storage.fetchOwnProfile(email);

  if (email === OWNER_EMAIL) {
    if (!profile || profile.authUid !== fbUser.uid || profile.role !== 'admin') {
      // Primeiro acesso do dono: cria/atualiza o perfil vinculado à conta.
      const ownerProfile: User = {
        id: profile?.id || 'usr_owner',
        name: profile?.name || fbUser.displayName || 'Administrador Geral',
        email,
        role: 'admin',
        franchise: 'TODAS / Matriz',
        active: true,
        phone: profile?.phone || '',
        authUid: fbUser.uid,
        createdAt: profile?.createdAt || new Date().toISOString(),
      };
      await storage.saveUserProfile(ownerProfile);
      return { ...ownerProfile, docId: email };
    }
    return profile;
  }

  // Usuário criado diretamente no Firebase Auth (Console) que ainda não tem doc no Firestore:
  // Inicializa automaticamente com perfil de Administrador para entrar direto no app.
  if (!profile) {
    const rawName = fbUser.displayName || email.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const newProfile: User = {
      id: `usr_${fbUser.uid}`,
      name: formattedName,
      email,
      role: 'admin', // Todos os usuários criados diretamente no Firebase têm acesso Adm
      franchise: 'TODAS / Matriz',
      active: true,
      phone: fbUser.phoneNumber || '',
      authUid: fbUser.uid,
      createdAt: new Date().toISOString(),
    };
    await storage.saveUserProfile(newProfile);
    return { ...newProfile, docId: email };
  }

  // Se o perfil existe mas está inativo
  if (profile.active === false) {
    throw new Error('Este usuário está desativado no sistema. Contate a administração.');
  }

  // Se o perfil existe (criado no banco de dados) e o authUid precisa ser vinculado à conta do Auth
  if (!profile.authUid || profile.authUid !== fbUser.uid) {
    const updatedProfile: User = {
      ...profile,
      authUid: fbUser.uid,
      active: true,
    };
    await storage.saveUserProfile(updatedProfile);
    return { ...updatedProfile, docId: profile.docId || email };
  }

  return profile;
}

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthErrorState] = useState<{ message: string; at: number } | null>(null);
  const setAuthError = (message: string | null) =>
    setAuthErrorState(message ? { message, at: Date.now() } : null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useStoreVersion(); // re-renderiza quando o Firestore muda (para o aviso de erro de sincronização)
  const syncError = storage.getSyncError();

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  // 1. Sessão: fonte única de verdade é o Firebase Authentication.
  useEffect(() => {
    let unwatchProfile: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      unwatchProfile?.();
      unwatchProfile = null;

      if (!fbUser) {
        storage.stopSync();
        setCurrentUser(null);
        setAuthState('signedOut');
        return;
      }

      try {
        const profile = await resolveProfile(fbUser);
        setAuthError(null);
        setCurrentUser(profile);
        setAuthState('signedIn');

        // Se o perfil for desativado ou alterado por um admin, aplica na hora.
        unwatchProfile = storage.watchOwnProfile(profile.email, (fresh) => {
          if (fresh?.email === OWNER_EMAIL) return;
          if (!fresh || fresh.active === false || fresh.authUid !== fbUser.uid) {
            setAuthError('Seu acesso foi removido ou desativado.');
            signOut(auth);
            return;
          }
          setCurrentUser((prev) =>
            prev && (prev.role !== fresh.role || prev.franchise !== fresh.franchise || prev.name !== fresh.name)
              ? fresh
              : prev
          );
        });
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Falha ao carregar seu perfil.');
        await signOut(auth);
      }
    });

    return () => {
      unwatchProfile?.();
      unsub();
    };
  }, []);

  // 2. Dados: abre a sincronização com o escopo do perfil logado.
  useEffect(() => {
    if (!currentUser) return;
    storage.startSync(currentUser);
    return () => storage.stopSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, currentUser?.franchise]);

  const handleLogout = async () => {
    await signOut(auth);
    showToast('Sessão encerrada com sucesso.', 'info');
  };

  const roleLabel = (u: User) =>
    u.role === 'admin'
      ? 'Administrador Geral'
      : u.role === 'admin_franquia'
      ? 'Admin de Franquia'
      : u.role === 'colaborador'
      ? 'Colaborador'
      : 'Usuário Normal';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50" role="status" aria-live="polite">
          <div
            className={`px-4 py-3 rounded-xl bg-slate-900 border text-white shadow-2xl flex items-center gap-3 text-sm ${
              toast.type === 'error' ? 'border-rose-500/50' : 'border-sky-500/40'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => setAuthState('signedOut')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {authState === 'loading' ? (
          <div className="py-24 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            Verificando sessão...
          </div>
        ) : currentUser ? (
          <div>
            {/* View Context Banner */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Sessão ativa: <strong>{currentUser.name}</strong></span>
                <span className="text-slate-600">|</span>
                <span>Perfil: <strong className="text-slate-200 uppercase">{roleLabel(currentUser)}</strong></span>
                <span className="text-slate-600">|</span>
                <span>
                  Franquia Vinculada:{' '}
                  <strong className="text-sky-400 font-mono">
                    {currentUser.role === 'admin'
                      ? 'VISÃO GLOBAL (TODAS)'
                      : currentUser.role === 'admin_franquia'
                      ? `GESTOR REGIONAL (${currentUser.franchise})`
                      : currentUser.franchise}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  Sistema ProtecBag Autenticado
                </span>
              </div>
            </div>

            {syncError && (
              <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{syncError}</span>
              </div>
            )}

            {/* Role Conditional Rendering */}
            {isAnyAdmin(currentUser) ? (
              <Suspense
                fallback={
                  <div className="py-24 flex items-center justify-center gap-3 text-slate-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    Carregando painel administrativo...
                  </div>
                }
              >
                <AdminPanel key={`admin-${currentUser.id}`} currentUser={currentUser} />
              </Suspense>
            ) : (
              <CollaboratorPanel
                key={`colab-${currentUser.id}`}
                currentUser={currentUser}
                onBillingCreated={() => showToast('Lançamento enviado para auditoria!')}
              />
            )}
          </div>
        ) : (
          /* Empty state when not logged in */
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Autenticação Necessária</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Acesse o sistema corporativo ProtecBag com seu e-mail e senha autorizados.
            </p>
          </div>
        )}
      </main>

      {/* Corporate Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-slate-300">PROTECBAG SISTEMAS</span>
            <span>• Soluções de Proteção e Embalagem em Aeroportos</span>
          </div>
          <div>
            Controle de Faturamento Diário &copy; {new Date().getFullYear()} — Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Auth Modal — some sozinho quando o Firebase confirma o login */}
      <AuthModal isOpen={authState === 'signedOut'} externalError={authError} />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
