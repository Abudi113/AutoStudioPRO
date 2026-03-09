import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Check, RotateCcw, ArrowLeft, Loader2, AlertCircle, Keyboard } from 'lucide-react';
import { callEdgeFunction } from '../services/supabaseClient';
import { useLanguage } from '../context/LanguageContext';

interface VinScannerProps {
    onComplete: (vin: string) => void;
    onBack: () => void;
    theme: 'light' | 'dark';
}

const VinScanner: React.FC<VinScannerProps> = ({ onComplete, onBack, theme }) => {
    const { t } = useLanguage();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [hasCamera, setHasCamera] = useState(true);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [detectedVin, setDetectedVin] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualMode, setManualMode] = useState(false);
    const [manualVin, setManualVin] = useState('');

    // Start camera
    useEffect(() => {
        if (!manualMode) startCamera();
        return () => stopCamera();
    }, [manualMode]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setHasCamera(true);
        } catch (err) {
            console.error('Camera access failed:', err);
            setHasCamera(false);
            setManualMode(true); // No camera → go straight to manual
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const capturePhoto = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
        sendForOcr(dataUrl);
    }, []);

    const sendForOcr = async (imageData: string) => {
        setLoading(true);
        setError(null);
        setDetectedVin(null);
        try {
            console.log('[VinScanner] Sending image for OCR...');
            const result = await callEdgeFunction<{ vin: string; confidence: number }>('process-image', {
                action: 'read-vin',
                payload: { base64Image: imageData }
            });
            console.log('[VinScanner] OCR result:', result);
            if (result.vin && result.vin.length > 0) {
                setDetectedVin(result.vin);
            } else {
                setError(t('vinNotFound'));
            }
        } catch (err: any) {
            console.error('[VinScanner] OCR error:', err);
            setError(err.message || 'VIN scan failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        setCapturedImage(null);
        setDetectedVin(null);
        setError(null);
        setManualMode(false);
        setManualVin('');
    };

    const handleConfirm = () => {
        if (detectedVin) {
            stopCamera();
            onComplete(detectedVin);
        }
    };

    const handleManualSubmit = () => {
        const cleaned = manualVin.replace(/[\s\-]/g, '').toUpperCase();
        if (cleaned.length === 17) {
            stopCamera();
            onComplete(cleaned);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setCapturedImage(dataUrl);
            sendForOcr(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const isDark = theme === 'dark';
    const isManualValid = manualVin.replace(/[\s\-]/g, '').length === 17;

    // ─── MANUAL MODE ────────────────────────────────────────
    if (manualMode) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center py-6 px-4">
                <header className="mb-8 text-center max-w-lg">
                    <h2 className={`text-3xl md:text-4xl font-black mb-3 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('enterVinManually')}
                    </h2>
                    <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('enterVinManuallyDesc')}
                    </p>
                </header>

                {/* VIN Input */}
                <div className="w-full max-w-lg mb-6">
                    <input
                        type="text"
                        value={manualVin}
                        onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                        maxLength={17}
                        placeholder="WVWZZZ3CZWE123456"
                        className={`w-full text-center text-2xl font-mono font-bold tracking-[0.2em] px-6 py-5 rounded-2xl border-2 transition-all outline-none ${isDark
                            ? 'bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-blue-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-300 focus:border-blue-500'
                            }`}
                        autoFocus
                    />
                    <div className="flex justify-between mt-2 px-1">
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {(t('vinCharCount') || '{count} / 17').replace('{count}', String(manualVin.replace(/[\s\-]/g, '').length))}
                        </span>
                        {isManualValid && (
                            <span className="text-xs text-green-500 font-medium">✓ {t('vinValid')}</span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-3 w-full max-w-lg">
                    <button
                        onClick={handleManualSubmit}
                        disabled={!isManualValid}
                        className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
                    >
                        <Check className="w-6 h-6" />
                        {t('vinConfirm')}
                    </button>

                    <div className="flex gap-3 w-full mt-2">
                        <button
                            onClick={onBack}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold opacity-50 hover:opacity-100 transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('backToStudio')}
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={handleRetry}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold opacity-50 hover:opacity-100 transition-all"
                        >
                            <Camera className="w-4 h-4" />
                            {t('tryScanAgain')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── CAMERA / SCAN MODE ─────────────────────────────────
    return (
        <div className="w-full h-full flex flex-col items-center justify-center py-6 px-4">
            {/* Header */}
            <header className="mb-8 text-center max-w-lg">
                <h2 className={`text-3xl md:text-4xl font-black mb-3 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('scanVin')}
                </h2>
                <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('scanVinDesc')}
                </p>
            </header>

            {/* Camera / Preview Area */}
            <div className="relative w-full max-w-lg aspect-[4/3] rounded-3xl overflow-hidden border-2 border-[var(--border)] mb-6 bg-black">
                {!capturedImage ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* VIN Guide Overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 bg-black/40" />
                            <div className="absolute left-[10%] right-[10%] top-[35%] bottom-[35%] bg-transparent border-2 border-dashed border-blue-400/80 rounded-xl"
                                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}
                            />
                            <div className="absolute left-[10%] right-[10%] top-[35%] flex justify-center -mt-7">
                                <span className="text-xs font-bold text-blue-400 bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm">
                                    {t('vinPlaceHere')}
                                </span>
                            </div>
                        </div>
                    </>
                ) : (
                    <img src={capturedImage} className="w-full h-full object-cover" alt="Captured VIN" />
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Result / Loading */}
            {loading && (
                <div className="flex items-center gap-3 mb-6 px-6 py-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-blue-500">{t('scanningVin')}</span>
                </div>
            )}

            {detectedVin && !loading && (
                <div className="mb-6 px-6 py-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-center">
                    <p className="text-xs uppercase tracking-wider font-medium opacity-60 mb-1">{t('vinDetected')}</p>
                    <code className="text-xl font-mono font-bold text-green-400 tracking-[0.15em] select-all">
                        {detectedVin}
                    </code>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col items-center gap-3 w-full max-w-lg">
                {!capturedImage ? (
                    <>
                        <button
                            onClick={capturePhoto}
                            disabled={!hasCamera}
                            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                        >
                            <Camera className="w-6 h-6" />
                            {t('captureVin')}
                        </button>
                        {!hasCamera && (
                            <label className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-500/20">
                                <Camera className="w-6 h-6" />
                                {t('uploadVinPhoto')}
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            </label>
                        )}
                    </>
                ) : detectedVin ? (
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={handleRetry}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold border transition-all ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <RotateCcw className="w-5 h-5" />
                            {t('vinRetry')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-500/20"
                        >
                            <Check className="w-5 h-5" />
                            {t('vinConfirm')}
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={handleRetry}
                            disabled={loading}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold border transition-all disabled:opacity-50 ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <RotateCcw className="w-5 h-5" />
                            {t('vinRetry')}
                        </button>
                        <button
                            onClick={() => { setManualMode(true); stopCamera(); }}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                        >
                            <Keyboard className="w-5 h-5" />
                            {t('enterManually')}
                        </button>
                    </div>
                )}

                {/* Back + Manual row */}
                <div className="flex gap-3 w-full mt-2">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold opacity-50 hover:opacity-100 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('backToStudio')}
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => { setManualMode(true); stopCamera(); }}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold opacity-50 hover:opacity-100 transition-all"
                    >
                        <Keyboard className="w-4 h-4" />
                        {t('enterManually')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VinScanner;
