
import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Camera, Zap, Image as ImageIcon, CheckCircle, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const BeforeAfterSlider: React.FC<{ beforeImage: string, afterImage: string }> = ({ beforeImage, afterImage }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const position = ((x - rect.left) / rect.width) * 100;
        setSliderPosition(Math.min(Math.max(position, 0), 100));
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize border border-white/10 shadow-2xl shadow-blue-500/10"
            onMouseMove={handleMouseMove}
            onTouchMove={handleMouseMove}
        >
            {/* After Image (Base) */}
            <img src={afterImage} alt="Processed Car" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-blue-400 border border-blue-500/30">AFTER</div>

            {/* Before Image (Overlay) */}
            <div
                className="absolute inset-0 overflow-hidden border-r-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                style={{ width: `${sliderPosition}%` }}
            >
                <img src={beforeImage} alt="Original Car" className="absolute inset-0 w-full h-full object-cover max-w-none" style={{ width: '100%' }} /> {/* Changed 100vw to 100% since we have aspect ratio container */}
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-400 border border-white/10">BEFORE</div>
            </div>

            {/* Slider Handle */}
            <div
                className="absolute top-0 bottom-0 w-1 bg-transparent cursor-ew-resize z-10 flex items-center justify-center group"
                style={{ left: `${sliderPosition}%` }}
            >
                <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center -ml-4 group-hover:scale-110 transition-transform">
                    <div className="flex gap-0.5">
                        <div className="w-0.5 h-3 bg-gray-400"></div>
                        <div className="w-0.5 h-3 bg-gray-400"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, desc: string, delay: number }> = ({ icon, title, desc, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        viewport={{ once: true }}
        className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all group"
    >
        <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{desc}</p>
    </motion.div>
);

const LandingPage: React.FC = () => {
    return (
        <div className="bg-[var(--background)] min-h-screen transition-colors duration-300">

            {/* HERO SECTION */}
            <section className="relative pt-24 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-sm font-bold mb-8">
                        <Zap className="w-4 h-4" />
                        <span>AI PHOTOGRAPHY ENGINE 4.0</span>
                    </div>
                    <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-8 leading-[0.9]">
                        SELL CARS <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400">
                            FASTER.
                        </span>
                    </h1>
                    <p className="text-xl opacity-70 mb-10 max-w-2xl mx-auto font-medium">
                        Carveo transforms ordinary car photos into high-converting, studio-quality dealership assets in under 30 seconds.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                        <Link to="/create?start=true" className="px-10 py-4 bg-blue-600 rounded-full text-lg font-bold text-white hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 hover:scale-105 active:scale-95">
                            <Camera className="w-5 h-5" /> Get Started Free
                        </Link>
                        <Link to="/pricing" className="px-10 py-4 bg-gray-500/10 rounded-full text-lg font-bold hover:bg-gray-500/20 transition-all border border-[var(--border)]">
                            View Pricing
                        </Link>
                    </div>
                </motion.div>

                {/* BEFORE / AFTER SLIDERS */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="w-full max-w-6xl grid md:grid-cols-3 gap-8"
                >
                    {[
                        {
                            label: "BMW X2 - Black (Front 3/4)",
                            before: "/images/demo/bmw-x2-front-before.png",
                            after: "/images/demo/bmw-x2-front-after.png"
                        },
                        {
                            label: "BMW 4 - White (Rear 3/4)",
                            before: "/images/demo/bmw-4-rear-before.png",
                            after: "/images/demo/bmw-4-rear-after.png"
                        },
                        {
                            label: "BMW X2 - Black (Rear 3/4)",
                            before: "/images/demo/bmw-x2-rear-before.png",
                            after: "/images/demo/bmw-x2-rear-after.png"
                        }
                    ].map((car, index) => (
                        <div key={index} className="flex flex-col gap-4">
                            <BeforeAfterSlider
                                beforeImage={car.before}
                                afterImage={car.after}
                            />
                            <div className="flex items-center justify-between px-2">
                                <span className="text-sm font-bold opacity-80 uppercase tracking-tighter">{car.label}</span>
                                <div className="flex gap-1">
                                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            </section>

            {/* "US VS OTHERS" COMPARISON MATRIX */}
            <section className="py-32 bg-[var(--card)] border-y border-[var(--border)]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black mb-4">THE CARVEO ADVANTAGE</h2>
                        <p className="opacity-60 max-w-xl mx-auto">Why the world's leading dealerships are switching to AI-powered studio rendering.</p>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background)] shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-500/5">
                                    <th className="p-6 text-sm font-bold uppercase tracking-wider opacity-50">Feature</th>
                                    <th className="p-6 text-sm font-bold uppercase tracking-wider text-blue-500 text-center">Carveo AI</th>
                                    <th className="p-6 text-sm font-bold uppercase tracking-wider opacity-50 text-center">Traditional</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {[
                                    { f: "Processing Time", c: "Seconds", t: "Days" },
                                    { f: "Cost per Vehicle", c: "$1.00", t: "$50+" },
                                    { f: "Lighting Consistency", c: "Perfect (AI)", t: "Variable" },
                                    { f: "Weather Dependent", c: "Never", t: "Yes" },
                                    { f: "Turnaround", c: "Instant", t: "Slow" },
                                    { f: "Backgrounds", c: "Unlimited", t: "Physical only" },
                                ].map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-500/5 transition-colors">
                                        <td className="p-6 font-medium">{row.f}</td>
                                        <td className="p-6 text-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm">
                                                <CheckCircle className="w-4 h-4" /> {row.c}
                                            </div>
                                        </td>
                                        <td className="p-6 text-center opacity-40 font-medium">{row.t}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* CTA FOOTER */}
            <section className="py-40 px-4 text-center relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl mx-auto relative z-10"
                >
                    <h2 className="text-4xl md:text-7xl font-black mb-8 leading-tight">READY TO <br />DOMINATE?</h2>
                    <p className="text-xl opacity-70 mb-10 font-medium">Join 500+ dealers saving thousands every month.</p>
                    <Link to="/create?start=true" className="inline-flex items-center gap-3 px-12 py-6 bg-blue-600 text-white rounded-full text-xl font-black hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-500/40">
                        LAUNCH STUDIO <ChevronRight className="w-6 h-6" />
                    </Link>
                    <div className="mt-8 flex items-center justify-center gap-8 opacity-40 grayscale">
                        {/* Placeholder for Trust logos */}
                        <span className="font-black italic text-2xl">BMW</span>
                        <span className="font-black italic text-2xl">AUDI</span>
                        <span className="font-black italic text-2xl">PORSCHE</span>
                        <span className="font-black italic text-2xl">MERCEDES</span>
                    </div>
                </motion.div>
            </section>

        </div>
    );
};

export default LandingPage;
