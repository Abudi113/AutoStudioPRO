
import React from 'react';
import { STUDIO_PRESETS } from '../constants';
import { StudioTemplate } from '../types';

interface StudioPickerProps {
  selectedStudio: StudioTemplate;
  onSelect: (studio: StudioTemplate) => void;
  onNext: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const StudioPicker: React.FC<StudioPickerProps> = ({ selectedStudio, onSelect, onNext, t, theme }) => {
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const btnAccent = theme === 'light' ? 'bg-gold-dark hover:bg-gold-light' : 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-900/20';

  return (
    <div className="max-w-6xl mx-auto py-2 h-full flex flex-col px-1">
      <header className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="text-center sm:text-left">
          <h2 className={`text-2xl md:text-4xl font-black mb-2 ${textTitle}`}>{t.selectStudio}</h2>
          <p className="text-gray-500 text-sm md:text-base font-medium">{t.subtitle}</p>
        </div>
        <button 
          onClick={onNext}
          className={`${btnAccent} w-full sm:w-auto text-white px-12 py-4.5 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-3`}
        >
          {t.nextCapture}
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-14 flex-1 overflow-y-auto pr-1 pb-10">
        {STUDIO_PRESETS.map((studio) => (
          <div 
            key={studio.id}
            onClick={() => onSelect(studio)}
            className={`group cursor-pointer rounded-[32px] overflow-hidden border-2 transition-all relative aspect-video shadow-xl ${
              selectedStudio.id === studio.id 
              ? (theme === 'light' ? 'border-gold-dark ring-8 ring-gold-dark/10' : 'border-blue-500 ring-8 ring-blue-500/10 shadow-2xl')
              : `border-${theme === 'light' ? 'gray-200' : 'white/5'} hover:border-gray-400 dark:hover:border-white/20`
            }`}
          >
            <img 
              src={studio.thumbnail} 
              alt={studio.name}
              className={`w-full h-full object-cover transition-all duration-700 ${selectedStudio.id === studio.id ? 'scale-110' : 'grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105'}`}
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none"></div>
            
            <div className="absolute top-5 left-5 md:top-8 md:left-8">
              <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 ${
                studio.category === 'Premium' ? 'bg-yellow-500 text-black' : (theme === 'light' ? 'bg-gold-dark text-white' : 'bg-blue-600 text-white')
              }`}>
                {studio.category}
              </span>
            </div>

            <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 pointer-events-none">
              <h4 className="text-xl md:text-3xl font-black mb-2 text-white tracking-tight leading-tight">{studio.name}</h4>
              <p className="text-gray-300 text-xs md:text-base font-medium line-clamp-1 opacity-90">{studio.description}</p>
            </div>

            {selectedStudio.id === studio.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                 <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full ${theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600'} flex items-center justify-center shadow-2xl animate-in zoom-in-50 duration-300 border-4 border-white/20`}>
                    <i className="fa-solid fa-check text-white text-3xl md:text-5xl"></i>
                 </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudioPicker;
