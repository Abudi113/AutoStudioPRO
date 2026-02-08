
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCredits } from '../context/CreditsContext';
import { useLanguage } from '../context/LanguageContext';

interface VaultModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const VaultModal: React.FC<VaultModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const { totalCredits, creditsVault, moveToVault, moveFromVault, loading } = useCredits();
    const [amount, setAmount] = useState<string>('');
    const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const availableToDeposit = totalCredits - creditsVault;
    const availableToWithdraw = creditsVault;

    const handleTransfer = async () => {
        const val = parseInt(amount);
        if (isNaN(val) || val <= 0) return;

        setStatus('idle');
        let success = false;

        if (mode === 'deposit') {
            if (val > availableToDeposit) return;
            // Cap at 20 vault limit not strictly enforced here but usually backend does it
            // Assuming backend handles the 20 limit or we check here
            if (creditsVault + val > 20) {
                alert(t('vaultLimitAlert'));
                return;
            }
            success = await moveToVault(val);
        } else {
            if (val > availableToWithdraw) return;
            success = await moveFromVault(val);
        }

        if (success) {
            setStatus('success');
            setAmount('');
            setTimeout(() => setStatus('idle'), 2000);
        } else {
            setStatus('error');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-6 md:p-8"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500 relative">
                                <Shield className="w-8 h-8" />
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-zinc-900">
                                    {creditsVault}
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{t('vaultTitle')}</h2>
                            <p className="text-gray-400 text-sm">
                                {t('vaultDesc')}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div
                                onClick={() => setMode('deposit')}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${mode === 'deposit' ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <p className="text-xs text-gray-400 mb-1">{t('available')}</p>
                                <p className="text-xl font-bold text-white mb-2">{availableToDeposit}</p>
                                <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                    {t('deposit')} <ArrowRight className="w-3 h-3" />
                                </div>
                            </div>
                            <div
                                onClick={() => setMode('withdraw')}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${mode === 'withdraw' ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <p className="text-xs text-gray-400 mb-1">{t('vaulted')}</p>
                                <p className="text-xl font-bold text-white mb-2">{creditsVault} <span className="text-sm text-gray-500 font-normal">/ 20</span></p>
                                <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                    <ArrowLeft className="w-3 h-3" /> {t('withdraw')}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                                    {mode === 'deposit' ? t('amountToStore') : t('amountToRetrieve')}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={mode === 'deposit' ? Math.min(availableToDeposit, 20 - creditsVault) : availableToWithdraw}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        placeholder="0"
                                    />
                                    <button
                                        onClick={() => setAmount(String(mode === 'deposit' ? Math.min(availableToDeposit, 20 - creditsVault) : availableToWithdraw))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-blue-500 hover:bg-blue-500/10 rounded"
                                    >
                                        {t('max')}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleTransfer}
                                disabled={loading || !amount || parseInt(amount) <= 0}
                                className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {loading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : status === 'success' ? (
                                    t('transferComplete')
                                ) : status === 'error' ? (
                                    t('transferFailed')
                                ) : (
                                    mode === 'deposit' ? t('storeInVault') : t('retrieveFromVault')
                                )}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default VaultModal;
