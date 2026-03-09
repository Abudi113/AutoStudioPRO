
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Zap, Check, ArrowRight, Lightbulb, User, Star, ChevronDown, ShieldCheck, Rocket, Crosshair } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// --- Reusable Components ---

const SectionWrapper = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, ease: "easeOut", delay }}
        >
            {children}
        </motion.div>
    );
};

const LogoMarquee = ({ theme }: { theme: string }) => {
    const marqueeStyle = `
        @keyframes marqueeLeft {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
        @keyframes marqueeRight {
            0%   { transform: translateX(-50%); }
            100% { transform: translateX(0); }
        }
    `;

    const logos = [
        'mobile.de', 'AutoScout24', 'DAT', 'Autovista', 'incadea', 'DealerSocket',
        'automanager', 'CarVista', 'Autoline', 'Rey DMS', 'Carvana Pro', 'CarStream',
    ];

    const allLogos = [...logos, ...logos];
    const textCls = `text-lg font-black tracking-tight whitespace-nowrap ${theme === 'light' ? 'text-gray-900' : 'text-white'}`;

    return (
        <div className={`py-6 overflow-hidden relative ${theme === 'light' ? 'bg-white border-y border-gray-200' : 'bg-[#0d0d0d] border-y border-white/5'}`}>
            <style>{marqueeStyle}</style>

            {/* Row 1 — right to left */}
            <div className="relative mb-3 overflow-hidden">
                <div className="flex" style={{ animation: 'marqueeLeft 28s linear infinite', width: 'max-content' }}>
                    {allLogos.map((name, i) => (
                        <div key={`r1-${i}`} className="flex items-center justify-center px-8 py-2 shrink-0 select-none" style={{ minWidth: 160 }}>
                            <span className={textCls} style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' }}>{name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 2 — left to right */}
            <div className="relative overflow-hidden">
                <div className="flex" style={{ animation: 'marqueeRight 22s linear infinite', width: 'max-content' }}>
                    {[...allLogos].reverse().map((name, i) => (
                        <div key={`r2-${i}`} className="flex items-center justify-center px-8 py-2 shrink-0 select-none" style={{ minWidth: 160 }}>
                            <span className={textCls} style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' }}>{name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fade edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-32" style={{ background: `linear-gradient(to right, ${theme === 'light' ? '#f9fafb' : '#0d0d0d'}, transparent)` }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-32" style={{ background: `linear-gradient(to left, ${theme === 'light' ? '#f9fafb' : '#0d0d0d'}, transparent)` }} />
        </div>
    );
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

    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) handleMove(e.clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX);
    };

    const currentImages = images[activeTab];

    return (
        <div className={`py-24 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} overflow-hidden`}>
            <div className="w-full">
                {/* Header */}
                <div className="text-center mb-16">
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
                            className={`px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'exterior' ? 'bg-[#0678e8] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('exterior')}
                        </button>
                        <button
                            onClick={() => setActiveTab('interior')}
                            className={`px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'interior' ? 'bg-[#0678e8] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('interior')}
                        </button>
                    </div>
                </div>

                {/* Slider */}
                <div
                    ref={containerRef}
                    className="relative w-full max-w-3xl mx-auto aspect-[4/3] md:aspect-[16/9] rounded-3xl overflow-hidden shadow-2xl cursor-col-resize select-none border-4 border-white/10 group touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    onTouchMove={handleTouchMove}
                    onClick={(e) => handleMove(e.clientX)}
                >
                    {/* After Image (Background) */}
                    <img
                        src={currentImages.after}
                        alt="After"
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                    />
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 px-3 py-1.5 md:px-4 md:py-2 bg-[#0678e8]/90 backdrop-blur-md rounded-lg shadow-lg z-10 pointer-events-none">
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
                        className="absolute inset-y-0 w-1 bg-white cursor-col-resize z-30 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:bg-blue-400 transition-colors"
                        style={{ left: `${sliderPos}%` }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <div className="flex gap-1">
                                <ArrowRight className="w-4 h-4 text-[#0678e8] rotate-180" />
                                <ArrowRight className="w-4 h-4 text-[#0678e8]" />
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
    // Inline keyframes injected once
    const styleTag = `
        @keyframes barGrow1 {
            0%   { width: 20%; }
            60%  { width: 55%; }
            100% { width: 20%; }
        }
        @keyframes barGrow2 {
            0%   { width: 15%; }
            70%  { width: 65%; }
            100% { width: 15%; }
        }
        @keyframes barGrow3 {
            0%   { height: 20%; }
            50%  { height: 90%; }
            100% { height: 20%; }
        }
        @keyframes barGrow4 {
            0%   { height: 10%; }
            50%  { height: 45%; }
            100% { height: 10%; }
        }
        @keyframes progressScan {
            0%   { width: 5%; }
            80%  { width: 62%; }
            100% { width: 5%; }
        }
        @keyframes pulseRow {
            0%, 100% { opacity: 0.4; transform: scaleX(0.92); }
            50%       { opacity: 1;   transform: scaleX(1); }
        }
        @keyframes spinFull {
            from { transform: rotate(-90deg); }
            to   { transform: rotate(270deg); }
        }
        @keyframes clockSecond {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes clockMinute {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
    `;

    const bg = theme === 'light' ? 'bg-white' : 'bg-[#0d0d0d]';
    const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#161616]';
    const cardBorder = theme === 'light' ? 'border-gray-200' : 'border-white/10';
    const chartBg = theme === 'light' ? 'bg-gray-100' : 'bg-[#111]';
    const chartBorder = theme === 'light' ? 'border-gray-200' : 'border-white/10';
    const textMuted = theme === 'light' ? 'text-gray-500' : 'text-gray-400';
    const textBold = theme === 'light' ? 'text-gray-900' : 'text-white';
    const pillBorder = theme === 'light' ? 'border-gray-300 text-gray-700' : 'border-white/20 text-white';
    const barTrack = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
    const labelMono = theme === 'light' ? 'text-gray-400' : 'text-gray-600';

    return (
        <div className={`py-24 px-4 ${bg} overflow-hidden`}>
            <style>{styleTag}</style>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className={`text-4xl md:text-6xl font-black ${textBold} mb-6 leading-tight`}>
                        Ein Must-have<br />für die Autobranche
                    </h2>
                    <p className={`${textMuted} text-lg max-w-2xl mx-auto leading-relaxed`}>
                        Professionelle Bilder sind ein Schlüssel zum Erfolg. Mit hochwertigen Fotos Ihrer Fahrzeuge können Sie Ihren Bestand schneller verkaufen.
                    </p>
                </div>

                {/* 3-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* LEFT — 55% kostensparend + bar chart */}
                    <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex flex-col justify-between`}>
                        <div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[5rem] font-black leading-none" style={{ color: '#0678e8' }}>55%</span>
                                <span className={`${textMuted} text-sm font-medium`}>kostensparend</span>
                            </div>
                            <p className={`${textMuted} text-sm leading-relaxed mt-4`}>
                                Mit <span className={`${textBold} font-semibold`}>Carveo</span> können Sie Ihre Fahrzeuge viel schneller fotografieren und den Upload-Vorgang automatisieren. Dadurch können Sie Ihre Personalkosten um bis zu 55% senken.
                            </p>
                        </div>
                        <div className={`mt-8 border ${chartBorder} rounded-xl p-4 ${chartBg} flex flex-col gap-2`}>
                            {[
                                { label: '500', delay: '0s', dur: '2.8s', kf: 'barGrow1', color: '#0678e8' },
                                { label: '70', delay: '0.3s', dur: '3.2s', kf: 'barGrow1', color: '#003FAA' },
                                { label: '50', delay: '0.6s', dur: '2.5s', kf: 'barGrow2', color: '#003FAA' },
                                { label: '25', delay: '0.9s', dur: '3.5s', kf: 'barGrow1', color: '#003FAA' },
                                { label: '10', delay: '1.2s', dur: '2.9s', kf: 'barGrow2', color: '#003FAA' },
                            ].map((bar, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className={`${labelMono} text-[10px] w-6 text-right shrink-0`}>{bar.label}</span>
                                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: barTrack }}>
                                        <div className="h-full rounded-full" style={{ backgroundColor: bar.color, animation: `${bar.kf} ${bar.dur} ${bar.delay} ease-in-out infinite` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CENTER — two text blocks */}
                    <div className="flex flex-col gap-6">
                        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 flex-1 overflow-hidden relative`}>
                            <h3 className="text-xl font-bold mb-1" style={{ color: '#0678e8' }}>Erhöhen Sie die Online-Sichtbarkeit</h3>
                            <p className={`${textMuted} text-sm leading-relaxed mb-4`}>
                                Mit Carveo-Studiobildern werden Ihre Inserate deutlich klickstärker — auf mobile.de, AutoScout24 und Co.
                            </p>
                            {/* Rising clicks animation */}
                            <div className={`rounded-xl p-3 ${chartBg} border ${chartBorder}`}>
                                <div className="flex items-end justify-between gap-1.5 h-20">
                                    {[
                                        { h: '25%', delay: '0s', dur: '3s', color: '#003FAA' },
                                        { h: '35%', delay: '0.2s', dur: '3.2s', color: '#003FAA' },
                                        { h: '45%', delay: '0.4s', dur: '2.8s', color: '#0052CC' },
                                        { h: '55%', delay: '0.6s', dur: '3.1s', color: '#0678e8' },
                                        { h: '70%', delay: '0.8s', dur: '2.9s', color: '#0678e8' },
                                        { h: '85%', delay: '1.0s', dur: '3.3s', color: '#0678e8' },
                                        { h: '95%', delay: '1.2s', dur: '2.7s', color: '#0678e8' },
                                    ].map((bar, i) => (
                                        <div key={i} className="flex-1 rounded-t-md" style={{
                                            height: bar.h,
                                            backgroundColor: bar.color,
                                            animation: `barGrow3 ${bar.dur} ${bar.delay} ease-in-out infinite`,
                                            opacity: 0.85 + i * 0.02
                                        }} />
                                    ))}
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className={`text-[9px] ${labelMono}`}>Ohne KI</span>
                                    <span className="text-[9px] font-bold" style={{ color: '#0678e8' }}>+80% Clicks</span>
                                </div>
                            </div>
                        </div>
                        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex-1`}>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[4rem] font-black leading-none" style={{ color: '#0678e8' }}>80%</span>
                                <span className={`${textMuted} text-sm font-medium`}>mehr Clicks</span>
                            </div>
                            <p className={`${textMuted} text-sm leading-relaxed`}>
                                Professionelle Fahrzeugbilder generieren deutlich mehr Klicks auf Ihre Auto-Inserate. Mit Carveo erzielen Händler im Durchschnitt 80% mehr Interaktionen — und verkaufen Ihren Bestand dadurch schneller.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT — 65% zeitsparend + progress rows */}
                    <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex flex-col justify-between`}>
                        <div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[5rem] font-black leading-none" style={{ color: '#0678e8' }}>65%</span>
                                <span className={`${textMuted} text-sm font-medium`}>zeitsparend</span>
                            </div>
                            <p className={`${textMuted} text-sm leading-relaxed mt-4`}>
                                Die Verwendung von Carveo ist schnell sowie intuitiv und spart Ihnen Zeit. Die vordefinierte Fotoreihenfolge erleichtert das Fotografieren, und die Bilder können direkt in Ihr DMS exportiert werden.
                            </p>
                        </div>
                        <div className={`mt-8 border ${chartBorder} rounded-xl p-4 ${chartBg} flex flex-col gap-3`}>
                            <div className="flex items-center gap-3">
                                <span className={`${labelMono} text-[10px] font-mono w-8`}>1.0×</span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: barTrack }}>
                                    <div className="h-full rounded-full" style={{ backgroundColor: '#4ade80', animation: 'progressScan 3s 0s ease-in-out infinite' }} />
                                </div>
                            </div>
                            {[
                                { label: '31', delay: '0.4s', dur: '2.6s', color: '#0678e8' },
                                { label: '12', delay: '0.8s', dur: '3.1s', color: '#003FAA' },
                                { label: '9', delay: '1.2s', dur: '2.8s', color: '#003FAA' },
                                { label: '6', delay: '1.6s', dur: '3.3s', color: '#003FAA' },
                            ].map((row, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className={`${labelMono} text-[10px] font-mono w-8 text-right`}>{row.label}</span>
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: barTrack }}>
                                        <div className="h-full rounded-full" style={{ backgroundColor: row.color, animation: `pulseRow ${row.dur} ${row.delay} ease-in-out infinite`, transformOrigin: 'left' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const StatsRow2Section = ({ theme }: any) => {
    const styleTag = `
        @keyframes spinFull {
            from { transform: rotate(-90deg); }
            to   { transform: rotate(270deg); }
        }
        @keyframes clockSecond {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes clockMinute {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes pulseRowR2 {
            0%, 100% { opacity: 0.4; transform: scaleX(0.92); }
            50%       { opacity: 1;   transform: scaleX(1); }
        }
    `;
    const bg = theme === 'light' ? 'bg-white' : 'bg-black';
    const cardBg = theme === 'light' ? 'bg-white' : 'bg-[#161616]';
    const cardBorder = theme === 'light' ? 'border-gray-200' : 'border-white/10';
    const chartBg = theme === 'light' ? 'bg-gray-100' : 'bg-[#111]';
    const chartBorder = theme === 'light' ? 'border-gray-200' : 'border-white/10';
    const textMuted = theme === 'light' ? 'text-gray-500' : 'text-gray-400';
    const textBold = theme === 'light' ? 'text-gray-900' : 'text-white';
    const barTrack = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

    return (
        <div className={`py-24 px-4 ${bg} overflow-hidden`}>
            <style>{styleTag}</style>
            <div className="max-w-7xl mx-auto">
                {/* Section header */}
                <div className="text-center mb-12">
                    <h2 className={`text-4xl md:text-5xl font-black tracking-tighter mb-4 ${textBold}`}>
                        Schneller inserieren.<br />Mehr Zeit für den Verkauf.
                    </h2>
                    <p className={`text-lg max-w-xl mx-auto ${textMuted}`}>
                        Mit Carveo veröffentlichen Autohäuser ihre Inserate bis zu 88% schneller — vollautomatisch, professionell und ohne Aufwand.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* LEFT — 88% schneller + donut ring */}
                    <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex flex-col justify-between`}>
                        <div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[5rem] font-black leading-none" style={{ color: '#0678e8' }}>88%</span>
                                <span className={`${textMuted} text-sm font-medium`}>schneller inseriert</span>
                            </div>
                            <p className={`${textMuted} text-sm leading-relaxed mt-4`}>
                                Carveo revolutioniert die Erstellung von Inseraten für Automatishäuser und beschleunigt die Veröffentlichung um bis zu 88 Prozent.
                            </p>
                        </div>
                        <div className={`mt-8 border ${chartBorder} rounded-xl p-4 ${chartBg} flex items-center justify-center`} style={{ minHeight: 108 }}>
                            <svg width="90" height="90" viewBox="0 0 90 90">
                                <circle cx="45" cy="45" r="36" fill="none" stroke={barTrack} strokeWidth="10" />
                                <circle cx="45" cy="45" r="36" fill="none" stroke="#0678e8" strokeWidth="10" strokeLinecap="round"
                                    strokeDasharray="199 226"
                                    style={{ animation: 'spinFull 2.5s linear infinite', transformOrigin: 'center', transformBox: 'fill-box' }}
                                />
                                <text x="45" y="50" textAnchor="middle" fill="#0678e8" fontSize="14" fontWeight="900">88%</text>
                            </svg>
                        </div>
                    </div>

                    {/* CENTER — two feature text blocks */}
                    <div className="flex flex-col gap-6">
                        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex-1`}>
                            <h3 className="text-xl font-bold mb-3" style={{ color: '#0678e8' }}>Einfache Bestandsverwaltung</h3>
                            <p className={`${textMuted} text-sm leading-relaxed`}>
                                Verwalten Sie Ihren Fahrzeugbestand direkt in der App — effizient und übersichtlich, mit wenigen Klicks zum erfolgreichen Online-Inserat.
                            </p>
                        </div>
                        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex-1`}>
                            <h3 className="text-xl font-bold mb-3" style={{ color: '#0678e8' }}>Automatische Dateneingabe</h3>
                            <p className={`${textMuted} text-sm leading-relaxed`}>
                                Geben Sie die Fahrgestellnummer ein und erhalten Sie die automatische Erfassung der Fahrzeugdaten — manuelle Fehler werden minimiert und wertvolle Zeit gespart.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT — 10 Minuten + ticking clock */}
                    <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 flex flex-col justify-between`}>
                        <div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[5rem] font-black leading-none" style={{ color: '#0678e8' }}>10</span>
                                <div className="flex flex-col">
                                    <span className={`${textBold} text-2xl font-black leading-none`}>Minuten</span>
                                    <span className={`${textMuted} text-sm`}>zum Veröffentlichen</span>
                                </div>
                            </div>
                            <p className={`${textMuted} text-sm leading-relaxed mt-4`}>
                                Mit nur wenigen Klicks können Fahrzeuge effizient inseriert werden — das spart Zeit und Ressourcen.
                            </p>
                        </div>
                        <div className={`mt-8 border ${chartBorder} rounded-xl p-4 ${chartBg} flex items-center justify-center`} style={{ minHeight: 108 }}>
                            <svg width="90" height="90" viewBox="0 0 90 90">
                                <circle cx="45" cy="45" r="38" fill="none" stroke={barTrack} strokeWidth="2" />
                                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
                                    const rad = (deg - 90) * Math.PI / 180;
                                    return (
                                        <line key={i}
                                            x1={45 + 34 * Math.cos(rad)} y1={45 + 34 * Math.sin(rad)}
                                            x2={45 + 38 * Math.cos(rad)} y2={45 + 38 * Math.sin(rad)}
                                            stroke="#0678e8" strokeWidth={i % 3 === 0 ? '2' : '1'} opacity={i % 3 === 0 ? '0.8' : '0.3'}
                                        />
                                    );
                                })}
                                <line x1="45" y1="45" x2="45" y2="14"
                                    stroke="#0678e8" strokeWidth="2.5" strokeLinecap="round"
                                    style={{ animation: 'clockMinute 10s linear infinite', transformOrigin: '45px 45px' }}
                                />
                                <line x1="45" y1="45" x2="45" y2="10"
                                    stroke="#5badff" strokeWidth="1.5" strokeLinecap="round"
                                    style={{ animation: 'clockSecond 1s steps(60, end) infinite', transformOrigin: '45px 45px' }}
                                />
                                <circle cx="45" cy="45" r="3" fill="#0678e8" />
                            </svg>
                        </div>
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
        <div id="how-it-works" className={`py-32 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'}`}>
            <div className="w-full">
                <div className="text-center mb-24">
                    <h2 className={`text-5xl md:text-6xl font-black mb-8 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('howItWorksSubtitle')}
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-20">
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
                                <h3 className={`text-2xl font-bold mb-4 ${theme === 'light' ? 'text-gray-900' : 'text-white'} group-hover:text-[#0678e8] transition-colors`}>
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
                        to="/create?start=true"
                        className="inline-flex px-12 py-5 bg-[#0678e8] hover:bg-[#0560c5] text-white rounded-full font-bold text-xl hover:scale-105 transition-all shadow-xl shadow-[#0678e8]/30 items-center gap-3 group"
                    >
                        {t('getStartedFree') || "Start Free Trial"}
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
};

const ComparisonSection = ({ t, theme }: any) => {
    return (
        <div className={`py-32 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} relative overflow-hidden`}>
            <div className="w-full">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('compTitle')}
                    </h2>
                    <p className={`text-lg md:text-xl mb-10 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('compSubtitle')}
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
                    <div className="relative group rounded-3xl overflow-hidden border-4 border-red-500/10 hover:border-red-500/30 transition-colors bg-gray-100 w-full max-w-2xl">
                        <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow-md">
                            {t('compBadLabel')}
                        </div>
                        <div className="h-[448px] contrast-125 brightness-95 opacity-80 mix-blend-multiply">
                            <img src="/demo/OtherToolsAfter.jpg" className="w-full h-full object-cover" alt="Standard Result" />
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-max max-w-[90%] text-center">
                            <span className="inline-block bg-black/70 text-white text-sm font-medium px-4 py-2 rounded-lg backdrop-blur-sm">
                                {t('compBadFeature')}
                            </span>
                        </div>
                    </div>

                    <div className={`relative group rounded-3xl overflow-hidden border-4 border-[#0678e8]/20 hover:border-[#0678e8] transition-all duration-500 shadow-2xl shadow-[#0678e8]/10 w-full max-w-2xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'}`}>
                        <div className="absolute top-4 right-4 bg-[#0678e8] text-white text-xs font-bold px-3 py-1 rounded-full z-20 shadow-lg animate-pulse">
                            {t('compGoodLabel')}
                        </div>
                        <div className="h-[448px]">
                            <img src="/demo/CarveoAfter.jpeg" className="w-full h-full object-cover" alt="Carveo Result" />
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-max max-w-[90%] text-center">
                            <span className="inline-block bg-[#0678e8]/90 text-white text-sm font-medium px-4 py-2 rounded-lg backdrop-blur-sm shadow-lg shadow-[#0678e8]/20">
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
            text: t('test1Text')
        },
        {
            name: t('test2Name'),
            role: t('test2Role'),
            quote: t('test2Quote'),
            text: t('test2Text')
        },
        {
            name: t('test3Name'),
            role: t('test3Role'),
            quote: t('test3Quote'),
            text: t('test3Text')
        },
        {
            name: t('test4Name'),
            role: t('test4Role'),
            quote: t('test4Quote'),
            text: t('test4Text')
        }
    ];

    return (
        <div className={`py-32 px-4 ${theme === 'light' ? 'bg-white' : 'bg-black'} relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -right-64 w-96 h-96 bg-[#0678e8]/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-1/4 -left-64 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-50" />
            </div>
            <div className="w-full relative z-10">
                <div className="text-center mb-20">
                    <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'} tracking-tighter`}>
                        {t('testimonialsTitle')}
                    </h2>
                    <p className={`text-xl max-w-2xl mx-auto ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('testimonialsSubtitle')}
                    </p>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                    {reviews.map((review, i) => (
                        <div key={i} className={`p-8 md:p-12 rounded-[2.5rem] ${theme === 'light' ? 'bg-white shadow-xl shadow-gray-200/50' : 'bg-zinc-900 border border-white/10'} hover:-translate-y-2 transition-all duration-300 group`}>
                            <div className="flex items-center gap-6 mb-8">
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-lg flex items-center justify-center ${theme === 'light' ? 'bg-gray-100' : 'bg-zinc-800'}`}>
                                    <User className={`w-8 h-8 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                    <h4 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                                        {review.name}
                                    </h4>
                                    <div className="flex gap-1 my-1.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        ))}
                                    </div>
                                    <p className={`text-sm font-medium uppercase tracking-wider ${theme === 'light' ? 'text-[#0678e8]' : 'text-[#0678e8]'}`}>
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
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180 bg-[#0678e8]' : (theme === 'light' ? 'bg-gray-200' : 'bg-white/10')}`}>
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
        <div className={`py-32 px-4 ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'}`}>
            <div className="w-full">
                <div className="text-center mb-16">
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

const LandingPageContactForm = ({ t, theme }: any) => {
    const [stockLevel, setStockLevel] = useState('251+');
    const inputClass = `w-full px-6 py-4 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#0678e8] ${theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white' : 'bg-zinc-800/50 border-white/10 text-white focus:bg-zinc-800'}`;

    return (
        <div className={`py-32 px-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
            <div className="w-full">
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
                                    <div className="w-8 h-8 rounded-full bg-[#0678e8] text-white flex items-center justify-center font-bold flex-shrink-0">
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
                        <form className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <input type="text" placeholder={t('contactFormFirstName')} className={inputClass} />
                                <input type="text" placeholder={t('contactFormLastName')} className={inputClass} />
                            </div>
                            <input type="email" placeholder={t('contactFormEmail')} className={inputClass} />
                            <input type="text" placeholder={t('contactFormCompany')} className={inputClass} />

                            <div className="pt-2">
                                <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('contactFormStock')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {['251+', '101-250', '61-100', '31-60', '0-30'].map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setStockLevel(opt)}
                                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${stockLevel === opt ? 'bg-[#0678e8] text-white border-blue-600' : (theme === 'light' ? 'bg-white text-gray-600 border-gray-200 hover:border-gray-400' : 'bg-zinc-800 text-gray-300 border-white/10 hover:bg-zinc-700')}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full py-5 bg-[#0678e8] hover:bg-[#0560c5] text-white font-bold text-xl rounded-2xl shadow-xl shadow-[#0678e8]/20 transition-all mt-4">
                                {t('contactFormButton')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---

const LandingPage: React.FC = () => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const bgClass = theme === 'light' ? 'bg-white' : 'bg-[#0a0a0a]';
    const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
    const textBody = theme === 'light' ? 'text-gray-600' : 'text-gray-400';

    return (
        <div className={`min-h-screen ${bgClass} transition-colors duration-300`}>
            {/* Hero Section — CarCutter style */}
            {/* Hero Section — Futuristic, high-conversion */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className={`relative min-h-screen h-screen flex flex-col overflow-hidden ${theme === 'light' ? 'bg-[#f0efeb]' : 'bg-[#0a0a12]'}`}
            >
                {/* Car image — full background */}
                <div className="absolute inset-0">
                    <img
                        src="/demo/hero-car.png"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/demo/exterior-after.png'; }}
                        alt="Carveo AI Studio"
                        className="w-full h-full object-cover hero-car-img"
                    />
                    {/* Bottom fade */}
                    <div
                        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                        style={{ background: `linear-gradient(to top, ${theme === 'light' ? '#f9fafb' : '#0a0a12'} 0%, transparent 100%)` }}
                    />
                </div>

                {/* Animated blue glow — futuristic pulse */}
                <div
                    className="absolute top-16 sm:top-24 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[150px] sm:h-[300px] pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(91,110,245,0.35) 0%, transparent 70%)',
                        animation: 'pulseRow 4s ease-in-out infinite'
                    }}
                />

                {/* Dark scrim behind headline */}
                <div
                    className="absolute top-0 left-0 right-0 h-[75%] pointer-events-none"
                    style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
                />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center pt-20 sm:pt-32 px-4 gap-4 sm:gap-6">

                    {/* Headline */}
                    <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-none text-white drop-shadow-2xl">
                        {(() => {
                            const title = t('heroTitle').split('.')[0];
                            const parts = title.split('#1');
                            return parts.length === 2 ? (
                                <>
                                    {parts[0]}
                                    <span style={{ color: '#0678e8', textShadow: '0 0 40px rgba(91,110,245,0.8)' }}>#1</span>
                                    {parts[1]}
                                    <span style={{ color: '#0678e8' }}>.</span>
                                </>
                            ) : (
                                <>{title}<span style={{ color: '#0678e8' }}>.</span></>
                            );
                        })()}
                    </h1>
                </div>

                {/* CTA + social proof — bottom */}
                <div className="absolute bottom-8 sm:bottom-20 left-0 right-0 z-10 flex flex-col items-center gap-3 sm:gap-4 px-4">
                    <Link
                        to="/create?start=true"
                        className="px-6 sm:px-10 py-3 sm:py-4 text-white font-bold text-base sm:text-lg rounded-full flex items-center gap-2 group transition-all hover:scale-105 active:scale-95 shadow-2xl"
                        style={{ background: 'linear-gradient(135deg, #0678e8 0%, #0560c5 100%)', boxShadow: '0 0 30px rgba(91,110,245,0.5)' }}
                    >
                        {t('getStartedFree')}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    {/* Social proof strip */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            <span className="text-yellow-400 text-xs sm:text-sm">★★★★★</span>
                            <span className="text-xs sm:text-sm font-semibold">4.9/5</span>
                            <span className="text-[10px] sm:text-xs opacity-70">von 200+ Händlern</span>
                        </div>
                        <div className="hidden sm:block w-px h-4 bg-white/20" />
                        <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            <span className="text-[#0678e8] text-xs sm:text-sm">✓</span>
                            <span className="text-[10px] sm:text-xs opacity-70">Kostenlos starten — keine Kreditkarte</span>
                        </div>
                    </div>
                </div>
            </motion.div>


            <SectionWrapper><LogoMarquee theme={theme} /></SectionWrapper>
            <SectionWrapper><BeforeAfterSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><StatsSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><ComparisonSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><StatsRow2Section theme={theme} /></SectionWrapper>
            <SectionWrapper><HowItWorksSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><TestimonialsSection t={t} theme={theme} /></SectionWrapper>
            <SectionWrapper><FAQSection t={t} theme={theme} /></SectionWrapper>

            <SectionWrapper>
                <LandingPageContactForm t={t} theme={theme} />
            </SectionWrapper>

            <SectionWrapper>
                <div className={`py-24 px-4 border-t ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-white/10'}`}>
                    <div className="w-full">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                            {[
                                { icon: ShieldCheck, title: 'contactBadge1Title', sub: 'contactBadge1Sub', desc: 'contactBadge1Desc' },
                                { icon: Rocket, title: 'contactBadge2Title', sub: 'contactBadge2Sub', desc: 'contactBadge2Desc' },
                                { icon: Zap, title: 'contactBadge3Title', sub: 'contactBadge3Sub', desc: 'contactBadge3Desc' },
                                { icon: Crosshair, title: 'contactBadge4Title', sub: 'contactBadge4Sub', desc: 'contactBadge4Desc' },
                            ].map((badge, i) => (
                                <div key={i} className="flex flex-col items-center text-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${theme === 'light' ? 'bg-blue-100 text-[#0678e8]' : 'bg-[#0678e8]/10 text-[#0678e8]'}`}>
                                        <badge.icon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-xl mb-1 leading-tight ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{t(badge.title)}</h4>
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-[#0678e8]' : 'text-[#0678e8]'}`}>{t(badge.sub)}</p>
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

