
import React, { useState } from 'react';
import { CameraAngle, ProcessingJob } from '../types';
import { CAMERA_ANGLES } from '../constants';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { Trash2, GripVertical, CheckCircle2, ArrowRight, Camera } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PhotoReviewProps {
    images: { angle: CameraAngle; data: string }[];
    onConfirm: (images: { angle: CameraAngle; data: string }[]) => void;
    onBack: () => void;
    theme: 'light' | 'dark';
}

const PhotoReview: React.FC<PhotoReviewProps> = ({ images: initialImages, onConfirm, onBack, theme }) => {
    const { t } = useLanguage();
    const [images, setImages] = useState(initialImages.map((img, i) => ({ ...img, id: `img-${i}` })));

    return (
        <div className="flex flex-col gap-4 py-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
                        {t('photoReviewTitle' as any)}
                    </h2>
                    <p className="text-zinc-400">
                        {t('photoReviewDesc' as any)}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onBack}
                        className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                    >
                        {t('cancel' as any)}
                    </button>
                    <button
                        onClick={() => onConfirm(images.map(({ angle, data }) => ({ angle, data })))}
                        className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all flex items-center gap-2"
                    >
                        {t('confirmProcessing' as any)}
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            <Reorder.Group
                axis="y"
                values={images}
                onReorder={setImages}
                className="grid gap-3"
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    {images.map((img) => (
                        <Reorder.Item
                            key={img.id}
                            value={img}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            whileDrag={{
                                scale: 1.02,
                                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)",
                                zIndex: 50
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 40,
                                mass: 1
                            }}
                            className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all ${theme === 'light' ? 'bg-white border-gray-100' : 'bg-zinc-900 border-white/5'
                                }`}
                        >
                            <div className="cursor-grab active:cursor-grabbing p-2 text-zinc-600 hover:text-white transition-colors">
                                <GripVertical />
                            </div>

                            <div className="w-24 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                <img src={img.data} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-0.5">
                                    {CAMERA_ANGLES.find(a => a.id === img.angle)?.label ? t(CAMERA_ANGLES.find(a => a.id === img.angle)!.label as any) : img.angle}
                                </p>
                                <h4 className="text-lg font-bold text-white truncate">
                                    Aufnahme {images.indexOf(img) + 1}
                                </h4>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                                    className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                >
                                    <Trash2 size={20} />
                                </button>
                                <div className="p-2 text-green-500">
                                    <CheckCircle2 size={24} />
                                </div>
                            </div>
                        </Reorder.Item>
                    ))}
                </AnimatePresence>
            </Reorder.Group>

            {images.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[40px]">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <Camera className="text-zinc-600" />
                    </div>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">{t('noPhotosSelected' as any)}</p>
                </div>
            )}
        </div>
    );
};

export default PhotoReview;
