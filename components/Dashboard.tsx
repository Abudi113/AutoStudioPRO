
import React from 'react';
import { TASKS } from '../constants';
import { TaskType, Order, BrandingConfig } from '../types';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Pen,
  Layers,
  Clock,
  CheckCircle,
  ChevronRight,
  UploadCloud,
  Image as ImageIcon,
  MoreVertical,
  Search,
  Filter
} from 'lucide-react';

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

const iconMap: Record<string, React.ReactNode> = {
  'Sparkles': <Sparkles className="w-8 h-8" />,
  'Zap': <div className="w-8 h-8 font-bold text-2xl">⚡</div>, // Fallback or custom
};

const Dashboard: React.FC<DashboardProps> = ({ onTaskSelect, orders, onOrderSelect, branding, onLogoUpload, onToggleBranding, t, theme }) => {
  // Enhanced Glassmorphism & Theme Styles
  // Matches LandingPage premium feel

  const textPrimary = 'text-[var(--foreground)]';
  const textSecondary = 'text-gray-500';

  // Use CSS variables for card backgrounds to ensure they match global theme
  const cardBase = "backdrop-blur-md border shadow-xl transition-all duration-300";
  const cardStyle = "bg-[var(--card)] border-[var(--border)]";

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
        <div>
          <h1 className={`text-4xl md:text-6xl font-black tracking-tight mb-4 ${textPrimary}`}>
            {t.welcome}
          </h1>
          <p className={`text-xl ${textSecondary} font-medium max-w-2xl`}>
            {t.subtitle}
          </p>
        </div>

        {/* Brand Management Card */}
        <div className={`p-6 rounded-3xl ${cardBase} ${cardStyle}`}>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <label className="cursor-pointer block relative">
                <input type="file" className="hidden" accept="image/*" onChange={onLogoUpload} />
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 border-2 border-dashed border-[var(--border)] bg-[var(--background)]`}>
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} className="w-full h-full object-contain p-2" alt="Logo" />
                  ) : (
                    <Plus className={`w-8 h-8 ${textSecondary}`} />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                  <Pen className="w-4 h-4" />
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black opacity-50 uppercase tracking-widest text-[var(--foreground)]">{t.branding}</span>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-bold ${branding.isEnabled ? 'text-green-500' : textSecondary}`}>
                  {branding.isEnabled ? t.active : t.disabled}
                </span>
                <button
                  onClick={onToggleBranding}
                  className={`w-12 h-6 rounded-full transition-all relative ${branding.isEnabled ? 'bg-green-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${branding.isEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions / Tasks */}
      <motion.section variants={itemVariants} className="mb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className={`text-2xl font-black tracking-tight ${textPrimary}`}>{t.quickTasks}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TASKS.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskSelect(task)}
              className={`group relative p-8 rounded-[32px] text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl overflow-hidden ${cardBase} ${cardStyle} hover:border-blue-500/30`}
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100" />

              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                {iconMap[task.icon] || <Sparkles className="w-8 h-8" />}
              </div>

              <h4 className={`text-xl font-bold mb-3 ${textPrimary}`}>{t[task.label] || task.label}</h4>
              <p className={`text-sm leading-relaxed ${textSecondary}`}>{t[task.description] || task.description}</p>

              <div className={`absolute bottom-6 right-6 p-2 rounded-full opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ${theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-600 text-white'}`}>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Recent Projects */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className={`text-2xl font-black tracking-tight ${textPrimary}`}>{t.recentProjects}</h3>
          </div>
          <button className={`text-sm font-bold uppercase tracking-wider hover:underline ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
            {t.viewAll}
          </button>
        </div>

        <div className={`rounded-[32px] overflow-hidden ${cardBase} ${cardStyle}`}>
          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className={`border-b border-[var(--border)] bg-[var(--background)]/50`}>
                    <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">{t.orderVin}</th>
                    <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">{t.photos}</th>
                    <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">{t.status}</th>
                    <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-widest">{t.date}</th>
                    <th className="px-8 py-6"></th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-[var(--border)]`}>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => onOrderSelect(order)}
                      className="group cursor-pointer transition-colors hover:bg-[var(--foreground)]/5"
                    >
                      <td className="px-8 py-6">
                        <div className={`text-base font-bold ${textPrimary}`}>{order.title}</div>
                        <div className="text-xs text-gray-500 font-mono mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          {order.vin || t.noVinDetected}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {[...Array(Math.min(3, order.jobs.length))].map((_, i) => (
                              <div key={i} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] ${theme === 'light' ? 'border-white bg-gray-100 text-gray-500' : 'border-black bg-white/10 text-white'}`}>
                                <ImageIcon className="w-3 h-3" />
                              </div>
                            ))}
                            {order.jobs.length > 3 && (
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${theme === 'light' ? 'border-white bg-gray-200 text-gray-600' : 'border-black bg-white/20 text-white'}`}>
                                +{order.jobs.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${order.status === 'completed'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          }`}>
                          {order.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3 animate-pulse" />}
                          {order.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-sm font-medium text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-gray-100 group-hover:bg-blue-50 text-gray-400 group-hover:text-blue-600' : 'bg-white/5 group-hover:bg-blue-500/20 text-gray-500 group-hover:text-blue-400'}`}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-32 px-6 flex flex-col items-center justify-center text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-pulse ${theme === 'light' ? 'bg-gray-50' : 'bg-white/5'}`}>
                <UploadCloud className={`w-10 h-10 ${theme === 'light' ? 'text-gray-300' : 'text-gray-600'}`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>{t.noProjects}</h3>
              <p className={`text-sm ${textSecondary} max-w-sm mb-8`}>{t.createFirst}</p>

              {/* Optional CTA */}
              <button
                onClick={() => onTaskSelect(TASKS[0])}
                className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.createNewProject}
              </button>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default Dashboard;
