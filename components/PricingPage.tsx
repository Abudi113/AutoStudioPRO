
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, TrendingUp, Building2, Star, Plus, Calculator, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import { callEdgeFunction } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

// ─── Data ────────────────────────────────────────────────────────────────────

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        icon: Zap,
        color: 'from-emerald-500 to-teal-500',
        border: 'border-emerald-500/30',
        glow: 'shadow-emerald-500/10',
        badge: null,
        images: 300,
        pricePerImage: 0.33,
        monthly: 99,
        inventory: '20–50 Fahrzeuge',
        sales: '8–10 Autos / Monat',
        discount: 'Basispreis',
        features: [
            'Studio-Generierung',
            'Bild-Enhancement',
            'Logo-Branding',
            'Download in hoher Qualität',
            'Self-Service Zugang',
        ],
    },
    {
        id: 'growth',
        name: 'Growth',
        icon: TrendingUp,
        color: 'from-blue-500 to-indigo-500',
        border: 'border-blue-500/30',
        glow: 'shadow-blue-500/10',
        badge: 'Beliebt',
        images: 1000,
        pricePerImage: 0.29,
        monthly: 299,
        inventory: '50–150 Fahrzeuge',
        sales: '25–30 Autos / Monat',
        discount: '12 % Rabatt',
        features: [
            'Alles aus Starter',
            'Priorisierte Verarbeitung',
            'Erweiterte Studioauswahl',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        icon: Star,
        color: 'from-rose-500 to-pink-500',
        border: 'border-rose-500/30',
        glow: 'shadow-rose-500/10',
        badge: 'Bestes Preis-Leistungs-Verhältnis',
        images: 3000,
        pricePerImage: 0.23,
        monthly: 699,
        inventory: '150–400 Fahrzeuge',
        sales: '80–90 Autos / Monat',
        discount: '30 % Rabatt',
        features: [
            'Alles aus Growth',
            'Höchste Priorität',
            'Individuelle Branding-Optionen',
            'Multi-Standort Nutzung',
        ],
    },
];

const ADDONS = [
    { images: 100, pricePerImage: 0.39, total: 39, label: 'Small Top-Up' },
    { images: 300, pricePerImage: 0.33, total: 99, label: 'Medium Top-Up' },
    { images: 500, pricePerImage: 0.29, total: 145, label: 'Large Top-Up' },
];

// ─── Recommendation Calculator ───────────────────────────────────────────────

const INVENTORY_OPTIONS = [
    { label: 'Bis 20 Fahrzeuge', value: 20 },
    { label: '20 – 50 Fahrzeuge', value: 35 },
    { label: '50 – 150 Fahrzeuge', value: 100 },
    { label: '150 – 400 Fahrzeuge', value: 275 },
    { label: '400+ Fahrzeuge', value: 500 },
];

const PICS_OPTIONS = [
    { label: '10 – 20 Bilder', value: 15 },
    { label: '20 – 30 Bilder', value: 25 },
    { label: '30 – 40 Bilder', value: 35 },
    { label: '40 – 60 Bilder', value: 50 },
];

function getRecommendation(inventory: number, pics: number): { plan: typeof PLANS[0] | null; monthly: number; isEnterprise: boolean } {
    // assume ~30% of inventory turns over per month
    const monthlyCars = Math.ceil(inventory * 0.3);
    const monthly = monthlyCars * pics;

    if (inventory >= 400) return { plan: null, monthly, isEnterprise: true };
    if (monthly <= 300) return { plan: PLANS[0], monthly, isEnterprise: false };
    if (monthly <= 1000) return { plan: PLANS[1], monthly, isEnterprise: false };
    return { plan: PLANS[2], monthly, isEnterprise: false };
}

const RecommendationCard: React.FC<{ theme: string }> = ({ theme }) => {
    const [inventory, setInventory] = useState<number | null>(null);
    const [pics, setPics] = useState<number | null>(null);
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const isDark = theme === 'dark';
    const card = isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200';
    const pill = isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-blue-50';
    const pillActive = 'bg-blue-600 border-blue-600 text-white';

    const result = inventory !== null && pics !== null ? getRecommendation(inventory, pics) : null;

    const reset = () => { setInventory(null); setPics(null); setStep(1); };

    return (
        <div className={`rounded-3xl border p-8 ${card} relative overflow-hidden`}>
            {/* glowing bg */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                        <Calculator className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Empfehlung</span>
                </div>
                <h3 className={`text-2xl font-black mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Paktet-Finder</h3>
                <p className={`text-sm mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Beantworte 2 Fragen — wir empfehlen das perfekte Paket.
                </p>

                {/* Step 1 */}
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <p className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                1. Wie groß ist Ihr Fahrzeugbestand?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {INVENTORY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setInventory(opt.value); setStep(2); }}
                                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${inventory === opt.value ? pillActive : pill}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <p className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                2. Wie viele Bilder planen Sie pro Fahrzeug?
                            </p>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {PICS_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setPics(opt.value); setStep(3); }}
                                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${pics === opt.value ? pillActive : pill}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-gray-400 underline">← Zurück</button>
                        </motion.div>
                    )}

                    {step === 3 && result && (
                        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            {result.isEnterprise ? (
                                <div className="text-center py-4">
                                    <div className="text-5xl mb-3">🏢</div>
                                    <p className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Enterprise</p>
                                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Ihr Volumen: <span className="font-bold text-purple-400">~{result.monthly.toLocaleString()} Bilder/Monat</span>
                                    </p>
                                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Für Ihren Bestand empfehlen wir ein individuelles Enterprise-Angebot mit Volumenpreisen unter 0,30 €/Bild.
                                    </p>
                                    <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-all">
                                        Angebot anfragen <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            ) : (
                                <div>
                                    <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Ihr geschätztes Volumen: <span className="font-bold text-blue-400">~{result.monthly.toLocaleString()} Bilder/Monat</span>
                                    </p>
                                    <p className={`text-xs mb-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        (basierend auf ~30 % Bestandsumschlag/Monat)
                                    </p>

                                    {result.plan && (
                                        <div className={`rounded-2xl p-5 bg-gradient-to-br ${result.plan.color} bg-opacity-10 border ${result.plan.border} mb-5`}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <result.plan.icon className="w-5 h-5 text-white" />
                                                <span className="font-black text-white text-lg">{result.plan.name}</span>
                                                <span className="ml-auto text-white/80 text-sm font-bold">{result.plan.monthly.toLocaleString()} €/Monat</span>
                                            </div>
                                            <p className="text-white/80 text-sm mb-1">{result.plan.images.toLocaleString()} Bilder inkl. · {result.plan.pricePerImage.toFixed(2)} € / Bild</p>
                                            <p className="text-white/60 text-xs">{result.plan.discount} gegenüber Starter</p>
                                        </div>
                                    )}

                                    <Link
                                        to="/contact"
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-full font-bold text-white transition-all bg-gradient-to-r ${result.plan?.color} hover:opacity-90 mb-3`}
                                    >
                                        Jetzt starten <ChevronRight className="w-4 h-4" />
                                    </Link>
                                    <button onClick={reset} className="w-full text-xs text-gray-500 hover:text-gray-400 underline">Neu berechnen</button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PricingPage: React.FC = () => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const isDark = theme === 'dark';
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [tab, setTab] = useState<'abos' | 'einzeln'>('abos');
    const [showRecommendation, setShowRecommendation] = useState(false);

    // Contact form state
    const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', phone: '', message: '' });
    const [contactSubmitting, setContactSubmitting] = useState(false);
    const [contactSent, setContactSent] = useState(false);

    const bg = isDark ? 'bg-[#0a0a0a]' : 'bg-white';
    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-600';
    const cardBg = isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200';

    const startCheckout = async (planId: string) => {
        setLoadingPlan(planId);
        try {
            const origin = window.location.origin;
            const { url } = await callEdgeFunction<{ url: string }>('create-checkout', {
                planId,
                userId: user?.id ?? '',
                successUrl: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${origin}/pricing`,
            });
            window.location.href = url;
        } catch (err: any) {
            alert(`Fehler beim Öffnen von Stripe: ${err.message}`);
        } finally {
            setLoadingPlan(null);
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' } }),
    };

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setContactSubmitting(true);
        try {
            await callEdgeFunction('enterprise-inquiry', {
                name: contactForm.name,
                email: contactForm.email,
                company: contactForm.company,
                phone: contactForm.phone,
                message: contactForm.message,
            });
            setContactSent(true);
            setContactForm({ name: '', email: '', company: '', phone: '', message: '' });
        } catch (err: any) {
            alert(`Fehler beim Senden: ${err.message}`);
        } finally {
            setContactSubmitting(false);
        }
    };

    return (
        <div className={`min-h-screen ${bg} transition-colors duration-300 pt-28 pb-24 px-4`}>
            {/* Header */}
            <div className="text-center mb-12 max-w-3xl mx-auto">
                <motion.span
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                    className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-6"
                >
                    Preise & Pakete
                </motion.span>
                <motion.h1
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                    className={`text-5xl md:text-7xl font-black tracking-tighter mb-6 ${textPrimary}`}
                >
                    Einfache,<br />transparente Preise
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                    className={`text-xl ${textSub} mb-10`}
                >
                    Ø 35–40 Bilder pro Fahrzeug. Kein Vertrag, monatlich kündbar.
                </motion.p>

                {/* ── Toggle + Empfehlung ── */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                    className="relative flex items-center justify-center"
                >
                    <div className={`inline-flex rounded-full p-1 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                        {(['abos', 'einzeln'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-8 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${tab === t
                                    ? isDark
                                        ? 'bg-white text-gray-900 shadow'
                                        : 'bg-gray-900 text-white shadow'
                                    : isDark
                                        ? 'text-gray-400 hover:text-white'
                                        : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                {t === 'abos' ? 'Abos' : 'Einzeln'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowRecommendation(!showRecommendation)}
                        className={`absolute right-0 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-300 flex items-center gap-2 border ${showRecommendation
                            ? isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-700 border-purple-300'
                            : isDark ? 'text-purple-400 hover:text-purple-300 border-purple-500/30 hover:bg-purple-500/10' : 'text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50'
                            }`}
                    >
                        <Calculator className="w-4 h-4" />
                        Empfehlung
                    </button>
                </motion.div>

                {/* Inline Recommendation */}
                <AnimatePresence>
                    {showRecommendation && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden max-w-lg mx-auto mt-6"
                        >
                            <RecommendationCard theme={theme} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">
                {tab === 'abos' && (
                    <motion.div
                        key="abos"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Plan Cards */}
                        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-8">
                            {PLANS.map((plan, i) => (
                                <motion.div
                                    key={plan.id}
                                    custom={i}
                                    initial="hidden"
                                    animate="visible"
                                    variants={itemVariants}
                                    className={`relative rounded-3xl border p-8 ${cardBg} shadow-xl ${plan.glow} flex flex-col overflow-hidden group hover:scale-[1.02] transition-transform duration-500`}
                                >
                                    <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${plan.color} opacity-10 blur-[60px] pointer-events-none group-hover:opacity-20 transition-opacity`} />

                                    {plan.badge && (
                                        <div className={`absolute top-5 right-5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${plan.color} text-white`}>
                                            {plan.badge}
                                        </div>
                                    )}

                                    <div className="relative z-10 mb-6">
                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}>
                                            <plan.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <p className={`text-sm font-bold uppercase tracking-widest ${textSub} mb-1`}>{plan.name}</p>
                                        <div className="flex items-end gap-2">
                                            <span className={`text-5xl font-black ${textPrimary} tracking-tighter`}>{plan.monthly.toLocaleString()} €</span>
                                            <span className={`${textSub} mb-2`}>/Monat</span>
                                        </div>
                                        <p className={`text-sm ${textSub} mt-1`}>
                                            {plan.images.toLocaleString()} Bilder · <span className="font-bold">{plan.pricePerImage.toFixed(2)} €/Bild</span>
                                        </p>
                                    </div>

                                    <div className={`relative z-10 rounded-2xl p-4 mb-6 ${isDark ? 'bg-white/5' : 'bg-white'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${textSub}`}>Ideal für</p>
                                        <p className={`text-sm font-medium ${textPrimary}`}>{plan.inventory}</p>
                                        <p className={`text-sm ${textSub}`}>{plan.sales}</p>
                                        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                            <p className="text-xs font-bold text-green-400">✓ {plan.discount}</p>
                                        </div>
                                    </div>

                                    <ul className="relative z-10 space-y-2.5 flex-1 mb-8">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-center gap-3">
                                                <Check className="w-4 h-4 text-green-400 shrink-0" />
                                                <span className={`text-sm ${textSub}`}>{f}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        onClick={() => startCheckout(plan.id)}
                                        disabled={loadingPlan !== null}
                                        className={`relative z-10 w-full py-3.5 rounded-2xl font-bold text-white transition-all bg-gradient-to-r ${plan.color} hover:opacity-90 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60`}
                                    >
                                        {loadingPlan === plan.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {loadingPlan === plan.id ? 'Wird geladen…' : 'Jetzt starten'}
                                        {loadingPlan !== plan.id && <ArrowRight className="w-4 h-4" />}
                                    </button>
                                </motion.div>
                            ))}
                        </div>

                        {/* Enterprise — Full Width Premium Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
                            className="max-w-6xl mx-auto mt-8 relative"
                        >
                            {/* Gradient border wrapper */}
                            <div className="absolute -inset-[1px] rounded-[26px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 opacity-60 blur-[1px]" />
                            <div className={`relative rounded-3xl p-8 md:p-10 overflow-hidden ${isDark ? 'bg-[#0f0f0f]' : 'bg-white'}`}>
                                {/* Multiple glow orbs */}
                                <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/15 blur-[120px] rounded-full pointer-events-none" />
                                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-orange-500/15 blur-[100px] rounded-full pointer-events-none" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-400/5 blur-[80px] rounded-full pointer-events-none" />

                                {/* Top badge */}
                                <div className="relative z-10 flex items-center justify-between mb-6">
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 }}
                                        className="flex items-center gap-3"
                                    >
                                        <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                                            ⭐ Enterprise
                                        </div>
                                        <span className={`text-sm font-bold ${isDark ? 'text-amber-400/60' : 'text-amber-600/60'}`}>400+ Fahrzeuge</span>
                                    </motion.div>
                                </div>

                                <div className="relative z-10 grid md:grid-cols-2 gap-10">
                                    {/* Left: Enterprise Info */}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-4 mb-5">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/25">
                                                <Building2 className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <p className={`text-4xl font-black tracking-tight ${textPrimary}`}>Individuelles Angebot</p>
                                            </div>
                                        </div>
                                        <p className={`text-lg mb-8 ${textSub}`}>
                                            Volumenpreis unter <span className="font-black text-amber-500">0,23 €</span> / Bild möglich — maßgeschneidert für Ihren Bedarf.
                                        </p>
                                        <div className="grid grid-cols-2 gap-3 mb-6 flex-1">
                                            {[
                                                { icon: '🏢', text: 'Große Händlergruppen' },
                                                { icon: '📍', text: 'Mehrere Standorte' },
                                                { icon: '⚡', text: 'Hohe monatliche Drehzahl' },
                                                { icon: '👤', text: 'Dedizierter Account Manager' },
                                                { icon: '🛡️', text: 'SLA & Prioritäts-Support' },
                                                { icon: '🔌', text: 'Individuelle API-Integration' },
                                            ].map(f => (
                                                <div key={f.text} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isDark ? 'bg-white/5 border border-white/5' : 'bg-amber-50/50 border border-amber-100'}`}>
                                                    <span className="text-lg">{f.icon}</span>
                                                    <span className={`text-sm font-medium ${textSub}`}>{f.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right: Contact Form */}
                                    <div className={`rounded-2xl border p-6 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                                        <h4 className={`text-lg font-black mb-1 ${textPrimary}`}>Angebot anfragen</h4>
                                        <p className={`text-sm ${textSub} mb-5`}>Wir melden uns innerhalb von 24 Stunden.</p>
                                        {contactSent ? (
                                            <div className="text-center py-8">
                                                <div className="text-4xl mb-3">✅</div>
                                                <p className={`font-bold ${textPrimary}`}>Nachricht gesendet!</p>
                                                <p className={`text-sm ${textSub}`}>Wir melden uns in Kürze.</p>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleContactSubmit} className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Name *"
                                                        required
                                                        value={contactForm.name}
                                                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                                                        className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-amber-500/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Firma"
                                                        value={contactForm.company}
                                                        onChange={e => setContactForm(f => ({ ...f, company: e.target.value }))}
                                                        className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-amber-500/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                                    />
                                                </div>
                                                <input
                                                    type="email"
                                                    placeholder="E-Mail *"
                                                    required
                                                    value={contactForm.email}
                                                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                                    className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-amber-500/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                                />
                                                <input
                                                    type="tel"
                                                    placeholder="Telefon"
                                                    value={contactForm.phone}
                                                    onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                                    className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-amber-500/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                                />
                                                <textarea
                                                    placeholder="Nachricht (optional)"
                                                    rows={3}
                                                    value={contactForm.message}
                                                    onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                                                    className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all resize-none focus:ring-2 focus:ring-amber-500/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={contactSubmitting}
                                                    className="w-full py-3 rounded-xl font-bold text-white transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
                                                >
                                                    {contactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                                    {contactSubmitting ? 'Wird gesendet…' : 'Anfrage senden'}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {
                    tab === 'einzeln' && (
                        <motion.div
                            key="einzeln"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.35 }}
                            className="max-w-6xl mx-auto"
                        >
                            <div className="text-center mb-12">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-sm tracking-widest uppercase mb-4">
                                    Flexibel nachbuchen
                                </span>
                                <h2 className={`text-4xl font-black ${textPrimary} tracking-tighter`}>Credit Add-Ons</h2>
                                <p className={`${textSub} mt-3`}>Kein Paket-Wechsel nötig — einfach Bilder nachbuchen wenn Sie sie brauchen.</p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                {ADDONS.map((addon, i) => (
                                    <motion.div
                                        key={i}
                                        custom={i}
                                        initial="hidden"
                                        animate="visible"
                                        variants={itemVariants}
                                        className={`rounded-3xl border p-7 ${cardBg} relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500`}
                                    >
                                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                                                    <Plus className="w-4 h-4 text-blue-400" />
                                                </div>
                                                <span className={`text-sm font-bold ${textSub}`}>{addon.label}</span>
                                            </div>
                                            <p className={`text-4xl font-black ${textPrimary} tracking-tighter mb-1`}>
                                                {addon.images.toLocaleString()} <span className="text-xl font-medium text-gray-500">Bilder</span>
                                            </p>
                                            <p className="text-blue-400 font-bold text-lg mb-1">{addon.total.toLocaleString()} €</p>
                                            <p className={`text-sm ${textSub}`}>{addon.pricePerImage.toFixed(2)} € pro Bild</p>
                                            <button
                                                onClick={() => startCheckout('addon_' + addon.images)}
                                                disabled={loadingPlan !== null}
                                                className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm disabled:opacity-60"
                                            >
                                                {loadingPlan === 'addon_' + addon.images ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                                {loadingPlan === 'addon_' + addon.images ? 'Wird geladen…' : 'Add-On kaufen'}
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <p className={`text-center text-xs ${textSub} mt-8 opacity-60`}>
                                Add-Ons sind nicht als Ersatz für ein Monatspaket gedacht — sie dienen ausschließlich als Ergänzung.
                            </p>
                        </motion.div>
                    )
                }
            </AnimatePresence>
        </div >
    );
};

export default PricingPage;
