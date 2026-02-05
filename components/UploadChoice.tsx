
import React, { useState } from 'react';
import { CameraAngle } from '../types';
import { detectCarAngle } from '../services/geminiService';

interface UploadChoiceProps {
  onSelectCamera: () => void;
  onUploadComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const UploadChoice: React.FC<UploadChoiceProps> = ({ onSelectCamera, onUploadComplete, onBack, t, theme }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#141414]';
  const borderCol = theme === 'light' ? 'border-gray-200' : 'border-white/10';
  const accentColor = theme === 'light' ? 'text-gold-dark' : 'text-blue-500';
  const accentIconBg = theme === 'light' ? 'bg-gold-dark/10' : 'bg-blue-600/10';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsAnalyzing(true);
      const fileList = Array.from(files) as File[];
      const results: { angle: CameraAngle; data: string }[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });

        // The detection system identifies both exterior angles and interior cabin shots
        const detectedAngle = await detectCarAngle(base64);
        results.push({ angle: detectedAngle, data: base64 });
        setAnalysisProgress(Math.round(((i + 1) / fileList.length) * 100));
      }

      setIsAnalyzing(false);
      onUploadComplete(results);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="max-w-md mx-auto h-full flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-24 h-24 mb-8 relative">
          <div className={`absolute inset-0 rounded-[2rem] border-4 ${theme === 'light' ? 'border-gold-dark/20' : 'border-blue-600/20'}`}></div>
          <div className={`absolute inset-0 rounded-[2rem] border-4 ${theme === 'light' ? 'border-gold-dark' : 'border-blue-600'} border-t-transparent animate-spin`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className={`fa-solid fa-wand-magic-sparkles ${accentColor} text-3xl animate-pulse`}></i>
          </div>
        </div>
        <h3 className={`text-2xl font-black mb-3 ${textTitle}`}>AI Vision Analyzing...</h3>
        <p className="text-gray-500 text-sm mb-10 font-medium">Scanning assets for orientation, interior identification, and geometry synchronization.</p>
        <div className={`w-full h-3 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'} rounded-full overflow-hidden shadow-inner`}>
          <div 
            className={`h-full ${theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600'} transition-all duration-300 shadow-lg`}
            style={{ width: `${analysisProgress}%` }}
          ></div>
        </div>
        <span className={`text-xs font-black mt-4 uppercase tracking-widest ${accentColor}`}>{analysisProgress}% Complete</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col justify-center py-6 px-4">
      <header className="mb-20 text-center">
        <h2 className={`text-3xl md:text-5xl font-black mb-4 ${textTitle} tracking-tight`}>{t.howToProceed}</h2>
        <p className="text-gray-500 text-base md:text-lg font-medium">{t.subtitle}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 mb-20">
        <button
          onClick={onSelectCamera}
          className={`group flex flex-col items-center p-12 rounded-[48px] border-2 transition-all hover:translate-y-[-10px] ${cardBg} ${borderCol} ${theme === 'light' ? 'hover:border-gold-dark shadow-2xl' : 'hover:border-blue-500 shadow-2xl shadow-blue-900/10'}`}
        >
          <div className={`w-28 h-28 rounded-[2rem] ${accentIconBg} flex items-center justify-center mb-10 transition-all group-hover:scale-110 group-hover:rotate-3`}>
            <i className={`fa-solid fa-camera ${accentColor} text-6xl`}></i>
          </div>
          <h3 className={`text-3xl font-black mb-4 ${textTitle}`}>{t.takePhotos}</h3>
          <p className="text-gray-500 text-base text-center leading-relaxed font-medium max-w-[280px]">{t.takePhotosDesc}</p>
        </button>

        <label
          className={`group flex flex-col items-center p-12 rounded-[48px] border-2 transition-all hover:translate-y-[-10px] cursor-pointer ${cardBg} ${borderCol} ${theme === 'light' ? 'hover:border-gold-dark shadow-2xl' : 'hover:border-blue-500 shadow-2xl shadow-blue-900/10'}`}
        >
          <input type="file" multiple className="hidden" accept="image/*" onChange={handleFileChange} />
          <div className={`w-28 h-28 rounded-[2rem] ${accentIconBg} flex items-center justify-center mb-10 transition-all group-hover:scale-110 group-hover:-rotate-3`}>
            <i className={`fa-solid fa-cloud-arrow-up ${accentColor} text-6xl`}></i>
          </div>
          <h3 className={`text-3xl font-black mb-4 ${textTitle}`}>{t.uploadPhotos}</h3>
          <p className="text-gray-500 text-base text-center leading-relaxed font-medium max-w-[280px]">{t.uploadPhotosDesc}</p>
        </label>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onBack}
          className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${theme === 'light' ? 'text-gray-400 hover:text-gold-dark hover:bg-gray-100' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
        >
          <i className="fa-solid fa-arrow-left"></i>
          {t.backToStudio}
        </button>
      </div>
    </div>
  );
};

export default UploadChoice;
