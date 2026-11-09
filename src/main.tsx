import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { User } from './types';
import { storage } from './mockData';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CollaboratorPanel } from './components/CollaboratorPanel';
import { AdminPanel } from './components/AdminPanel';
import { 
  ShieldCheck, 
  Building2, 
  UserCheck, 
  AlertCircle, 
  RefreshCw, 
  Lock, 
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  Cloud
} from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => !storage.getCurrentUser());
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [, setCloudOnline] = useState<boolean>(true);

  useEffect(() => {
    // 1. Live Firestore Realtime Sync: ensures data is never lost across reloads/sessions
    const unsubCloud = storage.subscribeToCloud(() => {
      setRefreshTrigger((prev) => prev + 1);
    });

    // 2. Initial sync with Cloud Firestore
    storage.syncFromCloudFirestore()
      .then((res) => {
        setCloudOnline(true);
        setRefreshTrigger((prev) => prev + 1);
        console.log(`Firestore sincronizado com sucesso: ${res.billingsCount} turnos, ${res.usersCount} colaboradores.`);
      })
      .catch((err) => {
        setCloudOnline(false);
        console.warn('Operando com cache local offline:', err);
      });

    return () => {
      unsubCloud();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSwitchUser = (newUser: User) => {
    storage.setCurrentUser(newUser);
    setCurrentUser(newUser);
    setIsAuthModalOpen(false);
    showToast(`Conectado como ${newUser.name} (${newUser.role === 'admin' ? 'Administrador Geral' : newUser.role === 'admin_franquia' ? `Admin de Franquia (${newUser.franchise})` : newUser.franchise})`);
  };

  const handleLogout = () => {
    storage.setCurrentUser(null);
    setCurrentUser(null);
    setIsAuthModalOpen(true);
    showToast('Sessão encerrada com sucesso.', 'info');
  };

  const handleResetData = () => {
    storage.resetToDemo();
    const defaultUser = storage.getCurrentUser();
    setCurrentUser(defaultUser);
    setRefreshTrigger((prev) => prev + 1);
    showToast('Dados de demonstração restaurados com sucesso!');
  };

  const triggerDataRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="px-4 py-3 rounded-xl bg-slate-900 border border-sky-500/40 text-white shadow-2xl flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser ? (
          <div>
            {/* View Context Banner */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Sessão ativa: <strong>{currentUser.name}</strong></span>
                <span className="text-slate-600">|</span>
                <span>Perfil: <strong className="text-slate-200 uppercase">{currentUser.role === 'admin' ? 'Administrador Geral' : currentUser.role === 'admin_franquia' ? 'Admin de Franquia' : currentUser.role}</strong></span>
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

              {/* System Active Badge */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  Sistema ProtecBag Autenticado
                </span>
              </div>
            </div>

            {/* Role Conditional Rendering */}
            {currentUser.role === 'admin' || currentUser.role === 'admin_franquia' ? (
              <AdminPanel
                key={`admin-${currentUser.id}-${refreshTrigger}`}
                currentUser={currentUser}
                onDataChanged={triggerDataRefresh}
              />
            ) : (
              <CollaboratorPanel
                key={`colab-${currentUser.id}-${refreshTrigger}`}
                currentUser={currentUser}
                onBillingCreated={() => {
                  showToast('Lançamento enviado para auditoria!');
                  triggerDataRefresh();
                }}
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
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all"
            >
              Fazer Login
            </button>
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          if (currentUser) setIsAuthModalOpen(false);
        }}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          showToast(`Bem-vindo, ${user.name}!`);
        }}
      />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
