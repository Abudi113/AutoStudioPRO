
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useCredits } from '../context/CreditsContext';
import { callEdgeFunction } from '../services/supabaseClient';

const PricingSuccess: React.FC = () => {
    const { theme } = useTheme();
    const { refreshCredits } = useCredits();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const isDark = theme === 'dark';

    const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
    const [creditsGranted, setCreditsGranted] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!sessionId) {
            setStatus('error');
            setErrorMsg('Keine Session-ID gefunden.');
            return;
        }

        const grantCredits = async () => {
            try {
                const result = await callEdgeFunction<{
                    success: boolean;
                    credits_granted?: number;
                    already_processed?: boolean;
                    error?: string;
                }>('grant-credits', { sessionId });

                if (result.success) {
                    setCreditsGranted(result.credits_granted ?? 0);
                    setStatus(result.already_processed ? 'already' : 'success');
                    await refreshCredits(); // update the navbar credit count
                } else {
                    setStatus('error');
                    setErrorMsg(result.error ?? 'Unbekannter Fehler');
                }
            } catch (e: any) {
                setStatus('error');
                setErrorMsg(e?.message ?? 'Verbindungsfehler');
            }
        };

        grantCredits();
    }, [sessionId]);

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'} flex items-center justify-center px-4`}>
            <div className="text-center max-w-lg">

                {/* Icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 ${status === 'error' ? 'bg-red-500/15' : 'bg-green-500/15'}`}
                >
                    {status === 'loading' && <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />}
                    {(status === 'success' || status === 'already') && <CheckCircle className="w-12 h-12 text-green-400" />}
                    {status === 'error' && <AlertCircle className="w-12 h-12 text-red-400" />}
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`text-4xl md:text-5xl font-black tracking-tighter mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
                >
                    {status === 'loading' && 'Credits werden gutgeschrieben…'}
                    {status === 'success' && 'Zahlung erfolgreich!'}
                    {status === 'already' && 'Bereits gutgeschrieben!'}
                    {status === 'error' && 'Fehler beim Gutschreiben'}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={`text-lg mb-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                >
                    {status === 'loading' && 'Bitte warten Sie einen Moment…'}
                    {status === 'success' && `${creditsGranted} Credits wurden Ihrem Konto gutgeschrieben.`}
                    {status === 'already' && 'Diese Zahlung wurde bereits verarbeitet.'}
                    {status === 'error' && (
                        <span className="text-red-400">{errorMsg}</span>
                    )}
                </motion.p>

                {/* Buttons */}
                {status !== 'loading' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center"
                    >
                        <Link
                            to="/create"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-all shadow-lg shadow-blue-500/20"
                        >
                            <Sparkles className="w-5 h-5" />
                            Jetzt Bilder erstellen
                        </Link>
                        <Link
                            to="/pricing"
                            className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold border transition-all ${isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-900'}`}
                        >
                            Zurück zur Preisübersicht <ArrowRight className="w-4 h-4" />
                        </Link>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default PricingSuccess;
