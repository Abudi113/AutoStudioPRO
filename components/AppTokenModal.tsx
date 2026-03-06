
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Copy, RefreshCw, CheckCircle, Key, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

interface AppTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function generateSecureToken(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = 4;
    const segmentLength = 4;
    const parts: string[] = [];
    for (let s = 0; s < segments; s++) {
        let segment = '';
        for (let i = 0; i < segmentLength; i++) {
            const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % chars.length;
            segment += chars[randomIndex];
        }
        parts.push(segment);
    }
    return parts.join('-');
}

const AppTokenModal: React.FC<AppTokenModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && user) {
            loadExistingToken();
        }
    }, [isOpen, user]);

    async function loadExistingToken() {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('app_tokens')
                .select('token')
                .eq('user_id', user!.id)
                .eq('is_active', true)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                // PGRST116 = no rows found, which is fine
                throw fetchError;
            }
            setToken(data?.token || null);
        } catch (err: any) {
            console.error('Error loading token:', err);
            setError('Failed to load token');
        }
        setLoading(false);
    }

    async function generateToken() {
        setRegenerating(true);
        setError(null);
        try {
            const newToken = generateSecureToken();

            // Delete existing token first
            await supabase
                .from('app_tokens')
                .delete()
                .eq('user_id', user!.id);

            // Insert new token
            const { error: insertError } = await supabase
                .from('app_tokens')
                .insert({
                    user_id: user!.id,
                    token: newToken,
                    is_active: true,
                });

            if (insertError) throw insertError;
            setToken(newToken);
        } catch (err: any) {
            console.error('Error generating token:', err);
            setError('Failed to generate token. Please try again.');
        }
        setRegenerating(false);
    }

    async function copyToken() {
        if (!token) return;
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = token;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

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

                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="flex justify-center mb-4">
                                    <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                                        <Smartphone className="w-8 h-8 text-blue-400" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Mobile App Access</h2>
                                <p className="text-gray-400 text-sm">
                                    Generate an access token to log in to the AutoStudio PRO mobile app.
                                </p>
                            </div>

                            {/* Token Display */}
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : token ? (
                                <div className="space-y-4">
                                    {/* Token Card */}
                                    <div className="bg-black border border-white/10 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                                                <Key className="w-3 h-3" /> Your Access Token
                                            </span>
                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                <Shield className="w-3 h-3" /> Active
                                            </span>
                                        </div>
                                        <div className="font-mono text-xl text-white tracking-[0.15em] text-center py-3 select-all">
                                            {token}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={copyToken}
                                            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${copied
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
                                                }`}
                                        >
                                            {copied ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4" /> Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4" /> Copy Token
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={generateToken}
                                            disabled={regenerating}
                                            className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Warning */}
                                    <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                        <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-blue-500/80">
                                            Keep this token private. Anyone with this token can access your account on the mobile app. Regenerating creates a new token and invalidates the old one.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <p className="text-gray-400 text-sm">
                                        You haven't generated a token yet. Create one to log in from the mobile app.
                                    </p>
                                    <button
                                        onClick={generateToken}
                                        disabled={regenerating}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {regenerating ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Key className="w-4 h-4" /> Generate Access Token
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="mt-6 pt-6 border-t border-white/5">
                                <p className="text-xs text-gray-500 text-center">
                                    Open the AutoStudio PRO app on your phone → paste this token → tap "Connect"
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AppTokenModal;
