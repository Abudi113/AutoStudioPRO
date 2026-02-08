
import React, { useState } from 'react';
import { CameraAngle } from '../types';
import PhotoGuide from './PhotoGuide';
import { HelpCircle, Car, Armchair, ZoomIn, Check, X } from 'lucide-react';

interface UploadChoiceProps {
  onSelectCamera: () => void;
  onUploadComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  t: any;
  theme: 'light' | 'dark';
}

interface TaggingItem {
  file: File;
  base64: string;
  angle: CameraAngle;
}

const UploadChoice: React.FC<UploadChoiceProps> = ({ onSelectCamera, onUploadComplete, onBack, t, theme }) => {
  const [showGuide, setShowGuide] = useState(false);

  // Tagging State
  const [taggingItems, setTaggingItems] = useState<TaggingItem[]>([]);
  const [isTagging, setIsTagging] = useState(false);

  // Use CSS variables and logical classes instead of JS conditional styles where possible for background/borders
  // But keep accent colors conditional if they differ significantly in logic beyond simple semantic mapping

  // Common styles mapped to CSS variables
  const cardStyles = "bg-[var(--card)] border-[var(--border)] shadow-lg";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files) as File[];
      const newItems: TaggingItem[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Default to EXTERIOR_CAR
        newItems.push({
          file,
          base64,
          angle: 'EXTERIOR_CAR'
        });
      }

      setTaggingItems(newItems);
      setIsTagging(true);
    }
  };

  const handleUpdateAngle = (index: number, newAngle: CameraAngle) => {
    const updated = [...taggingItems];
    updated[index].angle = newAngle;
    setTaggingItems(updated);
  };

  const handleProcess = () => {
    const results = taggingItems.map(item => ({
      angle: item.angle,
      data: item.base64
    }));
    onUploadComplete(results);
  };

  const handleCancelTagging = () => {
    setTaggingItems([]);
    setIsTagging(false);
  };

  // TAGGING UI GRID
  if (isTagging) {
    return (
      <div className="max-w-7xl mx-auto h-full flex flex-col py-6 px-4">
        <header className="mb-8 flex justify-between items-center bg-[var(--card)]/50 p-6 rounded-2xl backdrop-blur-sm border border-[var(--border)]">
          <div>
            <h2 className="text-3xl font-black text-[var(--foreground)] mb-1">{t.tagYourPhotos}</h2>
            <p className="text-gray-500 text-sm">{t.tagSubtitle}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleCancelTagging}
              className="px-6 py-3 rounded-xl font-bold text-sm bg-[var(--border)]/10 text-[var(--foreground)] hover:opacity-80 transition-all"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleProcess}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm text-white shadow-lg transform hover:scale-105 transition-all bg-blue-600 hover:bg-blue-500"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              {t.startProcessing} ({taggingItems.length})
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-20">
          {taggingItems.map((item, idx) => (
            <div key={idx} className={`relative group ${cardStyles} rounded-2xl overflow-hidden flex flex-col`}>
              <div className="relative aspect-[4/3] bg-gray-900 border-b border-[var(--border)]">
                <img src={item.base64} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="Upload" />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{item.angle.replace('_CAR', '')}</span>
                </div>
              </div>

              <div className="p-4 grid grid-cols-3 gap-2 flex-1 items-center">
                <button
                  onClick={() => handleUpdateAngle(idx, 'EXTERIOR_CAR')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${item.angle === 'EXTERIOR_CAR' ? (theme === 'light' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-600 text-white border-blue-600') : 'bg-[var(--background)] text-gray-500 border-[var(--border)] hover:bg-[var(--foreground)]/5'}`}
                >
                  <Car className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase">{t.exterior}</span>
                </button>

                <button
                  onClick={() => handleUpdateAngle(idx, 'INTERIOR_CAR')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${item.angle === 'INTERIOR_CAR' ? 'bg-green-600 text-white border-green-600' : 'bg-[var(--background)] text-gray-500 border-[var(--border)] hover:bg-[var(--foreground)]/5'}`}
                >
                  <Armchair className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase">{t.interior}</span>
                </button>

                <button
                  onClick={() => handleUpdateAngle(idx, 'DETAIL_CAR')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${item.angle === 'DETAIL_CAR' ? 'bg-purple-600 text-white border-purple-600' : 'bg-[var(--background)] text-gray-500 border-[var(--border)] hover:bg-[var(--foreground)]/5'}`}
                >
                  <ZoomIn className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase">{t.detail}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Helper Footer */}
        <div className={`fixed bottom-0 left-0 right-0 p-4 border-t backdrop-blur-md z-10 flex justify-center gap-8 text-xs font-medium text-gray-500 py-4 bg-[var(--background)]/90 border-[var(--border)]`}>
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-500" />
            <span>{t.exteriorDesc}</span>
          </div>
          <div className="flex items-center gap-2">
            <Armchair className="w-4 h-4 text-green-500" />
            <span>{t.interiorDesc}</span>
          </div>
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-purple-500" />
            <span>{t.detailDesc}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col justify-center py-6 px-4">
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
        <p className="text-gray-500 text-base md:text-lg font-medium">{t.tagSubtitle}</p>
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
