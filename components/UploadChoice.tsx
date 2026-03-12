
import React, { useState } from 'react';
import { CameraAngle } from '../types';
import PhotoGuide from './PhotoGuide';
import { HelpCircle } from 'lucide-react';

interface UploadChoiceProps {
  onSelectCamera: () => void;
  onUploadComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const UploadChoice: React.FC<UploadChoiceProps> = ({ onSelectCamera, onUploadComplete, onBack, t, theme }) => {
  const [showGuide, setShowGuide] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files) as File[];
      const results: { angle: CameraAngle; data: string }[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Auto-assign AUTO — the edge function will classify the image
        results.push({ angle: 'AUTO', data: base64 });
      }

      // Skip tagging — go directly to processing
      onUploadComplete(results);
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-center py-6 px-4">
      {/* Existing Return JSX */}
      <div className="absolute top-8 right-8">
        <button
          onClick={() => setShowGuide(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[var(--card)] text-[var(--foreground)] hover:bg-blue-500/10 hover:text-blue-500 border border-[var(--border)] hover:border-blue-500/20`}
        >
          <HelpCircle className="w-4 h-4" />
          {t.tips}
        </button>
      </div>
      <header className="mb-20 text-center">
        <h2 className="text-3xl md:text-5xl font-black mb-4 text-[var(--foreground)] tracking-tight">{t.howToProceed}</h2>
        <p className="text-gray-500 text-base md:text-lg font-medium">{t.uploadSubtitle || 'Lade deine Fotos hoch — die KI erkennt den Bildtyp automatisch.'}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 mb-20">
        <button
          onClick={onSelectCamera}
          className={`group flex flex-col items-center p-12 rounded-[48px] border-2 transition-all hover:translate-y-[-10px] bg-[var(--card)] border-[var(--border)] shadow-lg hover:border-blue-500 hover:shadow-2xl shadow-blue-900/10`}
        >
          <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center mb-10 transition-all group-hover:scale-110 group-hover:rotate-3 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-600/10'}`}>
            <i className={`fa-solid fa-camera text-6xl ${theme === 'light' ? 'text-blue-600' : 'text-blue-500'}`}></i>
          </div>
          <h3 className={`text-3xl font-black mb-4 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.takePhotos || "Take Photos"}</h3>
          <p className={`text-center leading-relaxed font-medium max-w-[280px] ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>{t.takePhotosDesc || "Use our guided AI assistant to capture perfect angles."}</p>
        </button>

        <label
          className={`group flex flex-col items-center p-12 rounded-[48px] border-2 transition-all hover:translate-y-[-10px] cursor-pointer bg-[var(--card)] border-[var(--border)] shadow-lg hover:border-blue-500 hover:shadow-2xl shadow-blue-900/10`}
        >
          <input type="file" multiple className="hidden" accept="image/*" onChange={handleFileChange} />
          <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center mb-10 transition-all group-hover:scale-110 group-hover:-rotate-3 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-600/10'}`}>
            <i className={`fa-solid fa-cloud-arrow-up text-6xl ${theme === 'light' ? 'text-blue-600' : 'text-blue-500'}`}></i>
          </div>
          <h3 className={`text-3xl font-black mb-4 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.uploadPhotos || "Batch Upload"}</h3>
          <p className={`text-center leading-relaxed font-medium max-w-[280px] ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>{t.uploadPhotosDesc || "Select multiple car photos at once for automated batch processing."}</p>
        </label>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all text-gray-500 hover:text-[var(--foreground)] hover:bg-[var(--card)]"
        >
          <i className="fa-solid fa-arrow-left"></i>
          {t.backToStudio}
        </button>
      </div>
      {showGuide && <PhotoGuide onClose={() => setShowGuide(false)} theme={theme} />}
    </div>
  );
};

export default UploadChoice;
