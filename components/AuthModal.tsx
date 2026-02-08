
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    title = "Save Your Work",
    description = "Create a free account to download your high-quality studio photos."
}) => {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await signIn(email);
            if (error) throw error;
            setSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send login link');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
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

                        {!sent ? (
                            <>
                                <div className="text-center mb-8">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                                    <p className="text-gray-400">{description}</p>
                                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold">
                                        <CheckCircle className="w-3 h-3" /> Includes 5 Free Credits
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            id="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>

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
                                        {loading ? 'Sending Link...' : <>Continue with Email <ArrowRight className="w-4 h-4" /></>}
                                    </button>
                                </form>
                                <p className="mt-6 text-center text-xs text-gray-500">
                                    We'll email you a magic link for a password-free sign in.
                                </p>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 animate-pulse">
                                    <CheckCircle className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-4">Check your inbox!</h2>
                                <p className="text-gray-400 mb-8">
                                    We've sent a magic login link to <span className="text-white font-medium">{email}</span>. Click it to confirm your account and get your credits.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors border border-white/10"
                                >
                                    Close Window
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default AuthModal;
