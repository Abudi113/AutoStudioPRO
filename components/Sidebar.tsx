
import React from 'react';
import { Order } from '../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  activeOrder: Order | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  lang: 'en' | 'de';
  onToggleLang: () => void;
  t: any;
  isOpen: boolean;
  onToggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onNavigate, 
  activeOrder, 
  theme, 
  onToggleTheme, 
  lang, 
  onToggleLang, 
  t,
  isOpen,
  onToggleSidebar
}) => {
  const accentColor = theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600';
  const textColor = theme === 'light' ? 'text-gold-dark' : 'text-blue-500';
  const sidebarBg = theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#141414] border-white/10';

  return (
    <aside className={`w-full md:w-64 ${sidebarBg} border-r flex flex-col transition-all duration-300 z-50 ${isOpen ? 'h-screen' : 'h-auto md:h-screen'}`}>
      <div className={`p-6 border-b ${theme === 'light' ? 'border-gray-200' : 'border-white/10'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${accentColor} rounded-lg flex items-center justify-center shadow-lg shadow-gold-dark/20`}>
            <i className="fa-solid fa-car-side text-white"></i>
          </div>
          <h1 className={`font-extrabold text-lg tracking-tight ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            AutoStudio<span className={textColor}>Pro</span>
          </h1>
        </div>
        
        {/* Hamburger Menu Toggle */}
        <button 
          onClick={onToggleSidebar}
          className={`md:hidden p-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-black/5 text-gray-900' : 'hover:bg-white/5 text-white'}`}
        >
          <i className={`fa-solid ${isOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
        </button>
      </div>

      <nav className={`${isOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col py-4 md:py-6 px-4 animate-in fade-in slide-in-from-top-4 duration-300`}>
        <div className="mb-6">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3">Main</p>
          <button 
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
              currentView === 'dashboard' 
              ? (theme === 'light' ? 'bg-gold-dark text-white shadow-lg shadow-gold-dark/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/40') 
              : `hover:bg-${theme === 'light' ? 'black/5' : 'white/5'} ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`
            }`}
          >
            <i className="fa-solid fa-house w-5"></i>
            <span className="font-semibold text-sm">{t.dashboard}</span>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3">{t.activeProject}</p>
          {activeOrder ? (
            <button 
              onClick={() => onNavigate('order-details')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                currentView === 'order-details' 
                ? (theme === 'light' ? 'bg-gold-dark text-white shadow-lg shadow-gold-dark/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/40') 
                : `hover:bg-${theme === 'light' ? 'black/5' : 'white/5'} ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`
              }`}
            >
              <i className="fa-solid fa-folder-open w-5"></i>
              <div className="text-left overflow-hidden">
                <span className="font-semibold text-sm block truncate">{activeOrder.title}</span>
                <span className="text-[10px] opacity-60 uppercase font-bold">{activeOrder.status}</span>
              </div>
            </button>
          ) : (
            <div className={`px-3 py-5 text-xs italic border border-dashed rounded-xl ${theme === 'light' ? 'text-gray-400 border-gray-300' : 'text-gray-600 border-white/10'}`}>
              No active project
            </div>
          )}
        </div>

        <div className="mt-auto space-y-2 border-t pt-6 border-gray-200 dark:border-white/5">
           <button 
             onClick={onToggleTheme}
             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${theme === 'light' ? 'hover:bg-black/5 text-gray-600' : 'hover:bg-white/5 text-gray-400'}`}
           >
             <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-white/5">
                <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'} text-xs`}></i>
             </div>
             <span className="text-sm font-semibold">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
           </button>
           <button 
             onClick={onToggleLang}
             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${theme === 'light' ? 'hover:bg-black/5 text-gray-600' : 'hover:bg-white/5 text-gray-400'}`}
           >
             <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-white/5">
                <i className="fa-solid fa-language text-xs"></i>
             </div>
             <span className="text-sm font-semibold uppercase">{lang === 'en' ? 'DE / Deutsch' : 'EN / English'}</span>
           </button>
        </div>

        <div className={`mt-6 p-4 rounded-2xl border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black/20 border-white/5'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${theme === 'light' ? 'bg-gray-200 border-gray-300 text-gray-700' : 'bg-gradient-to-br from-gray-700 to-gray-800 border-white/10 text-white'}`}>
              JD
            </div>
            <div>
              <p className={`font-bold text-sm ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>John Dealer</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Premium Enterprise</p>
            </div>
          </div>
          <button className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}>
            <i className="fa-solid fa-gear"></i>
            {t.settings}
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
