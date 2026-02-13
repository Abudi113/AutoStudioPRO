import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

type ParsedMetric =
    | { kind: 'percent'; value: number; label: string }
    | { kind: 'range'; start: number; end: number; label: string }
    | { kind: 'text'; label: string };

const parseMetric = (raw: string): ParsedMetric => {
    const percentMatch = raw.match(/^(\d+)%\s+(.+)$/);
    if (percentMatch) {
        return { kind: 'percent', value: Number(percentMatch[1]), label: percentMatch[2] };
    }

    const rangeMatch = raw.match(/^(\d+)-(\d+)\s+(.+)$/);
    if (rangeMatch) {
        return {
            kind: 'range',
            start: Number(rangeMatch[1]),
            end: Number(rangeMatch[2]),
            label: rangeMatch[3],
        };
    }

    return { kind: 'text', label: raw };
};

const AboutMetricCard: React.FC<{
    raw: string;
    delay: number;
    theme: 'light' | 'dark';
    text1: string;
    text2: string;
}> = ({ raw, delay, theme, text1, text2 }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const inView = useInView(ref, { once: true, margin: '-100px' });
    const parsed = useMemo(() => parseMetric(raw), [raw]);
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (!inView) return;
        if (parsed.kind === 'text') return;

        const target = parsed.kind === 'percent' ? parsed.value : parsed.end;
        const duration = 1200;
        let frameId = 0;
        let startTime: number | null = null;

        const tick = (time: number) => {
            if (!startTime) startTime = time;
            const progress = Math.min((time - startTime) / duration, 1);
            setDisplayValue(Math.round(target * progress));
            if (progress < 1) frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [inView, parsed]);

    const renderedValue =
        parsed.kind === 'percent'
            ? `${displayValue}%`
            : parsed.kind === 'range'
                ? `${parsed.start}-${Math.max(parsed.start, displayValue)}`
                : parsed.label;

    const renderedLabel =
        parsed.kind === 'text'
            ? ''
            : parsed.label;

    const barWidth =
        parsed.kind === 'percent'
            ? `${Math.min(100, parsed.value)}%`
            : parsed.kind === 'range'
                ? `${Math.min(100, parsed.end * 10)}%`
                : '100%';

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay }}
            className={`p-8 rounded-3xl ${theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900'} text-left`}
        >
            <h3 className={`text-5xl md:text-6xl font-black mb-3 tracking-tighter ${text1}`}>
                {renderedValue}
            </h3>
            {renderedLabel && (
                <p className={`text-lg md:text-xl font-semibold ${text2}`}>
                    {renderedLabel}
                </p>
            )}
            <div className={`mt-6 h-2 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`}>
                <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: barWidth }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: delay + 0.1 }}
                    className="h-full bg-blue-600 rounded-full"
                />
            </div>
        </motion.div>
    );
};

const AboutPage: React.FC = () => {
    const { t } = useLanguage();
    const { theme } = useTheme();

    const bg1 = theme === 'light' ? 'bg-white' : 'bg-black';
    const bg2 = theme === 'light' ? 'bg-gray-50' : 'bg-zinc-900';
    const text1 = theme === 'light' ? 'text-gray-900' : 'text-white';
    const text2 = theme === 'light' ? 'text-gray-600' : 'text-gray-400';

    return (
        <div className={`min-h-screen transition-colors duration-300 ${bg1}`}>

            {/* 1. Hero & Metrics Section */}
            <div className={`min-h-screen flex flex-col justify-center pt-24 pb-16 px-4 ${bg1} text-center`}>
                <div className="max-w-7xl mx-auto">
                    {/* Hero */}
                    <div className="mb-16 max-w-4xl mx-auto">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`text-5xl md:text-7xl font-black mb-8 tracking-tighter ${text1}`}
                        >
                            {t('aboutTitle').replace('Carveo', '')} <span className="text-blue-600">Carveo</span>.
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className={`text-xl md:text-2xl leading-relaxed ${text2}`}
                        >
                            {t('aboutSubtitle')}
                        </motion.p>
                    </div>

                    {/* Metrics */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="grid md:grid-cols-3 gap-8"
                    >
                        {[
                            { text: t('aboutMetric1'), delay: 0 },
                            { text: t('aboutMetric2'), delay: 0.1 },
                            { text: t('aboutMetric3'), delay: 0.2 },
                        ].map((item, i) => (
                            <AboutMetricCard
                                key={i}
                                raw={item.text}
                                delay={item.delay}
                                theme={theme}
                                text1={text1}
                                text2={text2}
                            />
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* 2. "What makes us special" Section (Alternating Background) */}
            <div className={`py-24 px-4 ${bg2}`}>
                <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-5">
                        <motion.h2
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className={`text-4xl md:text-6xl font-black tracking-tighter sticky top-32 ${text1}`}
                        >
                            {t('aboutSpecialTitle')}
                        </motion.h2>
                    </div>
                    <div className="lg:col-span-7 space-y-14">
                        {[
                            { title: 'aboutSpecialTeam', text: 'aboutSpecialTeamText' },
                            { title: 'aboutSpecialCulture', text: 'aboutSpecialCultureText' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.2 }}
                            >
                                <h3 className={`text-3xl font-bold mb-6 ${text1}`}>{t(item.title)}</h3>
                                <p className={`text-xl leading-relaxed ${text2}`}>
                                    {t(item.text)}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Values Section (Original Background) */}
            <div className={`py-24 px-4 ${bg1}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <h2 className={`text-4xl md:text-6xl font-black mb-6 tracking-tighter ${text1}`}>
                            {t('aboutValuesTitle')}
                        </h2>
                        <p className={`text-xl ${text2}`}>
                            {t('aboutValuesSubtitle')}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            { title: 'aboutValInnovation', text: 'aboutValInnovationText', color: 'bg-blue-600' },
                            { title: 'aboutValSustainability', text: 'aboutValSustainabilityText', color: 'bg-blue-600' },
                            { title: 'aboutValTeamwork', text: 'aboutValTeamworkText', color: 'bg-blue-600' },
                            { title: 'aboutValIntegrity', text: 'aboutValIntegrityText', color: 'bg-blue-600' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`${item.color} p-10 md:p-12 rounded-[2.5rem] text-white shadow-xl hover:scale-[1.02] transition-transform duration-300`}
                            >
                                <h3 className="text-3xl font-bold mb-6">{t(item.title)}</h3>
                                <p className="text-lg leading-relaxed text-blue-50">
                                    {t(item.text)}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AboutPage;
