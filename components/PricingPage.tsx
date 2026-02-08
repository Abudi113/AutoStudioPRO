
import React, { useState } from 'react';
import { Check, CreditCard, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const PricingPage: React.FC = () => {
    const [billingCycle, setBillingCycle] = useState<'credits' | 'subscription'>('credits');
    const [customAmount, setCustomAmount] = useState<number | ''>('');
    const [customPrice, setCustomPrice] = useState<string>('-.--');

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
        <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Choose the plan that fits your studio needs. Pay per image or subscribe for maximum savings.
                    </p>
                </div>

                {/* Toggle */}
                <div className="flex justify-center mb-16">
                    <div className="bg-white/5 p-1 rounded-xl flex items-center">
                        <button
                            onClick={() => setBillingCycle('credits')}
                            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all ${billingCycle === 'credits'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Pay As You Go (Credits)
                        </button>
                        <button
                            onClick={() => setBillingCycle('subscription')}
                            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all ${billingCycle === 'subscription'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Monthly Subscription
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
                                className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 flex flex-col"
                            >
                                <div className="mb-4">
                                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Starter</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-2">20 Credits</h3>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-4xl font-black">$19.88</span>
                                    <span className="text-gray-500 text-sm">inc. fees</span>
                                </div>
                                <p className="text-gray-400 mb-8 flex-1">Perfect for trying out the studio or one-off projects.</p>
                                <button className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold transition-all">
                                    Buy Credits
                                </button>
                            </motion.div>

                            {/* Pro Pack */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-zinc-900 border border-blue-500/30 rounded-3xl p-8 flex flex-col relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
                                <div className="mb-4">
                                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Professional</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-2">100 Credits</h3>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-4xl font-black">$81.67</span>
                                    <span className="text-gray-500 text-sm">inc. fees</span>
                                </div>
                                <p className="text-gray-400 mb-8 flex-1">Best value for small dealerships and photographers.</p>
                                <ul className="space-y-3 mb-8 text-gray-300">
                                    <li className="flex items-center gap-3">
                                        <Check className="w-5 h-5 text-blue-500" />
                                        <span>Full Studio Access</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="w-5 h-5 text-blue-500" />
                                        <span>High-Res Downloads</span>
                                    </li>
                                </ul>
                                <button className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/25">
                                    Buy Credits
                                </button>
                            </motion.div>

                            {/* Agency Pack */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 flex flex-col"
                            >
                                <div className="mb-4">
                                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Agency</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-2">500 Credits</h3>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-4xl font-black">$308.24</span>
                                    <span className="text-gray-500 text-sm">inc. fees</span>
                                </div>
                                <p className="text-gray-400 mb-8 flex-1">High volume processing for large inventories.</p>
                                <button className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold transition-all">
                                    Buy Credits
                                </button>
                            </motion.div>

                            {/* Custom Amount */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="md:col-span-3 mt-8 bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8"
                            >
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold mb-2">Custom Amount</h3>
                                    <p className="text-gray-400">Need specific credits? Calculate instantly.</p>
                                </div>
                                <div className="flex items-center gap-4 bg-black/50 p-2 rounded-xl border border-white/10">
                                    <input
                                        type="number"
                                        min="20"
                                        placeholder="Amount"
                                        value={customAmount}
                                        onChange={handleCustomChange}
                                        className="bg-transparent text-white text-xl font-bold w-32 text-center focus:outline-none"
                                    />
                                    <span className="text-gray-500 font-bold pr-4">Credits</span>
                                </div>
                                <div className="text-right min-w-[120px]">
                                    <div className="text-sm text-gray-500 uppercase font-bold">Est. Price</div>
                                    <div className="text-2xl font-black text-blue-400">{customPrice}</div>
                                </div>
                                <button className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold transition-all">
                                    Buy Credits
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
                                    className="md:col-start-2 bg-gradient-to-b from-blue-900/20 to-black border border-blue-500/30 rounded-3xl p-10 flex flex-col relative"
                                >
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                                    <div className="text-center mb-8">
                                        <h3 className="text-3xl font-black mb-2">Pro Subscription</h3>
                                        <p className="text-blue-400 font-medium">Everything you need to scale</p>
                                    </div>

                                    <div className="text-center mb-8">
                                        <div className="flex items-baseline justify-center gap-1">
                                            <span className="text-5xl font-black">$102.27</span>
                                            <span className="text-gray-500">/month</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2">Billed monthly (includes Stripe processing fees)</p>
                                    </div>

                                    <div className="space-y-4 mb-10 max-w-xs mx-auto">
                                        {[
                                            "150 Credits per month",
                                            "Rollover unused credits (to Vault)",
                                            "Priority Processing",
                                            "Bulk Export Tools",
                                            "API Access"
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 text-gray-300">
                                                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <Check className="w-3.5 h-3.5 text-blue-500" />
                                                </div>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-lg transition-all shadow-xl shadow-blue-500/20">
                                        Start Subscription
                                    </button>
                                </motion.div>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-20 text-center">
                    <p className="text-gray-500 mb-4">Need a custom enterprise plan?</p>
                    <a href="/contact" className="text-white underline hover:text-blue-400 transition-colors">Contact our sales team</a>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
