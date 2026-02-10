import React, { useState } from 'react';
import { Check, CreditCard, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { loadStripe } from '@stripe/stripe-js';


// Initialize Stripe with public key from env
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

import { supabase } from '../services/supabaseClient';


const PricingPage: React.FC = () => {
    const { t } = useLanguage();
    const [billingCycle, setBillingCycle] = useState<'credits' | 'subscription'>('credits');
    const [customAmount, setCustomAmount] = useState<number | ''>('');
    const [customPrice, setCustomPrice] = useState<string>('-.--');
    const [loading, setLoading] = useState<string | null>(null);

    // Actual Stripe Price IDs
    const PRICE_IDS = {
        basic: 'price_1SydaeIYHtY4sN4xO1Jk9QyF',
        starter: 'price_1SyedYIYHtY4sN4xxG5QVfMO',
        professional: 'price_1SyedyIYHtY4sN4x4Dz4wSF8',
        subscription: 'price_1SyedyIYHtY4sN4x4Dz4wSF8', // Mapping Pro to subscription
        agency: 'price_agency', // Placeholder - requires real Stripe Price ID
    };

    const handleCheckout = async (priceId: string) => {
        setLoading(priceId);
        try {
            if (priceId === 'price_agency') {
                alert('The Agency plan is currently being finalized. Please contact sales for more information.');
                setLoading(null);
                return;
            }

            const { data: { session }, error: authError } = await supabase.auth.getSession();
            if (authError || !session) {
                // Redirect to login or show auth modal
                alert(t('accountRequired') || 'Please login to continue');
                setLoading(null);
                return;
            }

            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    priceId,
                    mode: billingCycle === 'subscription' ? 'subscription' : 'payment',
                    successUrl: window.location.origin + '/dashboard?success=true',
                    cancelUrl: window.location.origin + '/pricing'
                },
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            console.error('Checkout error:', error);
            alert('Failed to initiate checkout: ' + error.message);
        } finally {
            setLoading(null);
        }
    };

    const calculatePrice = (amount: number) => {
        if (!amount || amount < 20) return '-.--';

        let rate = 0.99; // Base rate
        if (amount >= 500) rate = 0.62;
        else if (amount >= 100) rate = 0.82;

        // Add approx Stripe fees (2.9% + 30c)
        const base = amount * rate;
        const total = (base + 0.30) / (1 - 0.029);
        return `$${total.toFixed(2)}`;
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setCustomAmount(val || '');
        setCustomPrice(calculatePrice(val));
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pt-24 pb-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-[var(--foreground)]">
                        {t('pricingTitle')}
                    </h1>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">
                        {t('pricingSubtitle')}
                    </p>
                </div>

                {/* Toggle */}
                <div className="flex justify-center mb-16">
                    <div className="bg-[var(--card)] border border-[var(--border)] p-1 rounded-xl flex items-center">
                        <button
                            onClick={() => setBillingCycle('credits')}
                            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all ${billingCycle === 'credits'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-500 hover:text-[var(--foreground)]'
                                }`}
                        >
                            {t('payAsYouGo')}
                        </button>
                        <button
                            onClick={() => setBillingCycle('subscription')}
                            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all ${billingCycle === 'subscription'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-500 hover:text-[var(--foreground)]'
                                }`}
                        >
                            {t('monthlySub')}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {billingCycle === 'credits' ? (
                        <>
                            {/* Starter Pack */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 flex flex-col shadow-lg hover:border-blue-500/50 transition-colors"
                            >
                                {/* 1. Plan Name */}
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-[var(--foreground)]">{t('starter')}</h3>
                                </div>

                                {/* 2. Big Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black text-[var(--foreground)]">€149</span>
                                        <span className="text-gray-500 text-lg">{t('month')}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">{t('billedMonthly')}</p>
                                </div>

                                {/* 3. Credits & Approx */}
                                <div className="mb-2">
                                    <div className="text-2xl font-bold text-blue-500 mb-1">
                                        375 {t('credits')} / {t('month').replace('/', '')}
                                    </div>
                                    <div className="text-sm text-gray-500 font-medium">
                                        {t('approxVehicles').replace('{count}', '10–12')}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 opacity-70">
                                        {t('approxVehiclesCalc')}
                                    </div>
                                </div>

                                {/* 4. Cost per image */}
                                <div className="mb-8">
                                    <div className="inline-block bg-[var(--foreground)]/5 rounded-lg px-3 py-1 text-xs font-bold text-gray-500">
                                        {t('pricePerImage').replace('{cost}', '€0.40')}
                                    </div>
                                </div>

                                {/* 5. Best For */}
                                <div className="mb-8 p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {t('bestFor').replace('{target}', t('packStarterDesc'))}
                                    </p>
                                </div>

                                {/* 6. What's Included */}
                                <ul className="space-y-3 mb-8 flex-1">
                                    {Object.values(t('featureList') || {}).map((feature: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                                            <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                                <Check className="w-3 h-3 text-green-500" />
                                            </div>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* 7. CTA */}
                                <button
                                    onClick={() => handleCheckout(PRICE_IDS.starter)}
                                    disabled={loading === PRICE_IDS.starter}
                                    className="w-full py-4 rounded-xl bg-[var(--background)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--border)] font-bold transition-all text-[var(--foreground)] disabled:opacity-50"
                                >
                                    {loading === PRICE_IDS.starter ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>{t('processing')}...</span>
                                        </div>
                                    ) : (
                                        t('getStarted')
                                    )}
                                </button>
                            </motion.div>

                            {/* Pro Pack */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-[var(--card)] border-2 border-blue-600 rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-2xl shadow-blue-900/10 order-first md:order-none transform md:-translate-y-4"
                            >
                                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">{t('popular')}</div>

                                {/* 1. Plan Name */}
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-blue-600">{t('professional')}</h3>
                                </div>

                                {/* 2. Big Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black text-[var(--foreground)]">€299</span>
                                        <span className="text-gray-500 text-lg">{t('month')}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">{t('billedMonthly')}</p>
                                </div>

                                {/* 3. Credits & Approx */}
                                <div className="mb-2">
                                    <div className="text-2xl font-bold text-blue-600 mb-1">
                                        1000 {t('credits')} / {t('month').replace('/', '')}
                                    </div>
                                    <div className="text-sm text-gray-500 font-medium">
                                        {t('approxVehicles').replace('{count}', '25–30')}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 opacity-70">
                                        {t('approxVehiclesCalc')}
                                    </div>
                                </div>

                                {/* 4. Cost per image */}
                                <div className="mb-8">
                                    <div className="inline-block bg-blue-600 text-white rounded-lg px-3 py-1 text-xs font-bold">
                                        {t('pricePerImage').replace('{cost}', '€0.30')}
                                    </div>
                                </div>

                                {/* 5. Best For */}
                                <div className="mb-8 p-4 bg-blue-600/10 rounded-xl border border-blue-600/20">
                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {t('bestFor').replace('{target}', t('packProDesc'))}
                                    </p>
                                </div>

                                {/* 6. What's Included */}
                                <ul className="space-y-3 mb-8 flex-1">
                                    {Object.values(t('featureList') || {}).map((feature: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-[var(--foreground)] font-bold">
                                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* 7. CTA */}
                                <button
                                    onClick={() => handleCheckout(PRICE_IDS.professional)}
                                    disabled={loading === PRICE_IDS.professional}
                                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/25 text-white disabled:opacity-50"
                                >
                                    {loading === PRICE_IDS.professional ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>{t('processing')}...</span>
                                        </div>
                                    ) : (
                                        t('getStarted')
                                    )}
                                </button>
                            </motion.div>

                            {/* Agency Pack */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 flex flex-col shadow-lg hover:border-blue-500/50 transition-colors"
                            >
                                {/* 1. Plan Name */}
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-[var(--foreground)]">{t('agency')}</h3>
                                </div>

                                {/* 2. Big Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black text-[var(--foreground)]">€599</span>
                                        <span className="text-gray-500 text-lg">{t('month')}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">{t('billedMonthly')}</p>
                                </div>

                                {/* 3. Credits & Approx */}
                                <div className="mb-2">
                                    <div className="text-2xl font-bold text-blue-500 mb-1">
                                        2500 {t('credits')} / {t('month').replace('/', '')}
                                    </div>
                                    <div className="text-sm text-gray-500 font-medium">
                                        {t('approxVehicles').replace('{count}', '70–80')}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 opacity-70">
                                        {t('approxVehiclesCalc')}
                                    </div>
                                </div>

                                {/* 4. Cost per image */}
                                <div className="mb-8">
                                    <div className="inline-block bg-[var(--foreground)]/5 rounded-lg px-3 py-1 text-xs font-bold text-gray-500">
                                        {t('pricePerImage').replace('{cost}', '€0.24')}
                                    </div>
                                </div>

                                {/* 5. Best For */}
                                <div className="mb-8 p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {t('bestFor').replace('{target}', t('packAgencyDesc'))}
                                    </p>
                                </div>

                                {/* 6. What's Included */}
                                <ul className="space-y-3 mb-8 flex-1">
                                    {Object.values(t('featureList') || {}).map((feature: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                                            <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                                <Check className="w-3 h-3 text-green-500" />
                                            </div>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* 7. CTA */}
                                <button
                                    onClick={() => handleCheckout(PRICE_IDS.agency)}
                                    disabled={loading === PRICE_IDS.agency}
                                    className="w-full py-4 rounded-xl bg-[var(--background)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--border)] font-bold transition-all text-[var(--foreground)] disabled:opacity-50"
                                >
                                    {loading === PRICE_IDS.agency ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>{t('processing')}...</span>
                                        </div>
                                    ) : (
                                        t('getStarted')
                                    )}
                                </button>
                            </motion.div>

                            {/* Custom Amount */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="md:col-span-3 mt-8 bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-lg"
                            >
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold mb-2 text-[var(--foreground)]">{t('customAmount')}</h3>
                                    <p className="text-gray-500">{t('needCustom')}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-[var(--background)] p-2 rounded-xl border border-[var(--border)]">
                                    <input
                                        type="number"
                                        min="20"
                                        placeholder="Amount"
                                        value={customAmount}
                                        onChange={handleCustomChange}
                                        className="bg-transparent text-[var(--foreground)] text-xl font-bold w-32 text-center focus:outline-none"
                                    />
                                    <span className="text-gray-500 font-bold pr-4">{t('credits')}</span>
                                </div>
                                <div className="text-right min-w-[120px]">
                                    <div className="text-sm text-gray-500 uppercase font-bold">{t('estPrice')}</div>
                                    <div className="text-2xl font-black text-blue-400">{customPrice}</div>
                                </div>
                                <button
                                    onClick={() => alert('Custom credit purchase coming soon!')}
                                    className="px-8 py-4 rounded-xl bg-[var(--background)] hover:bg-black/5 dark:hover:bg-white/5 font-bold transition-all border border-[var(--border)] text-[var(--foreground)]"
                                >
                                    {t('buyCredits')}
                                </button>
                            </motion.div>
                        </>
                    ) : (
                        <>
                            {/* Monthly Subscription */}
                            <div className="md:col-span-3 grid md:grid-cols-3 gap-8">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="md:col-start-2 bg-[var(--card)] border border-blue-500/30 rounded-3xl p-10 flex flex-col relative shadow-2xl"
                                >
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                                    <div className="text-center mb-8">
                                        <h3 className="text-3xl font-black mb-2 text-[var(--foreground)]">{t('proSubscription')}</h3>
                                        <p className="text-blue-500 font-medium">{t('scaleSubtitle')}</p>
                                    </div>

                                    <div className="text-center mb-8">
                                        <div className="flex items-baseline justify-center gap-1">
                                            <span className="text-5xl font-black text-[var(--foreground)]">$102.27</span>
                                            <span className="text-gray-500">{t('month')}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2">{t('billedMonthly')}</p>
                                    </div>

                                    <div className="space-y-4 mb-10 max-w-xs mx-auto">
                                        {[
                                            t('benefit150'),
                                            t('benefitRollover'),
                                            t('benefitPriority'),
                                            t('benefitBulk'),
                                            t('benefitApi')
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 text-gray-400">
                                                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <Check className="w-3.5 h-3.5 text-blue-500" />
                                                </div>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handleCheckout(PRICE_IDS.subscription)}
                                        disabled={loading === PRICE_IDS.subscription}
                                        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-lg transition-all shadow-xl shadow-blue-500/20 text-white disabled:opacity-50"
                                    >
                                        {loading === PRICE_IDS.subscription ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>{t('processing')}...</span>
                                            </div>
                                        ) : (
                                            t('startSub')
                                        )}
                                    </button>
                                </motion.div>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-20 text-center">
                    <p className="text-gray-500 mb-4">{t('needEnterprise')}</p>
                    <a href="/contact" className="text-[var(--foreground)] underline hover:text-blue-500 transition-colors">{t('contactSales')}</a>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
