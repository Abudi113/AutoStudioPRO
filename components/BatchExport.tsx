
import React, { useState } from 'react';
import { Order } from '../types';
import { translations } from '../i18n';

interface BatchExportProps {
  order: Order;
  onBack: () => void;
  t: any;
  theme: 'light' | 'dark';
  onDownloadAttempt?: () => Promise<boolean> | boolean;
}

const BatchExport: React.FC<BatchExportProps> = ({ order, onBack, t, theme, onDownloadAttempt }) => {
  const [resolution, setResolution] = useState('2k');
  const [format, setFormat] = useState('jpeg');
  const [naming, setNaming] = useState('VIN_ANGLE');
  const [isExporting, setIsExporting] = useState(false);

  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#141414]';
  const borderCol = theme === 'light' ? 'border-gray-200' : 'border-white/10';

  const lang = translations.en === t ? 'en' : 'de';

  const handleExport = async () => {
    if (onDownloadAttempt && !(await onDownloadAttempt())) return;

    setIsExporting(true);

    // Simulate complex packaging
    setTimeout(() => {
      // 1. Create Manifest (Inventory CSV style)
      const csvHeader = "File_Name,Vehicle_Angle,Resolution,Format,Studio_Template,Status\n";
      const csvRows = order.jobs.map(j =>
        `${order.vin || 'CAR'}_${j.angle}.${format},${j.angle},${resolution.toUpperCase()},${format.toUpperCase()},${order.studioId},${j.status}`
      ).join('\n');

      const manifestContent = csvHeader + csvRows;

      // 2. Trigger Download (In a real app this would bundle the images, 
      // here we provide the inventory control file and instructions)
      const blob = new Blob([manifestContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.title}_Inventory_Manifest.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      alert(t.inventoryCreated);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-10 px-2">
      <header className="mb-10 flex items-center gap-4">
        <button onClick={onBack} className={`w-10 h-10 rounded-xl ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/5 hover:bg-white/10'} flex items-center justify-center transition-colors`}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div>
          <h2 className={`text-2xl md:text-3xl font-extrabold mb-1 ${textTitle}`}>{t.batchExport}</h2>
          <p className="text-gray-500 text-sm">{t.createZip}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{t.resolution}</h3>
            <div className="grid grid-cols-2 gap-3">
              {['original', '1080p', '2k', '4k'].map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`p-4 rounded-xl border text-sm font-bold transition-all ${resolution === r
                    ? (theme === 'light' ? 'bg-gold-dark border-gold-dark text-white' : 'bg-blue-600 border-blue-500 text-white')
                    : `${theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white/5 border-white/10 text-gray-400'}`
                    }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{t.format}</h3>
            <div className="flex gap-3">
              {['jpeg', 'png', 'webp'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 p-4 rounded-xl border text-sm font-bold transition-all ${format === f
                    ? (theme === 'light' ? 'bg-gold-dark border-gold-dark text-white' : 'bg-blue-600 border-blue-500 text-white')
                    : `${theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white/5 border-white/10 text-gray-400'}`
                    }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className={`${cardBg} rounded-3xl border ${borderCol} p-6 md:p-8 flex flex-col shadow-xl`}>
          <div className="flex-1">
            <h3 className={`text-lg font-bold mb-6 ${textTitle}`}>{t.summary}</h3>
            <div className="space-y-4 mb-10">
              <div className={`flex justify-between items-center py-3 border-b ${theme === 'light' ? 'border-gray-100' : 'border-white/5'}`}>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-tighter">{t.packageFormat}</span>
                <span className={`text-sm font-extrabold ${textTitle}`}>{t.compressedZip}</span>
              </div>
              <div className={`flex justify-between items-center py-3 border-b ${theme === 'light' ? 'border-gray-100' : 'border-white/5'}`}>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-tighter">{t.includesManifest}</span>
                <span className="text-xs font-bold text-green-500">{t.yesCsv}</span>
              </div>
              <div className={`flex justify-between items-center py-3 border-b ${theme === 'light' ? 'border-gray-100' : 'border-white/5'}`}>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-tighter">{t.namingScheme}</span>
                <span className={`text-xs font-bold ${textTitle}`}>{naming.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className={`${theme === 'light' ? 'bg-gold-dark/5 border-gold-dark/20' : 'bg-blue-600/10 border-blue-600/20'} p-4 rounded-xl mb-8 border border-dashed`}>
              <div className="flex gap-3">
                <i className={`fa-solid fa-circle-info ${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'}`}></i>
                <p className={`text-[10px] ${theme === 'light' ? 'text-gold-dark' : 'text-blue-400'} leading-relaxed font-medium uppercase`}>
                  {t.exportInfo}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full py-4 rounded-2xl ${theme === 'light' ? 'bg-gold-dark text-white hover:bg-gold-light' : 'bg-blue-600 text-white hover:bg-blue-700'} font-extrabold text-lg transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3`}
          >
            {isExporting ? <i className="fa-solid fa-sync animate-spin"></i> : <i className="fa-solid fa-file-zipper"></i>}
            {t.generateZip}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchExport;
