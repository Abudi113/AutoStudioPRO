
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Lightbulb, Move, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PhotoGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const PhotoGuide: React.FC<PhotoGuideProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();

    const tips = [
        {
            icon: <Camera className="w-5 h-5 text-blue-500" />,
            title: t('tipAnglesTitle'),
            desc: t('tipAnglesDesc')
        },
        {
            icon: <Lightbulb className="w-5 h-5 text-yellow-500" />,
            title: t('tipSunTitle'),
            desc: t('tipSunDesc')
        },
        {
            icon: <Move className="w-5 h-5 text-green-500" />,
            title: t('tipSpaceTitle'),
            desc: t('tipSpaceDesc')
        },
        {
            icon: <CheckCircle2 className="w-5 h-5 text-purple-500" />,
            title: t('tipCleanTitle'),
            desc: t('tipCleanDesc')
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl z-[101] overflow-hidden"
                    >
                        <div className="p-6 md:p-8 flex flex-col gap-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-white">{t('guideTitle')}</h2>
                                    <p className="text-gray-400 text-sm">{t('guideSubtitle')}</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {tips.map((tip, i) => (
                                    <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex gap-4">
                                        <div className="shrink-0 w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                                            {tip.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white mb-1">{tip.title}</h3>
                                            <p className="text-xs text-gray-400 leading-relaxed">{tip.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5">
                                <h4 className="text-sm font-bold text-blue-400 mb-2 uppercase tracking-widest">{t('proTipTitle')}</h4>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    {t('proTipDesc')}
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                            >
                                {t('gotIt')}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default PhotoGuide;
