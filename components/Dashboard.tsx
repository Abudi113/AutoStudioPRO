
import React from 'react';
import { TASKS } from '../constants';
import { TaskType, Order, BrandingConfig } from '../types';

interface DashboardProps {
  onTaskSelect: (task: TaskType) => void;
  orders: Order[];
  onOrderSelect: (order: Order) => void;
  branding: BrandingConfig;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBranding: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const Dashboard: React.FC<DashboardProps> = ({ onTaskSelect, orders, onOrderSelect, branding, onLogoUpload, onToggleBranding, t, theme }) => {
  const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#141414]';
  const borderCol = theme === 'light' ? 'border-gray-200' : 'border-white/10';
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const accentBorder = theme === 'light' ? 'hover:border-gold-dark/50' : 'hover:border-blue-500/50';
  const accentIconBg = theme === 'light' ? 'bg-gold-dark/10' : 'bg-blue-600/10';
  const accentColor = theme === 'light' ? 'text-gold-dark' : 'text-blue-500';

  return (
    <div className="max-w-6xl mx-auto py-2">
      <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="text-center sm:text-left">
          <h2 className={`text-2xl md:text-5xl font-black mb-3 ${textTitle}`}>{t.welcome}</h2>
          <p className="text-gray-500 text-sm md:text-lg font-medium">{t.subtitle}</p>
        </div>

        {/* Brand Management Card */}
        <div className={`${cardBg} border ${borderCol} p-6 rounded-3xl flex items-center gap-6 shadow-xl animate-in fade-in slide-in-from-right-4 duration-500`}>
          <div className="relative">
            <label className="cursor-pointer group block">
              <input type="file" className="hidden" accept="image/*" onChange={onLogoUpload} />
              <div className={`w-16 h-16 rounded-2xl ${accentIconBg} border-2 border-dashed ${borderCol} flex items-center justify-center transition-all group-hover:border-blue-500 overflow-hidden`}>
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} className="w-full h-full object-contain" alt="Logo" />
                ) : (
                  <i className={`fa-solid fa-plus ${accentColor}`}></i>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg">
                <i className="fa-solid fa-pen"></i>
              </div>
            </label>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Dealership Logo</span>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-black ${textTitle}`}>{branding.logoUrl ? 'Branding Active' : 'No Logo Set'}</span>
              <button 
                onClick={onToggleBranding}
                className={`w-12 h-6 rounded-full transition-all relative ${branding.isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${branding.isEnabled ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mb-20">
        <h3 className={`text-lg md:text-2xl font-black mb-10 flex items-center justify-center sm:justify-start gap-3 ${textTitle}`}>
          <i className="fa-solid fa-bolt text-yellow-500"></i>
          {t.quickTasks}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {TASKS.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskSelect(task)}
              className={`group ${cardBg} border ${borderCol} ${accentBorder} p-10 rounded-[36px] text-left transition-all hover:translate-y-[-8px] hover:shadow-2xl shadow-sm relative overflow-hidden`}
            >
              <div className={`w-16 h-16 rounded-[20px] ${accentIconBg} flex items-center justify-center mb-6 transition-all group-hover:scale-110 group-hover:text-white group-hover:bg-gold-dark dark:group-hover:bg-blue-600`}>
                <i className={`fa-solid ${task.icon} ${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'} group-hover:text-white text-3xl`}></i>
              </div>
              <h4 className={`font-black text-xl mb-3 ${textTitle}`}>{task.label}</h4>
              <p className="text-gray-500 text-sm leading-relaxed font-medium">{task.description}</p>
              
              <div className="absolute bottom-6 right-8 opacity-0 group-hover:opacity-[0.03] transition-opacity">
                <i className={`fa-solid ${task.icon} text-8xl`}></i>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="pb-16">
        <div className="flex items-center justify-between mb-10 px-1">
          <h3 className={`text-lg md:text-2xl font-black ${textTitle}`}>{t.recentProjects}</h3>
          <button className={`${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'} text-sm font-black uppercase tracking-widest hover:underline`}>{t.viewAll}</button>
        </div>

        {orders.length > 0 ? (
          <div className={`${cardBg} rounded-[40px] border ${borderCol} overflow-hidden shadow-2xl`}>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className={`border-b ${borderCol} ${theme === 'light' ? 'bg-gray-50' : 'bg-white/5'}`}>
                    <th className="px-10 py-7 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.orderVin}</th>
                    <th className="px-10 py-7 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.photos}</th>
                    <th className="px-10 py-7 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.status}</th>
                    <th className="px-10 py-7 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.date}</th>
                    <th className="px-10 py-7"></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderCol}`}>
                  {orders.map((order) => (
                    <tr 
                      key={order.id} 
                      onClick={() => onOrderSelect(order)}
                      className={`${theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-white/[0.03]'} cursor-pointer transition-colors`}
                    >
                      <td className="px-10 py-8">
                        <div className={`font-black text-lg ${textTitle}`}>{order.title}</div>
                        <div className="text-sm text-gray-500 font-bold tracking-tight">{order.vin || 'NO VIN DETECTED'}</div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${theme === 'light' ? 'bg-gold-dark' : 'bg-blue-500'} animate-pulse`}></div>
                          <span className={`font-black text-base ${textTitle}`}>{order.jobs.length} Assets</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider ${
                          order.status === 'completed' 
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                          : (theme === 'light' ? 'bg-gold-dark/10 text-gold-dark border border-gold-dark/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20')
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-gray-500 text-base font-bold">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className={`w-10 h-10 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} flex items-center justify-center`}>
                          <i className="fa-solid fa-chevron-right text-gray-400 text-sm"></i>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center py-32 ${cardBg} rounded-[48px] border-2 border-dashed ${borderCol} px-8 text-center`}>
            <div className={`w-24 h-24 ${theme === 'light' ? 'bg-gray-100 text-gray-400' : 'bg-white/5 text-gray-600'} rounded-[32px] flex items-center justify-center mb-8`}>
              <i className="fa-solid fa-layer-group text-4xl"></i>
            </div>
            <p className={`text-2xl font-black mb-3 ${textTitle}`}>{t.noProjects}</p>
            <p className="text-base text-gray-500 max-w-sm font-medium">{t.createFirst}</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
