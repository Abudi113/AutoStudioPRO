
import React, { useState, useRef, useEffect } from 'react';
import { CAMERA_ANGLES } from '../constants';
import { CameraAngle } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RotateCcw,
  Check,
  Maximize,
  Camera as CameraIcon,
  Smartphone,
  Info,
  ChevronLeft,
  Image as ImageIcon,
  Plus
} from 'lucide-react';
import { Guide3DOverlay } from './Guide3DOverlay';

interface CameraCaptureProps {
  onComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onComplete, onBack, theme }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({});
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAligned, setIsAligned] = useState(false);
  const [isCarDetected, setIsCarDetected] = useState(false);
  const [isCarFullyInFrame, setIsCarFullyInFrame] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [extraAngles, setExtraAngles] = useState<typeof CAMERA_ANGLES>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAngleIdRef = useRef<string | null>(null);

  const activeAngle = [...CAMERA_ANGLES, ...extraAngles][currentStep];

  const handleAddExtra = () => {
    const newIndex = CAMERA_ANGLES.length + extraAngles.length;
    const newAngle = {
      id: `extra_${Date.now()}` as CameraAngle,
      label: 'Extra',
      icon: 'Plus',
      template: 'interior' as const,
      defaultZoom: 1,
      hint: 'positionHints.detail'
    };
    setExtraAngles(prev => [...prev, newAngle]);
    setCurrentStep(newIndex);
  };

  // Mock Detection & Alignment Engine Logic
  useEffect(() => {
    if (!activeAngle) return;

    // Define ideal values per template
    const config = {
      interior: { idealPitch: 90, idealRoll: 0, pitchTol: 25, rollTol: 20 },
      exterior: { idealPitch: 75, idealRoll: 0, pitchTol: 15, rollTol: 10 }
    };

    const isInterior = activeAngle.template === 'interior';
    const settings = isInterior ? config.interior : config.exterior;

    // ALIGNED: Very close to ideal
    const aligned =
      Math.abs(pitch - settings.idealPitch) < settings.pitchTol &&
      Math.abs(roll - settings.idealRoll) < settings.rollTol;

    setIsAligned(aligned);

    // DETECTED: Much wider tolerance (Highly Sensitive)
    // Triggers if the phone is even remotely pointing in the right direction
    const detected =
      Math.abs(pitch - settings.idealPitch) < 50 &&
      Math.abs(roll - settings.idealRoll) < 40;

    setIsCarDetected(detected);

    // FULLY IN FRAME: True unless extremely tilted
    const fullyInFrame = pitch > 25 && pitch < 135;
    setIsCarFullyInFrame(fullyInFrame);
  }, [pitch, roll, activeAngle]);

  const getAlignmentHint = () => {
    if (isAligned) return null;
    if (pitch < 60) return t('lowerCamera' as any);
    if (pitch > 80) return t('stepBack' as any);
    if (roll > 5) return t('moveLeft' as any);
    if (roll < -5) return t('moveRight' as any);
    return null;
  };

  // Rotation check
  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sensor data
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null) setPitch(e.beta);
      if (e.gamma !== null) setRoll(e.gamma);
    };

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission().then((s: string) => {
        if (s === 'granted') window.addEventListener('deviceorientation', handleOrientation);
      });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // Auto-hide guides for extra angles, but restore when switching back
  useEffect(() => {
    const currentId = activeAngle?.id.toString();
    if (currentId !== lastAngleIdRef.current) {
      if (currentId.startsWith('extra_')) {
        setShowGuides(false);
      } else if (lastAngleIdRef.current?.startsWith('extra_')) {
        setShowGuides(true);
      }
      lastAngleIdRef.current = currentId;
    }
  }, [activeAngle?.id]);

  // Camera initialization
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Camera API not supported in this browser");
        if (isMounted) setIsCameraActive(false);
        return;
      }

      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn("Back camera failed, falling back to any video source", e);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        activeStream = stream;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
          videoRef.current.play().catch(e => console.error("Video play error:", e));
          setIsCameraActive(true);
        }
      } catch (err) {
        console.error("Critical camera access error:", err);
        if (isMounted) setIsCameraActive(false);
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      activeStream?.getTracks().forEach(t => t.stop());
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImages(prev => ({ ...prev, [activeAngle.id]: data }));
        setLastPhoto(data);

        // Auto-advance
        if (currentStep < CAMERA_ANGLES.length + extraAngles.length - 1) {
          setTimeout(() => setCurrentStep(prev => prev + 1), 800);
        }
      }
    }
  };

  const handleSkip = () => {
    if (currentStep < CAMERA_ANGLES.length + extraAngles.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleRetake = () => {
    // Just clear current photo, don't move back necessarily, or move back if we just advanced?
    // Simple behavior: Clear current angle's photo if exists, or go back one step
    if (capturedImages[activeAngle.id]) {
      const newCaptured = { ...capturedImages };
      delete newCaptured[activeAngle.id];
      setCapturedImages(newCaptured);
      setLastPhoto(null);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    const allAngles = [...CAMERA_ANGLES, ...extraAngles];
    const finalData = allAngles
      .filter(angle => capturedImages[angle.id])
      .map(angle => ({ angle: angle.id, data: capturedImages[angle.id] }));
    onComplete(finalData);
  };

  const handleSelectAngle = (index: number) => {
    setCurrentStep(index);
  };

  useEffect(() => {
    window.$crisp?.push(['do', 'chat:hide']);
    return () => window.$crisp?.push(['do', 'chat:show']);
  }, []);

  if (!isLandscape) {
    return (
      <div className="fixed inset-0 z-[1000] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center text-white">
        <motion.div animate={{ rotate: 90 }} transition={{ repeat: Infinity, duration: 2 }} className="mb-8">
          <Smartphone size={64} className="text-blue-500" />
        </motion.div>
        <h2 className="text-2xl font-black mb-4 uppercase">{t('rotatePhone' as any)}</h2>
        <p className="text-zinc-400">{t('rotatePhoneDesc' as any)}</p>
      </div>
    );
  }

  const alignmentHint = getAlignmentHint();

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-hidden flex flex-row font-sans">

      {/* --- LEFT SIDEBAR (Angle Selection) --- */}
      <div className="w-24 h-full bg-black/10 border-r border-white/5 flex flex-col items-center py-6 z-30 overflow-y-auto custom-scrollbar no-scrollbar">
        <div className="mb-6">
          <button onClick={onBack} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="flex flex-col gap-4 w-full px-2 pb-20">
          {[...CAMERA_ANGLES, ...extraAngles].map((angle, index) => {
            const isCompleted = !!capturedImages[angle.id];
            const isActive = currentStep === index;

            return (
              <button
                key={angle.id}
                onClick={() => handleSelectAngle(index)}
                className={`relative flex flex-col items-center gap-1 transition-all group ${isActive ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all overflow-hidden ${isActive ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  : isCompleted ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-white/10 bg-zinc-900'
                  }`}>
                  {isCompleted ? (
                    <img src={capturedImages[angle.id]} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={20} className="text-zinc-500" />
                  )}

                  {/* Selection Indicator Dot */}
                  {isActive && !isCompleted && <div className="absolute w-2 h-2 bg-blue-500 rounded-full top-1 right-1" />}

                  {/* Completed Checkmark */}
                  {isCompleted && (
                    <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center backdrop-blur-[1px]">
                      <Check size={20} className="text-white drop-shadow-md" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-bold uppercase text-center leading-tight max-w-[60px]">{angle.label === 'Extra' ? `${t('extra' as any)} ${index - CAMERA_ANGLES.length + 1}` : t(angle.label as any)}</span>
              </button>
            )
          })}

          {/* ADD EXTRA BUTTON */}
          <button
            onClick={handleAddExtra}
            className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity mt-2"
          >
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center hover:bg-white/5 transition-colors">
              <Plus size={24} className="text-zinc-400" />
            </div>
            <span className="text-[9px] font-bold uppercase text-center text-zinc-500">{t('addPhoto' as any)}</span>
          </button>
        </div>
      </div>

      {/* --- MAIN VIEWPORT --- */}
      <div className="flex-1 relative bg-zinc-900 overflow-hidden flex flex-col">

        {/* Top Controls Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
          <div className="pointer-events-auto">
            {/* Current Angle Label (Large) */}
            <div className="bg-transparent px-4 py-2 rounded-full">
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-0.5">Step {currentStep + 1} / {CAMERA_ANGLES.length + extraAngles.length}</p>
              <h2 className="text-lg font-bold uppercase tracking-tight shadow-black drop-shadow-md">{activeAngle?.label === 'Extra' ? `${t('extra' as any)} ${currentStep - CAMERA_ANGLES.length + 1}` : t(activeAngle?.label as any)}</h2>
            </div>
          </div>

          <div className="flex gap-3 pointer-events-auto">
            <button
              onClick={() => setShowGuides(!showGuides)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${showGuides
                ? 'bg-blue-600/80 border-blue-400/50 text-white shadow-lg shadow-blue-900/50'
                : 'bg-black/20 border-white/5 text-zinc-400 hover:text-white shadow-xl'
                }`}
            >
              <Maximize size={14} />
              {showGuides ? 'Guides On' : 'Off'}
            </button>

            <button
              onClick={handleSkip}
              className="px-4 py-2 bg-black/20 hover:bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest border border-white/5 transition-all text-zinc-300 shadow-xl"
            >
              {t('skip' as any)}
            </button>
          </div>
        </div>

        {/* Color Legend (Bottom Right of top section) */}
        {showGuides && (
          <div className="absolute top-20 right-4 flex flex-col gap-2 z-30 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-3">
              <div className="w-1 h-4 bg-[#10B981] rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                {(t('colorGuide' as any) as any).front}
              </span>
            </div>
            <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-3">
              <div className="w-1 h-4 bg-[#EF4444] rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                {(t('colorGuide' as any) as any).rear}
              </span>
            </div>
          </div>
        )}

        {/* Video Feed */}
        <div className="absolute inset-0 z-0">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>

        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-6 text-center z-[40]">
            <CameraIcon size={48} className="text-zinc-700 mb-4" />
            <h3 className="text-lg font-bold mb-2">Camera Unavailable</h3>
            <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-blue-600 rounded-lg">Retry</button>
          </div>
        )}

        {/* Alignment Glow (Screen Edge) */}
        <AnimatePresence>
          {isAligned && showGuides && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 border-[8px] border-emerald-500/50 pointer-events-none z-10"
            />
          )}
        </AnimatePresence>

        {/* 3D GUIDES OVERLAY */}
        {showGuides && (
          <Guide3DOverlay
            angleId={activeAngle.id}
            isAligned={isAligned}
            isDetected={isCarDetected}
            isFullyInFrame={isCarFullyInFrame}
          />
        )}

        {/* Car Detected Badge */}
        {isCarDetected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 z-30 border border-white/20"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            {t('carDetected' as any)}
          </motion.div>
        )}

        {/* Not in Frame Warning - DISABLED at user request
        {!isCarFullyInFrame && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-sm p-8 bg-red-600/90 backdrop-blur-xl text-white text-center rounded-[40px] z-[50] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info size={32} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">{t('warningCarNotInFrame' as any)}</h3>
          </motion.div>
        )}
        */}

        {/* Alignment Hint Toast - DISABLED at user request
        <AnimatePresence>
          {!isAligned && alignmentHint && showGuides && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-32 z-30 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-widest text-white">{alignmentHint}</p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        */}

        {/* Capture Button (Bottom Center) */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <button
              onClick={takePhoto}
              className="relative group active:scale-95 transition-all"
            >
              {/* Outer Ring */}
              <div className={`w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all duration-300 ${isAligned ? 'border-emerald-400 scale-105' : 'border-white'}`}>
                {/* Inner Circle */}
                <div className={`w-20 h-20 rounded-full transition-all duration-300 ${isAligned ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)]' : 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Last Photo Preview (Bottom Left absolute) */}
        {lastPhoto && (
          <div className="absolute bottom-10 left-10 z-30">
            <button onClick={handleRetake} className="relative group">
              <div className="w-16 h-16 rounded-xl border-2 border-white/50 overflow-hidden shadow-lg group-hover:border-blue-500 transition-all">
                <img src={lastPhoto} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <RotateCcw size={20} className="text-white" />
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Finish Button (Bottom Right absolute) - Only show if some photos taken */}
        {Object.keys(capturedImages).length > 0 && (
          <div className="absolute bottom-10 right-10 z-30">
            <button onClick={handleFinish} className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/50 transition-all hover:scale-105 active:scale-95">
              <Check size={32} className="text-white" />
            </button>
          </div>
        )}

      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
