import React from 'react';
import { User } from '../types';
import { 
  ShieldCheck, 
  User as UserIcon, 
  Building2, 
  LogOut 
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onOpenAuth,
}) => {

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-sky-400/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-400 bg-clip-text text-transparent">
                PROTECBAG
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Faturamento Diário
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Sistema de Controle Operacional de Aeroportos & Franquias
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              {/* Franchise & Role Badge */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-400">Unidade:</span>
                <span className="font-semibold text-white">
                  {currentUser.role === 'admin'
                    ? 'Todas as Unidades (Geral)'
                    : currentUser.role === 'admin_franquia'
                    ? `Base ${currentUser.franchise}`
                    : currentUser.franchise}
                </span>
                <span className="mx-1 text-slate-600">|</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : currentUser.role === 'admin_franquia'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : currentUser.role === 'colaborador'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {currentUser.role === 'admin'
                    ? 'Administrador Geral'
                    : currentUser.role === 'admin_franquia'
                    ? 'Admin de Franquia'
                    : currentUser.role === 'colaborador'
                    ? 'Colaborador'
                    : 'Usuário Normal'}
                </span>
              </div>

              {/* User Avatar & Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-semibold text-xs">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-medium text-white truncate max-w-[130px]">
                    {currentUser.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser.role === 'admin' ? 'Administrador' : currentUser.franchise}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors ml-1"
                  title="Sair do sistema"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" />
              <span>Acessar Sistema</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
