import React, { useState, useEffect } from 'react';
import { X, Smartphone, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { callEdgeFunction } from '../services/supabaseClient';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { session } = useAuth();
    const { t } = useLanguage();
    const [token, setToken] = useState<string | null>(null);
    const [visible, setVisible] = useState(true);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch the permanent token when modal opens
    useEffect(() => {
        if (isOpen && session?.access_token && !token) {
            fetchToken();
        }
    }, [isOpen, session?.access_token]);

    const fetchToken = async () => {
        if (!session?.access_token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await callEdgeFunction<{ token: string }>('generate-app-token', {
                access_token: session.access_token,
            });
            setToken(data.token);
        } catch (err: any) {
            setError(err.message || 'Failed to load token');
        } finally {
            setLoading(false);
        }
    };

    const copyToken = async () => {
        if (!token) return;
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = token;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setVisible(false);
        onClose();
    };

    const maskedToken = token ? token.replace(/[A-Z0-9]/g, '•') : '';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                            <h2 className="text-lg font-bold">{t('settings')}</h2>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-lg hover:bg-gray-500/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* Mobile App Access Section */}
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <Smartphone className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base">{t('mobileAppAccess')}</h3>
                                    <p className="text-sm opacity-60">{t('mobileAppAccessDesc')}</p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : token ? (
                                <div className="space-y-3">
                                    {/* Token Display */}
                                    <div className="p-4 bg-black/20 border border-[var(--border)] rounded-xl">
                                        <p className="text-xs opacity-50 mb-2 uppercase tracking-wider font-medium">{t('yourAccessToken')}</p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 text-lg font-mono font-bold text-blue-400 tracking-[0.15em] text-center select-all">
                                                {visible ? token : maskedToken}
                                            </code>
                                            <button
                                                onClick={() => setVisible(v => !v)}
                                                className="p-2 rounded-lg hover:bg-gray-500/10 transition-colors flex-shrink-0"
                                                title={visible ? t('hideToken') : t('showToken')}
                                            >
                                                {visible ? (
                                                    <EyeOff className="w-5 h-5 opacity-60" />
                                                ) : (
                                                    <Eye className="w-5 h-5 opacity-60" />
                                                )}
                                            </button>
                                            <button
                                                onClick={copyToken}
                                                className="p-2 rounded-lg hover:bg-gray-500/10 transition-colors flex-shrink-0"
                                                title={t('copyToken')}
                                            >
                                                {copied ? (
                                                    <Check className="w-5 h-5 text-green-500" />
                                                ) : (
                                                    <Copy className="w-5 h-5 opacity-60" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-sm opacity-60 text-center leading-relaxed">
                                        {t('tokenInstructions')}
                                    </p>
                                </div>
                            ) : error ? (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-sm text-red-500">{error}</p>
                                </div>
                            ) : null}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SettingsModal;
