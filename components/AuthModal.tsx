
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    initialMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    initialMode = 'login'
}) => {
    const { t } = useLanguage();
    const { signIn, signInWithPassword, signUpWithPassword } = useAuth();
    const [mode, setMode] = useState<'login' | 'register' | 'magic-link'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync mode with prop
    React.useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setEmail('');
            setPassword('');
            setSent(false);
            setError(null);
        }
    }, [isOpen, initialMode]);

    // Use props if provided, otherwise use translations
    const displayTitle = title || (mode === 'register' ? t('createAccount') : t('authTitle'));
    const displayDesc = description || t('authDesc');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'magic-link') {
                const { error } = await signIn(email);
                if (error) throw error;
                setSent(true);
            } else if (mode === 'register') {
                const { error } = await signUpWithPassword(email, password);
                if (error) throw error;
                setSent(true); // Wait for email confirmation or auto-login
            } else if (mode === 'login') {
                const { error } = await signInWithPassword(email, password);
                if (error) throw error;
                onClose(); // Automatically close on successful login
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[-1]"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 relative z-10"
                        >
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {!sent ? (
                                <>
                                    <div className="text-center mb-8">
                                        <div className="flex justify-center mb-6">
                                            <img src="/logo.png" alt="Carveo Logo" className="h-10 w-auto brightness-125" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-2">{displayTitle}</h2>
                                        <p className="text-gray-400">{displayDesc}</p>
                                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold">
                                            <CheckCircle className="w-3 h-3" /> {t('includesFreeCredits')}
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">{t('labelEmail')}</label>
                                            <input
                                                type="email"
                                                id="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder={t('emailPlaceholder')}
                                                className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                            />
                                        </div>

                                        {mode !== 'magic-link' && (
                                            <div>
                                                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">{t('labelPassword') || 'Password'}</label>
                                                <input
                                                    type="password"
                                                    id="password"
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder={t('passwordPlaceholder') || 'Enter password'}
                                                    className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                />
                                            </div>
                                        )}

                                        {error && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                                {error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {loading ? t('sendingLink') : <>{mode === 'magic-link' ? t('continueEmail') : (mode === 'register' ? t('createAccount') : t('loginWithPassword'))} <ArrowRight className="w-4 h-4" /></>}
                                        </button>
                                    </form>
                                    <div className="mt-6 text-center space-y-3">
                                        {mode === 'login' && (
                                            <button onClick={() => { setMode('register'); setError(null); }} className="text-sm text-gray-400 hover:text-white transition-colors">
                                                {t('dontHaveAccount')}
                                            </button>
                                        )}
                                        {mode === 'register' && (
                                            <button onClick={() => { setMode('login'); setError(null); }} className="text-sm text-gray-400 hover:text-white transition-colors">
                                                {t('alreadyHaveAccount')}
                                            </button>
                                        )}
                                        {mode !== 'register' && (
                                            <div>
                                                <button onClick={() => { setMode(mode === 'magic-link' ? 'login' : 'magic-link'); setError(null); }} className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-2">
                                                    {mode === 'magic-link' ? t('usePasswordLog') : t('useMagicLink')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 animate-pulse">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-4">{t('checkInbox')}</h2>
                                    <p className="text-gray-400 mb-8">
                                        {t('magicLinkSent')} <span className="text-white font-medium">{email}</span>. Click it to confirm your account and get your credits.
                                    </p>
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors border border-white/10"
                                    >
                                        {t('closeWindow')}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AuthModal;
