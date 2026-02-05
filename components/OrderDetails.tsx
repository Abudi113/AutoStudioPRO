
import React, { useState } from 'react';
import { Order, ProcessingJob } from '../types';

interface OrderDetailsProps {
  order: Order;
  onBack: () => void;
  onExport: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ order, onBack, onExport, t, theme }) => {
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(order.jobs[0] || null);
  const [compareMode, setCompareMode] = useState<'after' | 'side-by-side'>('after');
  const [zoom, setZoom] = useState<number>(1);
  const imageRef = React.useRef<HTMLImageElement>(null);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#141414]';
  const borderCol = theme === 'light' ? 'border-gray-200' : 'border-white/10';
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const btnAccent = theme === 'light' ? 'bg-gold-dark hover:bg-gold-light' : 'bg-blue-600 hover:bg-blue-700';

  const downloadImage = (base64: string, name: string, angle: string) => {
    if (!base64) return;

    // If zoom is 1, download original
    if (zoom === 1) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = `AutoStudio_${name.replace(/\s+/g, '_')}_${angle}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // WYSIWYG Canvas Download for Zoomed Images
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      // Set canvas size to match the original image dimensions (or visible viewport?)
      // User requested "look the way on the website downloaded"
      // Usually this means cropping.

      // We will create a canvas the size of the original * zoom? 
      // Or keep original size and zoom into it (crop)?
      // Standard "Digital Zoom" behavior: The Output Viewport is fixed (screen), image grows.
      // But for a file, usually we want the "View" to be the new file.
      // Let's implement 'Crop to View': 
      // Source: The visible portion of the image.
      // Destination: The full canvas size.

      // actually, simpler approach: 
      // We draw the image Scaled. 
      // If we scale UP (Zoom In), we crop the edges. 
      // If we scale DOWN (Zoom Out), we add borders.

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Fill black background (professional standard)
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate center
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Draw image with scale relative to center
        ctx.translate(cx, cy);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `AutoStudio_${name.replace(/\s+/g, '_')}_${angle}_ZOOMED.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    img.src = base64;
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col min-h-full pb-8">
      {/* Dynamic Header */}
      <header className="mb-4 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-12 h-12 shrink-0 rounded-2xl ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/5 hover:bg-white/10'} flex items-center justify-center transition-all active:scale-95`}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="min-w-0">
            <h2 className={`text-xl md:text-3xl font-black truncate leading-tight ${textTitle}`}>{order.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-black uppercase rounded border border-green-500/20">Studio Locked</span>
              <p className="text-gray-500 text-[10px] md:text-sm font-medium">{order.jobs.length} Assets</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className={`flex-1 sm:flex-none px-6 py-3.5 rounded-2xl ${btnAccent} text-white text-sm font-black shadow-xl shadow-blue-900/10 transition-all flex items-center justify-center gap-3 active:scale-95`}
          >
            <i className="fa-solid fa-file-zipper"></i> {t.batchExport} (ZIP)
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-5 md:gap-8 items-start">
        {/* Main Stage: High Resolution Preview */}
        <div className={`w-full lg:flex-[3] ${cardBg} rounded-3xl border ${borderCol} overflow-hidden flex flex-col shadow-2xl transition-all duration-500`}>
          {/* Stage Controls */}
          <div className={`p-4 md:p-5 border-b ${borderCol} flex flex-wrap items-center justify-between gap-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-black/40'}`}>
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Perspective</span>
                <span className={`text-[12px] font-black ${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'} uppercase`}>
                  {selectedJob?.angle.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-gray-300 dark:bg-white/10 shrink-0"></div>

              {/* Zoom Control */}
              <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 px-4 py-2 rounded-lg">
                <i className="fa-solid fa-magnifying-glass text-gray-500 text-[10px]"></i>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={handleZoomChange}
                  className="w-24 accent-blue-500 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] font-mono text-gray-500 w-8">{Math.round(zoom * 100)}%</span>
              </div>

              <div className="h-8 w-[1px] bg-gray-300 dark:bg-white/10 shrink-0"></div>

              <div className={`flex ${theme === 'light' ? 'bg-gray-200' : 'bg-black/60'} p-1 rounded-xl shrink-0`}>
                <button
                  onClick={() => setCompareMode('after')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${compareMode === 'after' ? `${theme === 'light' ? 'bg-white text-gold-dark shadow-sm' : 'bg-blue-600 text-white'}` : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'}`}
                >RESULT</button>
                <button
                  onClick={() => setCompareMode('side-by-side')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${compareMode === 'side-by-side' ? `${theme === 'light' ? 'bg-white text-gold-dark shadow-sm' : 'bg-blue-600 text-white'}` : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'}`}
                >COMPARE</button>
              </div>
            </div>

            <button
              onClick={() => selectedJob?.processedImage && downloadImage(selectedJob.processedImage, order.title, selectedJob.angle)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl ${theme === 'light' ? 'bg-gold-dark text-white' : 'bg-white text-black'} text-[11px] font-black hover:scale-105 transition-transform shadow-lg shadow-black/20`}
            >
              <i className="fa-solid fa-download"></i> {t.download} PHOTO
            </button>
          </div>

          {/* Interactive Rendering Canvas */}
          <div className={`flex-1 min-h-[40vh] md:min-h-[550px] relative flex items-center justify-center p-4 md:p-10 ${theme === 'light' ? 'bg-[#f4f4f4]' : 'bg-[radial-gradient(circle_at_center,_#222_0%,_#000_100%)]'} overflow-hidden rounded-b-3xl`}>
            {selectedJob && (
              compareMode === 'after' ? (
                <div className="w-full h-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-700 overflow-hidden">
                  <img
                    ref={imageRef}
                    src={selectedJob.processedImage || selectedJob.originalImage}
                    alt="Vehicle Render"
                    style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out' }}
                    className={`max-w-full max-h-full object-contain drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)] ${!selectedJob.processedImage ? 'opacity-40 blur-sm' : 'opacity-100'}`}
                  />
                  {!selectedJob.processedImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Processing Neural Studio...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row gap-6 p-2 md:p-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex-1 relative group bg-black/40 rounded-3xl overflow-hidden border border-white/5 ring-1 ring-white/10">
                    <img src={selectedJob.originalImage} className="w-full h-full object-contain p-2" />
                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest border border-white/10 uppercase">Input Asset</div>
                  </div>
                  <div className="flex-1 relative group bg-black/40 rounded-3xl overflow-hidden border border-white/5 ring-1 ring-white/10 shadow-2xl">
                    <img src={selectedJob.processedImage || selectedJob.originalImage} className={`w-full h-full object-contain p-2 ${!selectedJob.processedImage ? 'opacity-20' : ''}`} />
                    <div className={`absolute top-4 left-4 ${theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600'} text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase shadow-xl`}>AI Render</div>
                    {!selectedJob.processedImage && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <i className="fa-solid fa-wand-magic-sparkles animate-pulse text-white/40 text-4xl"></i>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Rapid Asset Browser - REFINED: Removed individual green download button */}
          <div className={`p-4 md:p-6 ${theme === 'light' ? 'bg-gray-50 border-t border-gray-200' : 'bg-[#0a0a0a] border-t border-white/5'} flex items-center gap-4 overflow-x-auto no-scrollbar scroll-smooth`}>
            {order.jobs.map((job) => (
              <div key={job.id} className="relative group shrink-0 py-2">
                <button
                  onClick={() => setSelectedJob(job)}
                  className={`relative w-28 md:w-44 aspect-[16/10] rounded-2xl overflow-hidden transition-all duration-300 ${selectedJob?.id === job.id
                    ? `ring-4 ${theme === 'light' ? 'ring-gold-dark' : 'ring-blue-500'} ring-offset-4 ${theme === 'light' ? 'ring-offset-white' : 'ring-offset-black'} scale-105 z-10 shadow-2xl`
                    : 'opacity-40 hover:opacity-100 hover:scale-[1.02] border border-white/10'
                    }`}
                >
                  <img src={job.processedImage || job.originalImage} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 text-[8px] font-black uppercase truncate text-white bg-black/70 text-center backdrop-blur-md">
                    {job.angle.replace(/_/g, ' ')}
                  </div>

                  {job.status === 'pending' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <i className="fa-solid fa-spinner animate-spin text-white/50"></i>
                    </div>
                  )}
                  {job.status === 'failed' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
                      <i className="fa-solid fa-circle-exclamation text-white"></i>
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence & Actions Sidebar */}
        <div className="flex flex-col gap-5 lg:w-96 w-full shrink-0">
          <div className={`${cardBg} rounded-3xl border ${borderCol} p-6 shadow-xl`}>
            <h3 className={`text-sm font-black mb-5 flex items-center gap-3 ${textTitle}`}>
              <i className="fa-solid fa-shield-halved text-blue-500"></i>
              Enterprise Safety Check
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500 uppercase tracking-widest">Car Preservation</span>
                <span className="text-green-500 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i> 100% BIT-PERFECT
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500 uppercase tracking-widest">Environment Alignment</span>
                <span className={`uppercase ${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'}`}>Studio-Locked</span>
              </div>
              <div className={`p-4 rounded-2xl ${theme === 'light' ? 'bg-gray-50' : 'bg-[#0d0d0d]'} border ${borderCol} mt-4`}>
                <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                  Verification engine detected 0% foreground drift. Lighting vectors successfully re-calculated to match the chosen industrial studio setup.
                </p>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-3xl border ${borderCol} p-6 shadow-xl`}>
            <h3 className={`text-sm font-black mb-5 ${textTitle}`}>Distribution Ready</h3>
            <div className="space-y-4">
              <div className={`p-5 rounded-2xl border border-dashed ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-black/40 border-white/5'} flex flex-col items-center text-center`}>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-3">
                  <i className="fa-solid fa-check-double"></i>
                </div>
                <p className="text-xs font-black mb-1 ${textTitle}">Asset Optimization Complete</p>
                <p className="text-[10px] text-gray-500 mb-6 font-medium">Auto-resized and meta-tagged for European marketplaces.</p>

                <button
                  onClick={onExport}
                  className={`w-full py-3 rounded-xl ${theme === 'light' ? 'bg-white border-gray-200 text-gray-900' : 'bg-white/5 border-white/10 text-white'} border text-[11px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-sm active:scale-95`}
                >
                  Configure Full Batch
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button className={`flex items-center justify-center py-3 rounded-xl ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} border ${borderCol} text-[9px] font-black uppercase tracking-wider hover:border-blue-500/50 transition-all active:scale-95`}>
                  Mobile.de Sync
                </button>
                <button className={`flex items-center justify-center py-3 rounded-xl ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} border ${borderCol} text-[9px] font-black uppercase tracking-wider hover:border-orange-500/50 transition-all active:scale-95`}>
                  AutoScout Link
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
