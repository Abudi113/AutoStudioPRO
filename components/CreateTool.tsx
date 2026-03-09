
import React, { useState, useEffect, useRef } from 'react';

import { TASKS, STUDIO_PRESETS } from '../constants';
import { TaskType, Order, StudioTemplate, ProcessingJob, CameraAngle, BrandingConfig } from '../types';
import { processCarImage } from '../services/geminiService';
import Dashboard from './Dashboard';
import CameraCapture from './CameraCapture';
// VIN process — temporarily disabled, code preserved in VinScanner.tsx
// import VinScanner from './VinScanner';
import StudioPicker from './StudioPicker';
import ProcessingScreen from './ProcessingScreen';
import OrderDetails from './OrderDetails';
import BatchExport from './BatchExport';
import UploadChoice from './UploadChoice';

import { Language, translations } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useCredits } from '../context/CreditsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { saveProject, saveJobImage, createProjectRecord, loadProjects, loadProjectById, deleteProject, renameProject } from '../services/projectsService';
import { Link, useSearchParams } from 'react-router-dom';

type ViewState = 'dashboard' | 'camera' | 'studio' | 'processing' | 'order-details' | 'batch-export' | 'upload-choice';

const CreateTool: React.FC = () => {
    const { user, session } = useAuth();
    const { deductCredit, totalCredits } = useCredits();
    const { theme } = useTheme();
    const { language } = useLanguage();
    const t = translations[language] || translations['en'];

    const [view, setView] = useState<ViewState>('dashboard');
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    const [activeTask, setActiveTask] = useState<TaskType | null>(null);
    const [selectedStudio, setSelectedStudio] = useState<StudioTemplate>(STUDIO_PRESETS[0]);
    const [branding, setBranding] = useState<BrandingConfig>({ logoUrl: null, isEnabled: true });
    const savedProjectIds = useRef<Set<string>>(new Set());
    const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
    // VIN process disabled — preserved for future use
    // const [vinInput, setVinInput] = useState('');
    const [showRotateModal, setShowRotateModal] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(true);

    // Load saved projects from Supabase when auth is ready
    useEffect(() => {
        if (!user?.id || !session?.access_token) return;

        let cancelled = false;
        setLoadingProjects(true);
        console.log('[CreateTool] Loading projects for user:', user.id);

        loadProjects(user.id, session.access_token).then(remoteOrders => {
            if (cancelled) return;
            console.log('[CreateTool] Loaded', remoteOrders.length, 'projects');
            setOrders(prev => {
                const remoteIds = new Set(remoteOrders.map(o => o.id));
                const localOnly = prev.filter(o => !remoteIds.has(o.id));
                return [...localOnly, ...remoteOrders];
            });
            remoteOrders.forEach(o => savedProjectIds.current.add(o.id));
            if (!cancelled) setLoadingProjects(false);
        }).catch(err => {
            if (!cancelled) {
                console.error('[CreateTool] Failed to load projects:', err);
                setLoadingProjects(false);
            }
        });

        return () => { cancelled = true; };
    }, [user?.id, session?.access_token]);

    // Auto-refresh projects every 15s when on dashboard
    useEffect(() => {
        if (view !== 'dashboard' || !user?.id || !session?.access_token) return;

        const interval = setInterval(() => {
            loadProjects(user.id, session.access_token).then(remoteOrders => {
                setOrders(prev => {
                    const remoteIds = new Set(remoteOrders.map(o => o.id));
                    // Keep local orders that aren't in remote yet (still being processed locally)
                    const localOnly = prev.filter(o => !remoteIds.has(o.id) && !remoteIds.has(o.dbId));
                    return [...localOnly, ...remoteOrders];
                });
                remoteOrders.forEach(o => savedProjectIds.current.add(o.id));
            }).catch(() => { }); // Silent — don't disrupt UI on poll failures
        }, 15000);

        return () => clearInterval(interval);
    }, [view, user?.id, session?.access_token]);

    // Reset to dashboard view when navigating via Navbar "Dashboard" link
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        if (searchParams.get('view') === 'dashboard') {
            setView('dashboard');
            setSearchParams({}, { replace: true });
        }
    }, [searchParams]);

    useEffect(() => {
        // Check for 'start' query param to auto-launch Studio Picker
        const params = new URLSearchParams(window.location.search);
        if (params.get('start') === 'true') {
            const bgTask = TASKS.find(t => t.id === 'bg-replacement');
            if (bgTask) {
                handleTaskSelect(bgTask);
            }
        }
    }, []);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setBranding(prev => ({ ...prev, logoUrl: event.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleBranding = () => setBranding(prev => ({ ...prev, isEnabled: !prev.isEnabled }));

    const handleTaskSelect = (task: TaskType) => {
        // Guard: require at least 1 credit (only for logged-in users)
        if (user && totalCredits <= 0) {
            setShowNoCreditsModal(true);
            return;
        }
        setActiveTask(task);
        const newOrder: Order = {
            id: crypto.randomUUID(),
            title: `${task.label} ${orders.length + 1}`,
            vin: '',
            createdAt: new Date().toISOString(),
            status: 'draft',
            jobs: [],
            studioId: selectedStudio.id,
            taskType: task.id,
            branding: { ...branding }
        };
        setCurrentOrder(newOrder);

        if (task.id === 'bg-replacement' || task.id === 'interior') {
            setView('studio');
        } else {
            setView('upload-choice');
        }
    };

    const handleStudioSelect = (studio: StudioTemplate) => {
        setSelectedStudio(studio);
        if (currentOrder) {
            setCurrentOrder({ ...currentOrder, studioId: studio.id });
        }
    };

    const handleGoToChoice = () => {
        setView('upload-choice');
    };

    // VIN process disabled — handler preserved for future use
    // const handleVinComplete = (vin: string) => {
    //     if (currentOrder) {
    //         const updated = { ...currentOrder, vin, title: vin };
    //         setCurrentOrder(updated);
    //         setOrders(prev => prev.map(o => o.id === currentOrder.id ? { ...o, vin, title: vin } : o));
    //     }
    //     setView('upload-choice');
    // };

    const handleCaptureComplete = (images: { angle: CameraAngle; data: string }[]) => {
        if (currentOrder) {
            const newJobs: ProcessingJob[] = images.map(img => ({
                id: Math.random().toString(36).substr(2, 9),
                originalImage: img.data,
                angle: img.angle,
                status: 'pending'
            }));

            const updatedOrder: Order = {
                ...currentOrder,
                jobs: [...currentOrder.jobs, ...newJobs],
                status: 'active',
                branding: { ...branding }
            };

            setCurrentOrder(updatedOrder);
            setOrders(prev => [updatedOrder, ...prev.filter(o => o.id !== updatedOrder.id)]);
            // setVinInput(''); // VIN disabled
            setView('processing');

            // Create project record in Supabase in the background (non-blocking)
            if (user?.id && session?.access_token) {
                createProjectRecord(updatedOrder, user.id, session.access_token).then(dbId => {
                    if (dbId) {
                        console.log('[CreateTool] Project created in DB with id:', dbId);
                        // Update the order with the DB-generated ID
                        setCurrentOrder(prev => prev ? { ...prev, dbId } : prev);
                        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, dbId } : o));
                    }
                }).catch(err =>
                    console.error('[CreateTool] Failed to create project record:', err)
                );
            }
        }
    };

    const handleJobProcessed = (jobId: string, processedImage?: string, status: 'completed' | 'failed' = 'completed') => {
        setOrders(prev => {
            return prev.map(o => {
                if (o.id === currentOrder?.id) {
                    const updatedJobs = o.jobs.map(j =>
                        j.id === jobId ? { ...j, status, processedImage: processedImage || j.processedImage } : j
                    );
                    const updatedOrder = { ...o, jobs: updatedJobs, status: 'completed' as const };
                    if (currentOrder?.id === o.id) {
                        setCurrentOrder(updatedOrder);
                    }

                    // Save each completed image to Supabase progressively
                    if (status === 'completed' && processedImage && user?.id && session?.access_token) {
                        const jobForDebug = updatedOrder.jobs.find(j => j.id === jobId);
                        console.log(`[CreateTool] saveJobImage called for ${jobId}:`, {
                            dbId: updatedOrder.dbId,
                            hasOriginal: !!jobForDebug?.originalImage,
                            originalLen: jobForDebug?.originalImage?.length || 0,
                            isBase64: jobForDebug?.originalImage?.startsWith('data:') || false,
                        });
                        saveJobImage(updatedOrder, user.id, jobId, processedImage, session.access_token).catch(err =>
                            console.error('[CreateTool] Failed to save job image:', err)
                        );
                    }

                    // Save to Supabase once all jobs are processed and not yet saved
                    const allDone = updatedJobs.every(j => j.status === 'completed' || j.status === 'failed');
                    if (allDone && user?.id && session?.access_token && !savedProjectIds.current.has(updatedOrder.id)) {
                        savedProjectIds.current.add(updatedOrder.id);
                        saveProject(updatedOrder, user.id, session.access_token).catch(err =>
                            console.error('[CreateTool] Failed to save project:', err)
                        );
                    }

                    return updatedOrder;
                }
                return o;
            });
        });
    };

    // Convert URL to base64 if needed (orders loaded from DB have URLs, not base64)
    const ensureBase64 = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src; // already base64
        const res = await fetch(src);
        const blob = await res.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to convert image to base64'));
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    // ── Retry a single job (reprocess with same angle) ──
    const handleRetryJob = async (jobId: string, category?: CameraAngle) => {
        if (!currentOrder) return;
        const job = currentOrder.jobs.find(j => j.id === jobId);
        if (!job) return;

        // Reset to pending
        setOrders(prev => prev.map(o => {
            if (o.id !== currentOrder.id) return o;
            const updatedJobs = o.jobs.map(j => j.id === jobId ? { ...j, status: 'pending' as const, processedImage: undefined } : j);
            const updated = { ...o, jobs: updatedJobs };
            setCurrentOrder(updated);
            return updated;
        }));

        // Use the selected category as the angle for the pipeline, fallback to the job's angle
        const angleForPipeline = category || job.angle;

        try {
            // Convert URL to base64 if needed (DB-loaded orders store URLs)
            const imageBase64 = await ensureBase64(job.originalImage);
            const result = await processCarImage(
                imageBase64,
                currentOrder.studioId,
                angleForPipeline,
                currentOrder.taskType,
                currentOrder.branding
            );
            handleJobProcessed(jobId, result, 'completed');
            await deductCredit();
        } catch (e) {
            console.error(`Retry failed for job ${jobId}:`, e);
            handleJobProcessed(jobId, job.originalImage, 'failed');
        }
    };

    // ── Change angle of a job and re-process ──
    const handleChangeAngle = async (jobId: string, newAngle: CameraAngle, category?: CameraAngle) => {
        if (!currentOrder) return;

        // Update angle in state
        setOrders(prev => prev.map(o => {
            if (o.id !== currentOrder.id) return o;
            const updatedJobs = o.jobs.map(j => j.id === jobId ? { ...j, angle: newAngle, status: 'pending' as const, processedImage: undefined } : j);
            const updated = { ...o, jobs: updatedJobs };
            setCurrentOrder(updated);
            return updated;
        }));

        // Find the job for its original image
        const job = currentOrder.jobs.find(j => j.id === jobId);
        if (!job) return;

        // Use the selected category as the angle for the pipeline, fallback to the new angle
        const angleForPipeline = category || newAngle;

        try {
            // Convert URL to base64 if needed (DB-loaded orders store URLs)
            const imageBase64 = await ensureBase64(job.originalImage);
            const result = await processCarImage(
                imageBase64,
                currentOrder.studioId,
                angleForPipeline,
                currentOrder.taskType,
                currentOrder.branding
            );
            handleJobProcessed(jobId, result, 'completed');
            await deductCredit();
        } catch (e) {
            console.error(`Angle change + retry failed for job ${jobId}:`, e);
            handleJobProcessed(jobId, job.originalImage, 'failed');
        }
    };

    const handleRenameOrder = async (orderId: string, newTitle: string) => {
        // Optimistic update in local state
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, title: newTitle } : o));
        // Persist to Supabase
        const order = orders.find(o => o.id === orderId);
        const dbId = order?.dbId || orderId;
        if (session?.access_token) {
            await renameProject(dbId, newTitle, session.access_token);
        }
    };

    const navigateToOrder = async (order: Order) => {
        // If jobs aren't loaded (dashboard listing only has lightweight data), fetch full project
        if (order.jobs.length === 0 && order.status !== 'draft' && session?.access_token) {
            const fullOrder = await loadProjectById(order.dbId || order.id, session.access_token);
            if (fullOrder) {
                setCurrentOrder(fullOrder);
                setView('order-details');
                return;
            }
        }
        setCurrentOrder(order);
        setView('order-details');
    };

    // Step indicator logic
    const STEPS = [
        { label: 'Studio', views: ['studio'] },
        { label: 'Fotos', views: ['upload-choice', 'camera'] },
        { label: 'Verarbeitung', views: ['processing'] },
        { label: 'Ergebnis', views: ['order-details', 'batch-export'] },
    ];

    const currentStepIndex = STEPS.findIndex(s => s.views.includes(view));
    const showStepper = view !== 'dashboard';

    return (
        <div className="w-full p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
            {/* Step Counter */}
            {showStepper && (
                <div className="flex items-center justify-center gap-0 mt-2 sm:mt-4 md:mt-0 mb-6 sm:mb-8 md:mb-10 px-1 sm:px-4">
                    {STEPS.map((step, i) => {
                        const isCompleted = i < currentStepIndex;
                        const isCurrent = i === currentStepIndex;

                        return (
                            <React.Fragment key={step.label}>
                                {/* Step circle + label */}
                                <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                                    <div
                                        className={`w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[10px] sm:text-xs md:text-sm font-black transition-all duration-500 shrink-0 ${isCompleted
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                            : isCurrent
                                                ? (theme === 'dark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 md:ring-4 ring-blue-600/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 md:ring-4 ring-blue-600/20')
                                                : (theme === 'dark' ? 'bg-white/10 text-gray-500' : 'bg-gray-200 text-gray-400')
                                            }`}
                                    >
                                        {isCompleted ? (
                                            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            i + 1
                                        )}
                                    </div>
                                    <span className={`block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${isCurrent
                                        ? (theme === 'dark' ? 'text-white' : 'text-gray-900')
                                        : isCompleted
                                            ? 'text-green-500'
                                            : (theme === 'dark' ? 'text-gray-600' : 'text-gray-400')
                                        }`}>
                                        {step.label}
                                    </span>
                                </div>

                                {/* Connector line */}
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-[2px] mx-0.5 sm:mx-1 md:mx-2 mb-4 sm:mb-4 rounded-full transition-all duration-500 min-w-[16px] max-w-[40px] sm:max-w-[60px] md:max-w-[80px] ${i < currentStepIndex
                                        ? 'bg-green-500'
                                        : (theme === 'dark' ? 'bg-white/10' : 'bg-gray-200')
                                        }`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* No credits modal */}
            {showNoCreditsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className={`rounded-3xl border p-8 max-w-sm w-full text-center shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'
                        }`}>
                        <div className="text-5xl mb-4">⚡</div>
                        <h2 className={`text-2xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Keine Credits mehr</h2>
                        <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                            Sie haben keine Credits mehr. Kaufen Sie ein Paket, um weiter Bilder zu generieren.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link
                                to="/pricing"
                                onClick={() => setShowNoCreditsModal(false)}
                                className="w-full py-3 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all"
                            >
                                Pakete ansehen →
                            </Link>
                            <button
                                onClick={() => setShowNoCreditsModal(false)}
                                className={`w-full py-3 rounded-2xl font-bold border transition-all ${theme === 'dark'
                                    ? 'border-white/10 text-gray-400 hover:bg-white/5'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {view === 'dashboard' && (
                <Dashboard
                    onTaskSelect={handleTaskSelect}
                    orders={orders}
                    loadingProjects={loadingProjects}
                    onOrderSelect={navigateToOrder}
                    onDeleteOrder={async (orderId) => {
                        const order = orders.find(o => o.id === orderId);
                        const dbId = order?.dbId || orderId;
                        const token = session?.access_token;
                        if (!token) return;
                        const success = await deleteProject(dbId, token);
                        if (success) {
                            setOrders(prev => prev.filter(o => o.id !== orderId));
                        }
                    }}
                    onRenameOrder={handleRenameOrder}
                    branding={branding}
                    onLogoUpload={handleLogoUpload}
                    onToggleBranding={toggleBranding}
                    selectedStudio={selectedStudio}
                    t={t}
                    theme={theme}
                />
            )}

            {view === 'studio' && (
                <StudioPicker
                    selectedStudio={selectedStudio}
                    onSelect={handleStudioSelect}
                    onNext={handleGoToChoice}
                    t={t}
                    theme={theme}
                />
            )}

            {view === 'upload-choice' && (
                <UploadChoice
                    onSelectCamera={() => {
                        if (window.innerWidth > window.innerHeight) {
                            setView('camera');
                        } else {
                            setShowRotateModal(true);
                        }
                    }}
                    onUploadComplete={handleCaptureComplete}
                    onBack={() => setView(currentOrder?.taskType === 'bg-replacement' || currentOrder?.taskType === 'interior' ? 'studio' : 'dashboard')}
                    t={t}
                    theme={theme}
                />
            )}

            {/* Rotate-device modal — shown when user tries to open camera in portrait */}
            {showRotateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className={`rounded-3xl border p-8 max-w-sm w-full text-center shadow-2xl ${theme === 'dark' ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="text-5xl mb-4">📱🔄</div>
                        <h2 className={`text-2xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Gerät drehen
                        </h2>
                        <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Bitte drehen Sie Ihr Gerät ins Querformat, um die Kamera zu verwenden.
                        </p>
                        <button
                            onClick={() => setShowRotateModal(false)}
                            className={`w-full py-3 rounded-2xl font-bold border transition-all ${theme === 'dark'
                                ? 'border-white/10 text-gray-400 hover:bg-white/5'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* VIN process disabled — code preserved in VinScanner.tsx
            {view === 'vin-entry' && (
                <div className="max-w-lg mx-auto mt-8 animate-in fade-in duration-500">
                    <button
                        onClick={() => setView('upload-choice')}
                        className={`mb-6 flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}
                    >
                        ← {t.back || 'Back'}
                    </button>

                    <div className={`rounded-3xl border p-8 ${theme === 'dark' ? 'bg-[#111]/80 border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3">🔢</div>
                            <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {t.vinTitle || 'Vehicle Identification'}
                            </h2>
                            <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t.vinSubtitle || 'Enter the VIN to identify the vehicle (optional)'}
                            </p>
                        </div>

                        <input
                            type="text"
                            value={vinInput}
                            onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                            placeholder={t.vinPlaceholder || 'e.g. WVWZZZ3CZWE123456'}
                            maxLength={17}
                            className={`w-full px-4 py-3 rounded-xl text-center font-mono text-lg tracking-widest border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark'
                                ? 'bg-white/5 border-white/10 text-white placeholder-gray-600'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                                }`}
                        />

                        <div className="flex flex-col gap-3 mt-6">
                            <button
                                onClick={() => {
                                    if (vinInput.trim()) {
                                        handleVinComplete(vinInput.trim());
                                    }
                                }}
                                disabled={!vinInput.trim()}
                                className={`w-full py-3 rounded-2xl font-bold transition-all ${vinInput.trim()
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : theme === 'dark'
                                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {t.vinContinue || 'Continue with VIN'} →
                            </button>

                            <button
                                onClick={() => setView('vin-scan')}
                                className={`w-full py-2 text-sm transition-all ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                📷 {t.vinScanInstead || 'Scan VIN with camera instead'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'vin-scan' && (
                <VinScanner
                    onComplete={handleVinComplete}
                    onBack={() => setView('vin-entry')}
                    theme={theme}
                />
            )}
            */}

            {view === 'camera' && (
                <CameraCapture
                    onComplete={handleCaptureComplete}
                    onBack={() => setView('upload-choice')}
                    theme={theme}
                />
            )}

            {view === 'processing' && currentOrder && (
                <ProcessingScreen
                    order={currentOrder}
                    studio={selectedStudio}
                    onJobProcessed={handleJobProcessed}
                    onComplete={() => setView('order-details')}
                    t={t}
                    theme={theme}
                />
            )}

            {view === 'order-details' && currentOrder && (
                <OrderDetails
                    order={currentOrder}
                    onBack={() => setView('dashboard')}
                    onExport={() => setView('batch-export')}
                    t={t}
                    theme={theme}
                    onRetryJob={handleRetryJob}
                    onChangeAngle={handleChangeAngle}
                />
            )}

            {view === 'batch-export' && currentOrder && (
                <BatchExport
                    order={currentOrder}
                    onBack={() => setView('order-details')}
                    t={t}
                    theme={theme}
                />
            )}


        </div>
    );
};

export default CreateTool;
