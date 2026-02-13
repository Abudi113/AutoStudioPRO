
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Zap, Check, ArrowRight, Lightbulb, Star, ChevronDown, ShieldCheck, Rocket, Crosshair } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { submitDemoRequest } from '../services/demoRequestService';

// --- Reusable Components ---

const SectionWrapper = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
    return <div style={{ animationDelay: `${delay}s` }}>{children}</div>;
};

const BeforeAfterSection = ({ t, theme }: any) => {
    const [activeTab, setActiveTab] = useState<'exterior' | 'interior'>('exterior');
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Placeholders - USER: REPLACE THESE WITH YOUR OWN MATCHING BEFORE/AFTER IMAGES
    const images = {
        exterior: {
            before: "/demo/exterior-before.jpg",
            after: "/demo/exterior-after.png"
        },
        interior: {
            before: "/demo/interior-before.avif",
            after: "/demo/interior-after.avif"
        }
    };

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        setSliderPos(Math.min(100, Math.max(0, percentage)));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        handleMove(e.clientX);
    };
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        handleMove(e.clientX);
    };
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const currentImages = images[activeTab];

    return (
        <div className={`py-16 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} overflow-hidden`}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6">
                        {t('professionalSoftware')}
                    </span>
                    <h2 className={`text-4xl md:text-5xl font-black mb-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        {t('beforeAfterTitle')}
                    </h2>
                    <p className={`text-xl max-w-3xl mx-auto ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('beforeAfterSubtitle')}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex justify-center mb-12">
                    <div className={`p-1.5 rounded-full ${theme === 'light' ? 'bg-white border border-gray-200 shadow-lg' : 'bg-white/10 border border-white/10'}`}>
                        <button
                            onClick={() => setActiveTab('exterior')}
                            className={`px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'exterior' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('exterior')}
                        </button>
                        <button
                            onClick={() => setActiveTab('interior')}
                            className={`px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'interior' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('interior')}
                        </button>
                    </div>
                </div>

                {/* Slider */}
                <div
                    ref={containerRef}
                    className="relative w-full max-w-5xl mx-auto aspect-[4/3] md:aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl select-none border-4 border-white/10 group touch-pan-y"
                >
                    {/* After Image (Background) */}
                    <img
                        src={currentImages.after}
                        alt="After"
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                    />
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600/90 backdrop-blur-md rounded-lg shadow-lg z-10 pointer-events-none">
                        <span className="text-white font-bold tracking-widest text-xs md:text-sm">AFTER</span>
                    </div>

                    {/* Before Image (Clipped) */}
                    <div
                        className="absolute inset-y-0 left-0 overflow-hidden z-20"
                        style={{ width: `${sliderPos}%` }}
                    >
                        <div className="absolute inset-0 w-full h-full bg-black/50" /> {/* Optional overlay */}
                        <img
                            src={currentImages.before}
                            alt="Before"
                            className="absolute inset-0 max-w-none h-full object-cover"
                            style={{ width: containerWidth > 0 ? containerWidth : '100%' }}
                            draggable={false}
                        />
                        <div className="absolute top-4 left-4 md:top-6 md:left-6 px-3 py-1.5 md:px-4 md:py-2 bg-black/60 backdrop-blur-md rounded-lg shadow-lg border border-white/10 pointer-events-none">
                            <span className="text-white font-bold tracking-widest text-xs md:text-sm">BEFORE</span>
                        </div>
                    </div>

                    {/* Slider Handle */}
                    <div
                        className="absolute inset-y-0 w-1 bg-white cursor-col-resize z-30 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:bg-blue-400 transition-colors touch-none"
                        style={{ left: `${sliderPos}%` }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <div className="flex gap-1">
                                <ArrowRight className="w-4 h-4 text-blue-600 rotate-180" />
                                <ArrowRight className="w-4 h-4 text-blue-600" />
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-6 text-gray-500 italic text-sm">
                    {t('dragToCompare')}
                </p>
            </div>
        </div>
    );
};

const StatsSection = ({ t, theme }: any) => {
    const stats = [
        {
            value: "65%",
            label: "Time Saving",
            desc: t('statTimeDesc'),
            color: "text-blue-500",
            barColor: "bg-blue-500",
            width: "65%"
        },
        {
            value: "55%",
            label: "Cost Saving",
            desc: t('statCostDesc'),
            color: "text-red-500",
            barColor: "bg-red-500",
            width: "55%"
        },
        {
            value: "94%",
            label: "Better Conversion",
            desc: t('statConversionDesc'),
            color: "text-green-500",
            barColor: "bg-green-500",
            width: "94%"
        },
        {
            value: "1-7 Days",
            label: "Faster Sales",
            desc: "Sell cars significantly faster with premium presentation.",
            color: "text-purple-500",
            barColor: "bg-purple-500",
            width: "80%"
        }
    ];

    return (
        <div className={`py-24 px-4 ${theme === 'light' ? 'bg-white' : 'bg-black'} overflow-hidden`}>
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6">
                        Results
                    </span>
                    <h2 className={`text-5xl md:text-7xl font-black mb-8 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('statsTitle')}
                    </h2>
                    <p className={`text-xl md:text-2xl max-w-3xl mx-auto ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('statsSubtitle')}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className={`col-span-1 p-10 rounded-3xl ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500`}>
                        <div className="relative z-10">
                            <h3 className={`text-7xl font-black mb-2 ${stats[0].color} tracking-tighter`}>
                                {stats[0].value}
                            </h3>
                            <p className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-6">{stats[0].label}</p>
                            <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} max-w-md`}>
                                {stats[0].desc}
                            </p>
                        </div>
                        <div className="mt-12 w-full h-4 bg-gray-200/20 rounded-full overflow-hidden">
                            <div className={`h-full ${stats[0].barColor} rounded-full`} style={{ width: stats[0].width }}></div>
                        </div>
                        <div className={`absolute -right-20 -bottom-20 w-64 h-64 ${stats[0].barColor} opacity-5 blur-[100px] rounded-full`} />
                    </div>

                    <div className={`col-span-1 p-10 rounded-3xl ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500`}>
                        <div className="relative z-10">
                            <h3 className={`text-7xl font-black mb-2 ${stats[1].color} tracking-tighter`}>
                                {stats[1].value}
                            </h3>
                            <p className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-6">{stats[1].label}</p>
                            <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} max-w-md`}>
                                {stats[1].desc}
                            </p>
                        </div>
                        <div className="mt-12 flex items-end gap-4 h-32 opacity-80">
                            <div className="w-1/3 h-full bg-gray-500/20 rounded-t-xl relative group-hover:h-[80%] transition-all duration-1000">
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-500">Others</span>
                            </div>
                            <div className={`w-1/3 h-[45%] ${stats[1].barColor} rounded-t-xl relative`}>
                                <span className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold ${stats[1].color}`}>Carveo</span>
                            </div>
                        </div>
                    </div>

                    <div className={`col-span-1 md:col-span-1 p-10 rounded-3xl ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500`}>
                        <div className="relative z-10">
                            <h3 className={`text-7xl font-black mb-2 ${stats[2].color} tracking-tighter`}>
                                {stats[2].value}
                            </h3>
                            <p className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-6">{stats[2].label}</p>
                            <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} max-w-md`}>
                                {stats[2].desc}
                            </p>
                        </div>
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 opacity-10">
                            <Zap className="w-64 h-64" />
                        </div>
                    </div>

                    <div className={`col-span-1 md:col-span-1 p-10 rounded-3xl bg-blue-600 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 shadow-2xl shadow-blue-500/20`}>
                        <div className="relative z-10">
                            <h3 className={`text-6xl md:text-7xl font-black mb-2 tracking-tighter`}>
                                {stats[3].value}
                            </h3>
                            <p className="text-xl font-bold uppercase tracking-widest text-blue-200 mb-6">{stats[3].label}</p>
                            <p className={`text-lg text-blue-100 max-w-md`}>
                                {stats[3].desc}
                            </p>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/20 blur-[50px] rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const HowItWorksSection = ({ t, theme }: any) => {
    const steps = [
        {
            num: "01",
            title: t('step2Title'),
            desc: t('step2Desc'),
            img: "/demo/step1.png"
        },
        {
            num: "02",
            title: t('step1Title'),
            desc: t('step1Desc'),
            img: "/demo/step2.png"
        },
        {
            num: "03",
            title: t('step3Title'),
            desc: t('step3Desc'),
            img: "/demo/step3.png"
        }
    ];

    return (
        <div id="how-it-works" className={`py-24 px-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6">
                        {t('howItWorks')}
                    </span>
                    <h2 className={`text-5xl md:text-6xl font-black mb-8 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('howItWorksSubtitle')}
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-14">
                    {steps.map((step, i) => (
                        <div key={i} className={`group relative rounded-[2.5rem] overflow-hidden ${theme === 'light' ? 'bg-white shadow-xl shadow-gray-200/50' : 'bg-zinc-900 border border-white/10'} hover:-translate-y-2 transition-all duration-500`}>
                            <div className="h-64 overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                                <img
                                    src={step.img}
                                    alt={step.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute top-6 left-6 w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center z-20 border border-white/20">
                                    <span className="text-white font-black text-lg">{step.num}</span>
                                </div>
                            </div>
                            <div className="p-8 relative">
                                <h3 className={`text-2xl font-bold mb-4 ${theme === 'light' ? 'text-gray-900' : 'text-white'} group-hover:text-blue-500 transition-colors`}>
                                    {step.title}
                                </h3>
                                <p className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} leading-relaxed`}>
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Link
                        to="/contact"
                        className="inline-flex px-12 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xl hover:scale-105 transition-all shadow-xl shadow-blue-500/30 items-center gap-3 group"
                    >
                        {t('demoRequestCta')}
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
};

const ComparisonSection = ({ t, theme }: any) => {
    return (
        <div className={`py-24 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} relative overflow-hidden`}>
            <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6">
                        {t('compare')}
                    </span>
                    <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('compTitle')}
                    </h2>
                    <p className={`text-lg md:text-xl mb-10 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('compSubtitle')}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
                    <div className="relative group rounded-3xl overflow-hidden border-4 border-red-500/10 hover:border-red-500/30 transition-colors bg-gray-100">
                        <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow-md">
                            {t('compBadLabel')}
                        </div>
                        <div className="aspect-[4/3] contrast-125 brightness-95 opacity-80 mix-blend-multiply">
                            <img src="/demo/OtherToolsAfter.jpg" className="w-full h-full object-cover" alt="Standard Result" />
                        </div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[90%] text-center">
                            <span className="inline-block bg-black/70 text-white text-sm font-medium px-4 py-2 rounded-lg backdrop-blur-sm">
                                {t('compBadFeature')}
                            </span>
                        </div>
                    </div>

                    <div className={`relative group rounded-3xl overflow-hidden border-4 border-blue-500/20 hover:border-blue-500 transition-all duration-500 shadow-2xl shadow-blue-500/10 transform md:scale-105 z-10 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'}`}>
                        <div className="absolute top-4 right-4 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full z-20 shadow-lg glow animate-pulse">
                            {t('compGoodLabel')}
                        </div>
                        <div className="aspect-[4/3]">
                            <img src="/demo/CarveoAfter.jpeg" className="w-full h-full object-cover" alt="Carveo Result" />
                        </div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[90%] text-center">
                            <span className="inline-block bg-blue-600/90 text-white text-sm font-medium px-4 py-2 rounded-lg backdrop-blur-sm shadow-lg shadow-blue-500/20">
                                {t('compGoodFeature')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`mt-16 mx-auto p-6 rounded-2xl ${theme === 'light' ? 'bg-yellow-50 border border-yellow-200' : 'bg-yellow-900/20 border border-yellow-500/20'} flex gap-4 max-w-xl text-left items-start`}>
                    <div className="flex-shrink-0 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                        <Lightbulb className="w-6 h-6 text-yellow-900 fill-current" />
                    </div>
                    <div>
                        <h4 className={`font-bold text-lg mb-1 ${theme === 'light' ? 'text-yellow-900' : 'text-yellow-400'}`}>
                            {t('compDidYouKnowTitle')}
                        </h4>
                        <p className={`text-sm ${theme === 'light' ? 'text-yellow-800' : 'text-yellow-200/80'} leading-relaxed`}>
                            {t('compDidYouKnowText')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TestimonialsSection = ({ t, theme }: any) => {
    const reviews = [
        {
            name: t('test1Name'),
            role: t('test1Role'),
            quote: t('test1Quote'),
            text: t('test1Text'),
            image: '/demo/autoHausBesitzer1.jpeg'
        },
        {
            name: t('test2Name'),
            role: t('test2Role'),
            quote: t('test2Quote'),
            text: t('test2Text'),
            image: '/demo/autohausbesitzer2.jpeg'
        },
        {
            name: t('test3Name'),
            role: t('test3Role'),
            quote: t('test3Quote'),
            text: t('test3Text'),
            image: '/demo/autohausbesitzerin3.jpeg'
        },
        {
            name: t('test4Name'),
            role: t('test4Role'),
            quote: t('test4Quote'),
            text: t('test4Text'),
            image: '/demo/autoHausBesitzer4.jpeg'
        }
    ];

    return (
        <div className={`py-24 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -right-64 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-1/4 -left-64 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-50" />
            </div>
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6">
                        {t('valueTrustTitle')}
                    </span>
                    <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('testimonialsTitle')}
                    </h2>
                    <p className={`text-xl max-w-2xl mx-auto ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('testimonialsSubtitle')}
                    </p>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                    {reviews.map((review, i) => (
                        <div key={i} className={`p-8 md:p-12 rounded-[2.5rem] text-center ${theme === 'light' ? 'bg-white shadow-xl shadow-gray-200/50' : 'bg-zinc-900 border border-white/10'} hover:-translate-y-2 transition-all duration-300 group`}>
                            <div className="flex flex-col items-center gap-4 mb-8">
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-lg flex items-center justify-center ${theme === 'light' ? 'bg-gray-100' : 'bg-zinc-800'}`}>
                                    <img
                                        src={review.image}
                                        alt={review.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                                <div>
                                    <h4 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                                        {review.name}
                                    </h4>
                                    <div className="flex justify-center gap-1 my-1.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        ))}
                                    </div>
                                    <p className={`text-sm font-medium uppercase tracking-wider ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                        {review.role}
                                    </p>
                                </div>
                            </div>
                            <h3 className={`text-2xl md:text-3xl font-black mb-6 leading-tight ${theme === 'light' ? 'text-gray-800' : 'text-gray-100'}`}>
                                "{review.quote}"
                            </h3>
                            <p className={`text-lg leading-relaxed ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                                {review.text}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FAQSection = ({ t, theme }: any) => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);
    const leftCol = [1, 3, 5, 7, 9];
    const rightCol = [2, 4, 6, 8];

    const renderItem = (num: number) => {
        const isOpen = openIndex === num;
        return (
            <div key={num} className={`mb-4 w-full rounded-2xl transition-all duration-300 ${theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white/5 hover:bg-white/10'} border border-transparent ${isOpen ? (theme === 'light' ? 'border-gray-200 bg-white shadow-lg' : 'border-white/10 bg-white/5 shadow-black/50') : ''}`}>
                <button onClick={() => toggle(num)} className="w-full text-left p-6 flex justify-between items-start gap-4">
                    <span className={`font-bold text-lg ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        {t(`faqQ${num}`)}
                    </span>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180 bg-blue-600' : (theme === 'light' ? 'bg-gray-200' : 'bg-white/10')}`}>
                        <ChevronDown className={`w-5 h-5 ${isOpen ? 'text-white' : (theme === 'light' ? 'text-gray-600' : 'text-gray-300')}`} />
                    </div>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                    <div className={`px-6 text-base leading-relaxed ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t(`faqA${num}`)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`py-24 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900/50'}`}>
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6">
                        {t('faqLabel')}
                    </span>
                    <h2 className={`text-4xl md:text-5xl font-black mb-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('faqTitle')}
                    </h2>
                    <p className={`text-lg md:text-xl max-w-2xl mx-auto ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('faqSubtitle')}
                    </p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start">
                    <div className="w-full md:w-1/2">{leftCol.map(renderItem)}</div>
                    <div className="w-full md:w-1/2">{rightCol.map(renderItem)}</div>
                </div>
            </div>
        </div>
    );
};

const LandingPageContactForm = ({ t, theme, language }: any) => {
    const [stockLevel, setStockLevel] = useState('251+');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        phone: '',
        website: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const inputClass = `w-full px-6 py-4 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white' : 'bg-zinc-800/50 border-white/10 text-white focus:bg-zinc-800'}`;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitMessage(null);
        setSubmitError(null);
        setIsSubmitting(true);

        try {
            await submitDemoRequest({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                company: formData.company,
                phone: formData.phone,
                website: formData.website,
                stockLevel,
                source: 'landing_page',
                language,
            });

            setSubmitMessage(t('contactFormSuccess'));
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                company: '',
                phone: '',
                website: '',
            });
            setStockLevel('251+');
        } catch {
            setSubmitError(t('contactFormError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`py-24 px-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
            <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className={`text-5xl md:text-7xl font-black mb-8 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                            {t('readyToDominate')}
                        </h2>
                        <p className={`text-xl mb-12 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                            {t('joinDealers')}
                        </p>

                        <div className="space-y-6">
                            {[
                                { title: 'contactStep1Title', desc: 'contactStep1Desc' },
                                { title: 'contactStep2Title', desc: 'contactStep2Desc' },
                                { title: 'contactStep3Title', desc: 'contactStep3Desc' },
                            ].map((step, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{t(step.title)}</h4>
                                        <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>{t(step.desc)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`p-8 md:p-10 rounded-[2.5rem] shadow-2xl ${theme === 'light' ? 'bg-white border border-gray-100' : 'bg-zinc-900 border border-white/10'}`}>
                        <h3 className={`text-3xl font-bold mb-8 text-center ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{t('contactFormTitle')}</h3>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="grid md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    name="firstName"
                                    placeholder={t('contactFormFirstName')}
                                    className={inputClass}
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    required
                                />
                                <input
                                    type="text"
                                    name="lastName"
                                    placeholder={t('contactFormLastName')}
                                    className={inputClass}
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <input
                                type="email"
                                name="email"
                                placeholder={t('contactFormEmail')}
                                className={inputClass}
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                            />
                            <input
                                type="text"
                                name="company"
                                placeholder={t('contactFormCompany')}
                                className={inputClass}
                                value={formData.company}
                                onChange={handleInputChange}
                            />
                            <input
                                type="tel"
                                name="phone"
                                placeholder={t('contactFormPhone')}
                                className={inputClass}
                                value={formData.phone}
                                onChange={handleInputChange}
                            />

                            <div className="pt-2">
                                <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('contactFormStock')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {['251+', '101-250', '61-100', '31-60', '0-30'].map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setStockLevel(opt)}
                                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${stockLevel === opt ? 'bg-blue-600 text-white border-blue-600' : (theme === 'light' ? 'bg-white text-gray-600 border-gray-200 hover:border-gray-400' : 'bg-zinc-800 text-gray-300 border-white/10 hover:bg-zinc-700')}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <input
                                type="url"
                                name="website"
                                placeholder={t('contactFormWebsite')}
                                className={inputClass}
                                value={formData.website}
                                onChange={handleInputChange}
                            />

                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold text-xl rounded-2xl shadow-xl shadow-blue-500/20 transition-all mt-4">
                                {isSubmitting ? t('contactFormSubmitting') : t('contactFormButton')}
                            </button>
                            {submitMessage && (
                                <p className="text-sm text-green-600 font-medium">{submitMessage}</p>
                            )}
                            {submitError && (
                                <p className="text-sm text-red-500 font-medium">{submitError}</p>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---

const LandingPage: React.FC = () => {
    const { t, language } = useLanguage();
    const { theme } = useTheme();
    const bgClass = theme === 'light' ? 'bg-white' : 'bg-[#0a0a0a]';
    const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
    const textBody = theme === 'light' ? 'text-gray-600' : 'text-gray-400';

    return (
        <div className={`min-h-screen ${bgClass} transition-colors duration-300 overflow-x-hidden`}>
            {/* Hero Section */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
                className="relative min-h-screen flex items-center justify-center pt-32 pb-20 md:pt-40 md:pb-32 px-4 overflow-hidden"
            >
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
                            to="/contact"
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 group"
                        >
                            {t('demoRequestCta')}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none -z-10" />
            </motion.div>

            <SectionWrapper><BeforeAfterSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><StatsSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><ComparisonSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><HowItWorksSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><TestimonialsSection t={t} theme={theme} /></SectionWrapper>

            <SectionWrapper>
                <LandingPageContactForm t={t} theme={theme} language={language} />
            </SectionWrapper>
            <SectionWrapper><FAQSection t={t} theme={theme} /></SectionWrapper>

            <SectionWrapper>
                <div className={`py-16 px-4 border-t ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-white/10'}`}>
                    <div className="max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                            {[
                                { icon: ShieldCheck, title: 'contactBadge1Title', sub: 'contactBadge1Sub', desc: 'contactBadge1Desc' },
                                { icon: Rocket, title: 'contactBadge2Title', sub: 'contactBadge2Sub', desc: 'contactBadge2Desc' },
                                { icon: Zap, title: 'contactBadge3Title', sub: 'contactBadge3Sub', desc: 'contactBadge3Desc' },
                                { icon: Crosshair, title: 'contactBadge4Title', sub: 'contactBadge4Sub', desc: 'contactBadge4Desc' },
                            ].map((badge, i) => (
                                <div key={i} className="flex flex-col items-center text-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
                                        <badge.icon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-xl mb-1 leading-tight ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{t(badge.title)}</h4>
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>{t(badge.sub)}</p>
                                        <p className={`text-sm leading-relaxed ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} max-w-[250px] mx-auto`}>{t(badge.desc)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionWrapper>
        </div>
    );
};

export default LandingPage;
