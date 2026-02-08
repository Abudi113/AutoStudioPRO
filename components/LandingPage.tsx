
import React from 'react';
import { Camera, Zap, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const LandingPage: React.FC = () => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const bgClass = theme === 'light' ? 'bg-white' : 'bg-[#0a0a0a]';
    const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
    const textBody = theme === 'light' ? 'text-gray-600' : 'text-gray-400';
    const sectionBg = theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900/50';

    return (
        <div className={`min-h-screen ${bgClass} transition-colors duration-300`}>
            {/* Hero Section */}
            <div className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-4 overflow-hidden">
                <div className="max-w-7xl mx-auto relative z-10 text-center">
                    <h1 className={`text-6xl md:text-8xl font-black mb-6 tracking-tighter ${textTitle}`}>
                        {t('heroTitle').split('.').map((part: string, i: number) => (
                            <span key={i}>{part}{i === 0 && <br />}</span>
                        ))}
                    </h1>
                    <p className={`${textBody} text-xl md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed`}>
                        {t('heroSubtitle')}
                    </p>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                        <Link
                            to="/create"
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 group"
                        >
                            {t('getStartedFree')}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            to="/pricing"
                            className={`px-8 py-4 ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-900' : 'bg-white/5 hover:bg-white/10 text-white'} rounded-full font-bold text-lg transition-all`}
                        >
                            {t('viewPricing')}
                        </Link>
                    </div>
                </div>

                {/* Ambient Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none -z-10" />
            </div>

            {/* Comparison Demos */}
            <div className="max-w-7xl mx-auto px-4 mb-32 grid md:grid-cols-3 gap-8">
                {[
                    {
                        before: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=1000&auto=format&fit=crop",
                        after: "https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=1000&auto=format&fit=crop"
                    },
                    {
                        before: "https://images.unsplash.com/photo-1580273916550-e323be2eb0d4?q=80&w=1000&auto=format&fit=crop",
                        after: "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?q=80&w=1000&auto=format&fit=crop"
                    },
                    {
                        before: "https://images.unsplash.com/photo-1503376763036-066120622c74?q=80&w=1000&auto=format&fit=crop",
                        after: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=1000&auto=format&fit=crop"
                    }
                ].map((demo, index) => (
                    <div key={index} className="relative rounded-3xl overflow-hidden border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-500 group h-[400px]">
                        <div className="absolute inset-0 grid grid-cols-2">
                            <div className="relative h-full">
                                <img
                                    src={demo.before}
                                    alt="Original"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                    <span className="text-xs font-bold text-white tracking-widest">{t('before')}</span>
                                </div>
                            </div>
                            <div className="relative h-full">
                                <img
                                    src={demo.after}
                                    alt="Processed"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1 rounded-full shadow-lg shadow-blue-500/20">
                                    <span className="text-xs font-bold text-white tracking-widest">{t('after')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-full shadow-2xl scale-0 group-hover:scale-100 transition-transform duration-500 delay-75">
                                <Zap className="w-8 h-8 text-white fill-yellow-400" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Features Grid */}
            <div className={`${sectionBg} py-32`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-20">
                        <h2 className={`text-sm font-bold text-blue-500 tracking-widest uppercase mb-3`}>{t('carveoAdvantage')}</h2>
                        <h3 className={`text-4xl md:text-5xl font-black ${textTitle} max-w-3xl mx-auto`}>
                            {t('carveoAdvantageSubtitle')}
                        </h3>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Zap className="w-6 h-6 text-yellow-400" />}
                            title={t('featureSpeedTitle')}
                            desc={t('featureSpeedDesc')}
                            bg={theme === 'light' ? 'bg-white' : 'bg-black'}
                            border={theme === 'light' ? 'border-gray-200' : 'border-white/10'}
                            textTitle={textTitle}
                            textBody={textBody}
                        />
                        <FeatureCard
                            icon={<Camera className="w-6 h-6 text-blue-400" />}
                            title={t('featureConsistencyTitle')}
                            desc={t('featureConsistencyDesc')}
                            bg={theme === 'light' ? 'bg-white' : 'bg-black'}
                            border={theme === 'light' ? 'border-gray-200' : 'border-white/10'}
                            textTitle={textTitle}
                            textBody={textBody}
                        />
                        <FeatureCard
                            icon={<Check className="w-6 h-6 text-green-400" />}
                            title={t('featureComplianceTitle')}
                            desc={t('featureComplianceDesc')}
                            bg={theme === 'light' ? 'bg-white' : 'bg-black'}
                            border={theme === 'light' ? 'border-gray-200' : 'border-white/10'}
                            textTitle={textTitle}
                            textBody={textBody}
                        />
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="py-32 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-900'} rounded-3xl border ${theme === 'light' ? 'border-gray-200' : 'border-white/10'} overflow-hidden shadow-2xl`}>
                        <div className="grid grid-cols-3 p-6 md:p-10 border-b border-white/5 bg-gradient-to-r from-blue-900/20 to-transparent">
                            <div className="col-span-1"></div>
                            <div className="col-span-1 text-center font-black text-xl md:text-2xl text-blue-500 tracking-tighter">CARVEO AI</div>
                            <div className="col-span-1 text-center font-bold text-gray-500">{t('traditionalStudio')}</div>
                        </div>

                        {[
                            { f: t('featureProcessingTime'), c: t('valSeconds'), t: t('valDays') },
                            { f: t('featureCost'), c: "$0.50 - $2.00", t: "$50 - $150" },
                            { f: t('featureLighting'), c: "100% Perfect", t: t('valVariable') },
                            { f: t('featureWeather'), c: t('valNever'), t: t('valYes') },
                            { f: t('featureTurnaround'), c: t('valInstant'), t: t('valSlow') },
                            { f: t('featureBackgrounds'), c: t('valUnlimited'), t: t('valPhysicalOnly') }
                        ].map((row, i) => (
                            <div key={i} className={`grid grid-cols-3 p-6 border-b ${theme === 'light' ? 'border-gray-100' : 'border-white/5'} hover:bg-white/5 transition-colors`}>
                                <div className={`font-bold ${textTitle}`}>{row.f}</div>
                                <div className="text-center font-bold text-blue-400">{row.c}</div>
                                <div className="text-center font-medium text-gray-500">{row.t}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Footer */}
            <div className="relative py-32 px-4 overflow-hidden">
                <div className="absolute inset-0 bg-blue-900/10 pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className={`text-5xl md:text-7xl font-black mb-8 ${textTitle} tracking-tighter`}>
                        {t('readyToDominate')}
                    </h2>
                    <p className={`${textBody} text-xl mb-12`}>
                        {t('joinDealers')}
                    </p>
                    <Link
                        to="/create"
                        className="inline-flex px-12 py-6 bg-white text-black rounded-full font-black text-xl hover:scale-105 transition-transform shadow-2xl shadow-white/20"
                    >
                        {t('launchStudio')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, bg, border, textTitle, textBody }: any) => (
    <div className={`${bg} p-8 rounded-3xl border ${border} hover:border-blue-500/50 transition-colors group`}>
        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className={`text-xl font-bold mb-2 ${textTitle}`}>{title}</h3>
        <p className={`${textBody} leading-relaxed`}>{desc}</p>
    </div>
);

export default LandingPage;
