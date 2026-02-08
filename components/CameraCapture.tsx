
import React, { useState, useRef, useEffect } from 'react';
import { CAMERA_ANGLES } from '../constants';
import { CameraAngle } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface CameraCaptureProps {
  onComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onComplete, onBack, theme }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<{ angle: CameraAngle; data: string }[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const activeAngle = CAMERA_ANGLES[currentStep];

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          videoRef.current.play().catch(e => console.error("Video play error:", e));
        }
      } catch (err) {
        console.error("Camera access error:", err);
        alert("Unable to access camera. Please check permissions.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/png');

        const newImages = [...capturedImages, { angle: activeAngle.id, data }];
        setCapturedImages(newImages);

        if (currentStep < CAMERA_ANGLES.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          onComplete(newImages);
        }
      }
    }
  };

  const skipStep = () => {
    if (currentStep < CAMERA_ANGLES.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(capturedImages);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        const newImages = [...capturedImages, { angle: activeAngle.id, data }];
        setCapturedImages(newImages);
        if (currentStep < CAMERA_ANGLES.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          onComplete(newImages);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black rounded-3xl overflow-hidden relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-1">{t('guidedAssistant')}</p>
          <h3 className="text-lg font-bold text-white">{t(activeAngle.label as any)}</h3>
        </div>
        <div className="w-10 flex justify-end">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showGuide ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/40'}`}
          >
            <i className={`fa-solid ${showGuide ? 'fa-eye' : 'fa-eye-slash'}`}></i>
          </button>
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Guided Overlay SVG */}
        {showGuide && (
          <div className="absolute inset-0 pointer-events-none border-[40px] md:border-[60px] border-black/40 transition-opacity duration-300">
            <div className="w-full h-full border-2 border-dashed border-white/30 rounded-[40px] relative flex items-center justify-center">
              {/* Car Outline SVG */}
              <svg viewBox="0 0 200 150" className="absolute w-[80%] h-[80%] opacity-30 drop-shadow-lg">
                <path
                  d="M10,110 L190,110 L190,70 L160,70 L140,30 L60,30 L40,70 L10,70 Z"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <circle cx="45" cy="110" r="12" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
                <circle cx="155" cy="110" r="12" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
              </svg>

              {/* Outline help based on angle */}
              <div className="absolute inset-10 md:inset-20 border border-blue-500/10 rounded-xl flex items-center justify-center">
                <span className="text-white/10 text-6xl md:text-8xl opacity-10">
                  <i className={`fa-solid ${activeAngle.icon}`}></i>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Live Warnings */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-yellow-500 text-xs"></i>
            <span className="text-xs font-medium text-white/90">{t('warnReflections')}</span>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          {CAMERA_ANGLES.map((angle, idx) => (
            <div
              key={angle.id}
              className={`w-2 h-2 rounded-full transition-all ${idx === currentStep ? 'bg-blue-500 scale-150 shadow-[0_0_10px_rgba(59,130,246,0.8)]' :
                idx < currentStep ? 'bg-green-500' : 'bg-white/20'
                }`}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 md:p-8 bg-black/90 border-t border-white/10 flex items-center justify-between">
        <div className="flex-1 flex justify-start">
          <label className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <i className="fa-solid fa-image text-white/60"></i>
            </div>
            <span className="text-[10px] text-white/40 font-bold uppercase">{t('gallery')}</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="flex-1 flex justify-center">
          <button
            onClick={takePhoto}
            className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white shadow-lg"></div>
          </button>
        </div>

        <div className="flex-1 flex justify-end">
          <button
            onClick={skipStep}
            className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <i className="fa-solid fa-forward"></i>
            </div>
            <span className="text-[10px] font-bold uppercase">{t('skip')}</span>
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
