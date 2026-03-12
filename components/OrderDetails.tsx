
import React, { useState } from 'react';
import { Order, ProcessingJob, CameraAngle, StudioTemplate } from '../types';
import { CAMERA_ANGLES } from '../constants';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import JSZip from 'jszip';

// Image categories that map to processing pipelines
const IMAGE_CATEGORIES: { id: CameraAngle; label: string; icon: string }[] = [
  { id: 'AUTO', label: 'Auto-Detect', icon: 'fa-wand-magic-sparkles' },
  { id: 'EXTERIOR_CAR', label: 'Exterior', icon: 'fa-car' },
  { id: 'INTERIOR_CAR', label: 'Interior', icon: 'fa-car-side' },
  { id: 'INTERIOR_DETAIL_CAR', label: 'Int. Detail', icon: 'fa-circle-dot' },
  { id: 'DETAIL_CAR', label: 'Detail', icon: 'fa-magnifying-glass' },
];

// Auto-detect pipeline category from specific angle
const angleToCategory = (angle?: CameraAngle): CameraAngle => {
  if (!angle) return 'AUTO';
  if (['AUTO', 'EXTERIOR_CAR', 'INTERIOR_CAR', 'INTERIOR_DETAIL_CAR', 'DETAIL_CAR'].includes(angle)) return angle;
  if (angle === 'interior' || angle.startsWith('interior_')) return 'INTERIOR_CAR';
  if (angle === 'detail') return 'DETAIL_CAR';
  if (['door_open', 'trunk_open', 'hood_open'].includes(angle)) return 'DETAIL_CAR';
  return 'AUTO';
};

interface OrderDetailsProps {
  order: Order;
  onBack: () => void;
  onExport: () => void;
  t: any;
  theme: 'light' | 'dark';
  onDownloadAttempt?: () => Promise<boolean> | boolean;
  onRetryJob?: (jobId: string, category?: CameraAngle) => void;
  onChangeAngle?: (jobId: string, newAngle: CameraAngle, category?: CameraAngle) => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ order, onBack, onExport, t, theme, onDownloadAttempt, onRetryJob, onChangeAngle }) => {
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(order.jobs[0] || null);
  const [compareMode, setCompareMode] = useState<'after' | 'side-by-side'>('after');
  const [zoom, setZoom] = useState<number>(1);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const [showAnglePicker, setShowAnglePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CameraAngle>('AUTO');

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#141414]';
  const borderCol = theme === 'light' ? 'border-gray-200' : 'border-white/10';
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const btnAccent = theme === 'light' ? 'bg-gold-dark hover:bg-gold-light' : 'bg-blue-600 hover:bg-blue-700';

  const downloadImage = async (src: string, name: string, angle: string) => {
    if (!src) return;

    // If it's a URL (not base64), fetch it as a blob first
    let imageDataUrl = src;
    if (!src.startsWith('data:image/')) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        imageDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.error('Failed to fetch image for download:', err);
        // Fallback: open in new tab
        window.open(src, '_blank');
        return;
      }
    }

    // If zoom is 1, download original
    if (zoom === 1) {
      const link = document.createElement('a');
      link.href = imageDataUrl;
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
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
    img.src = imageDataUrl;
  };

  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleDownload = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (onDownloadAttempt && !(await onDownloadAttempt())) return;
    if (selectedJob?.processedImage) {
      await downloadImage(selectedJob.processedImage, order.title, selectedJob.angle);
    }
  };

  // ── Instant ZIP download ──
  const handleInstantZip = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const completedJobs = order.jobs.filter(j => j.status === 'completed' && j.processedImage);
    if (completedJobs.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();

      for (const job of completedJobs) {
        const src = job.processedImage!;
        let blob: Blob;

        if (src.startsWith('data:')) {
          // Convert base64 to blob
          const res = await fetch(src);
          blob = await res.blob();
        } else {
          // Fetch from URL
          const res = await fetch(src);
          blob = await res.blob();
        }

        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        const fileName = `${order.title.replace(/\s+/g, '_')}_${job.angle}.${ext}`;
        zip.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.title.replace(/\s+/g, '_')}_all.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert('ZIP export failed. Please try again.');
    } finally {
      setIsZipping(false);
    }
  };

  // ── Retry handler ──
  const handleRetry = () => {
    if (selectedJob && onRetryJob) {
      onRetryJob(selectedJob.id, selectedCategory);
    }
  };

  // ── Angle change handler ──
  const handleAngleChange = (newAngle: CameraAngle) => {
    if (selectedJob && onChangeAngle) {
      onChangeAngle(selectedJob.id, newAngle, selectedCategory);
      setShowAnglePicker(false);
    }
  };

  // Keep selectedJob in sync with order updates (e.g. after retry completes)
  React.useEffect(() => {
    if (selectedJob) {
      const updated = order.jobs.find(j => j.id === selectedJob.id);
      if (updated) setSelectedJob(updated);
    }
  }, [order.jobs]);

  // Auto-detect category when switching images
  React.useEffect(() => {
    if (selectedJob) {
      setSelectedCategory(angleToCategory(selectedJob.angle));
    }
  }, [selectedJob?.id]);

  const isRetrying = selectedJob?.status === 'pending' || selectedJob?.status === 'processing';

  return (
    <div className="w-full flex flex-col min-h-full pb-8">
      {/* Dynamic Header */}
      <header className="mb-4 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-12 h-12 shrink-0 rounded-2xl ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-white/5 hover:bg-white/10'} flex items-center justify-center transition-all active:scale-95`}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="min-w-0">
            <h2 className={`text-xl md:text-3xl font-black truncate leading-tight ${textTitle}`}>{order.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-black uppercase rounded border border-green-500/20">{t.studioLocked}</span>
              <p className="text-gray-500 text-[10px] md:text-sm font-medium">{order.jobs.length} {t.assets}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstantZip}
            disabled={isZipping}
            className={`flex-1 sm:flex-none px-6 py-3.5 rounded-2xl ${btnAccent} text-white text-sm font-black shadow-xl shadow-blue-900/10 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-60`}
          >
            {isZipping ? <i className="fa-solid fa-sync animate-spin"></i> : <i className="fa-solid fa-file-zipper"></i>}
            {isZipping ? 'Wird erstellt…' : `${t.batchExport} (ZIP)`}
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
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">{t.perspective}</span>
                <span className={`text-[12px] font-black ${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'} uppercase`}>
                  {t[selectedJob?.angle] || selectedJob?.angle?.replace(/_/g, ' ')}
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
                >{t.result}</button>
                <button
                  onClick={() => setCompareMode('side-by-side')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${compareMode === 'side-by-side' ? `${theme === 'light' ? 'bg-white text-gold-dark shadow-sm' : 'bg-blue-600 text-white'}` : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'}`}
                >{t.compare}</button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Picker */}
              {onRetryJob && (
                <div className="relative">
                  <button
                    onClick={() => { setShowCategoryPicker(!showCategoryPicker); setShowAnglePicker(false); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${theme === 'light' ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25'}`}
                  >
                    <i className={`fa-solid ${IMAGE_CATEGORIES.find(c => c.id === selectedCategory)?.icon || 'fa-car'}`}></i>
                    {IMAGE_CATEGORIES.find(c => c.id === selectedCategory)?.label || 'Ext.'}
                    <i className="fa-solid fa-chevron-down text-[8px]"></i>
                  </button>
                  {showCategoryPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCategoryPicker(false)} />
                      <div className={`absolute top-full mt-2 right-0 z-50 rounded-2xl border shadow-2xl min-w-[160px] overflow-hidden ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}>
                        {IMAGE_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => { setSelectedCategory(cat.id); setShowCategoryPicker(false); }}
                            className={`w-full px-4 py-2.5 text-left text-[11px] font-bold flex items-center gap-3 transition-colors ${selectedCategory === cat.id
                              ? (theme === 'dark' ? 'bg-purple-600/20 text-purple-400' : 'bg-purple-50 text-purple-600')
                              : (theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50')
                              }`}
                          >
                            <i className={`fa-solid ${cat.icon} w-4 text-center`}></i>
                            {cat.label}
                            {selectedCategory === cat.id && <i className="fa-solid fa-check ml-auto text-green-500 text-[9px]"></i>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}


              {/* Retry Button */}
              {onRetryJob && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${theme === 'light' ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25'}`}
                >
                  {isRetrying ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-rotate-right"></i>}
                  {isRetrying ? 'Läuft…' : 'Retry'}
                </button>
              )}

              {/* Download Photo */}
              <button
                onClick={handleDownload}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl ${theme === 'light' ? 'bg-gold-dark text-white' : 'bg-white text-black'} text-[11px] font-black hover:scale-105 transition-transform shadow-lg shadow-black/20`}
              >
                <i className="fa-solid fa-download"></i> {t.downloadPhoto}
              </button>
            </div>
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
                    className={`max-w-full max-h-full object-contain drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)] ${!selectedJob.processedImage || isRetrying ? 'opacity-40 blur-sm' : 'opacity-100'}`}
                  />
                  {(!selectedJob.processedImage || isRetrying) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">{isRetrying ? 'Retrying…' : t.processingNeural}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row gap-4 p-2 md:p-4 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex-1 relative group bg-black/40 rounded-3xl overflow-hidden border border-white/5 ring-1 ring-white/10">
                    <img src={selectedJob.originalImage} className="w-full h-full object-contain p-2" />
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest border border-white/10 uppercase">{t.inputAsset}</div>
                  </div>
                  <div className="flex-1 relative group bg-black/40 rounded-3xl overflow-hidden border border-white/5 ring-1 ring-white/10 shadow-2xl">
                    <img src={selectedJob.processedImage || selectedJob.originalImage} className={`w-full h-full object-contain p-2 ${!selectedJob.processedImage ? 'opacity-20' : ''}`} />
                    <div className={`absolute top-3 left-3 ${theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600'} text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase shadow-xl`}>{t.aiRender}</div>
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

          {/* Rapid Asset Browser */}
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
                    {t[job.angle] || job.angle.replace(/_/g, ' ')}
                  </div>

                  {(job.status === 'pending' || job.status === 'processing') && (
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
              {t.safetyCheck}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500 uppercase tracking-widest">{t.carPreservation}</span>
                <span className="text-green-500 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i> {t.bitPerfect}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500 uppercase tracking-widest">{t.envAlignment}</span>
                <span className={`uppercase ${theme === 'light' ? 'text-gold-dark' : 'text-blue-500'}`}>{t.studioLockedStatus}</span>
              </div>
              <div className={`p-4 rounded-2xl ${theme === 'light' ? 'bg-gray-50' : 'bg-[#0d0d0d]'} border ${borderCol} mt-4`}>
                <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                  {t.safetyDesc}
                </p>
              </div>
            </div>
          </div>


          <div className={`${cardBg} rounded-3xl border ${borderCol} p-6 shadow-xl`}>
            <h3 className={`text-sm font-black mb-5 ${textTitle}`}>{t.distributionReady}</h3>
            <div className="space-y-4">
              <div className={`p-5 rounded-2xl border border-dashed ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-black/40 border-white/5'} flex flex-col items-center text-center`}>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-3">
                  <i className="fa-solid fa-check-double"></i>
                </div>
                <p className={`text-xs font-black mb-1 ${textTitle}`}>{t.assetOptimized}</p>
                <p className="text-[10px] text-gray-500 mb-6 font-medium">{t.assetOptimizedDesc}</p>

                <button
                  onClick={handleInstantZip}
                  disabled={isZipping}
                  className={`w-full py-3 rounded-xl ${theme === 'light' ? 'bg-white border-gray-200 text-gray-900' : 'bg-white/5 border-white/10 text-white'} border text-[11px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-sm active:scale-95 disabled:opacity-50`}
                >
                  {isZipping ? 'Wird erstellt…' : t.configureBatch}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button className={`flex items-center justify-center py-3 rounded-xl ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} border ${borderCol} text-[9px] font-black uppercase tracking-wider hover:border-blue-500/50 transition-all active:scale-95`}>
                  {t.mobileSync}
                </button>
                <button className={`flex items-center justify-center py-3 rounded-xl ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} border ${borderCol} text-[9px] font-black uppercase tracking-wider hover:border-orange-500/50 transition-all active:scale-95`}>
                  {t.autoscoutLink}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal for Unregistered Users */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title={t.accountRequired}
        description={t.accountRequiredDesc}
      />
    </div>
  );
};

export default OrderDetails;
