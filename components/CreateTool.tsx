
import React, { useState, useEffect } from 'react';
import { TASKS, STUDIO_PRESETS } from '../constants';
import { TaskType, Order, StudioTemplate, ProcessingJob, CameraAngle, BrandingConfig } from '../types';
import Dashboard from './Dashboard';
import CameraCapture from './CameraCapture';
import StudioPicker from './StudioPicker';
import ProcessingScreen from './ProcessingScreen';
import OrderDetails from './OrderDetails';
import BatchExport from './BatchExport';
import UploadChoice from './UploadChoice';
import AngleDetectionTest from './AngleDetectionTest';
import { Language, translations } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useCredits } from '../context/CreditsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

type ViewState = 'dashboard' | 'camera' | 'studio' | 'processing' | 'order-details' | 'batch-export' | 'upload-choice' | 'angle-test';

const CreateTool: React.FC = () => {
    const { user } = useAuth();
    const { deductCredit, totalCredits } = useCredits();
    const { theme } = useTheme();
    const { language } = useLanguage();
    const t = translations[language];

    const [view, setView] = useState<ViewState>('dashboard');
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    const [activeTask, setActiveTask] = useState<TaskType | null>(null);
    const [selectedStudio, setSelectedStudio] = useState<StudioTemplate>(STUDIO_PRESETS[0]);
    const [branding, setBranding] = useState<BrandingConfig>({ logoUrl: null, isEnabled: true });

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
        setActiveTask(task);
        const newOrder: Order = {
            id: Math.random().toString(36).substr(2, 9),
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
            setView('processing');
        }
    };

    const handleJobProcessed = (jobId: string, processedImage?: string, status: 'completed' | 'failed' = 'completed') => {
        setOrders(prev => {
            return prev.map(o => {
                if (o.id === currentOrder?.id) {
                    const updatedJobs = o.jobs.map(j =>
                        j.id === jobId ? { ...j, status, processedImage: processedImage || j.processedImage } : j
                    );
                    const updatedOrder = { ...o, jobs: updatedJobs };
                    if (currentOrder?.id === o.id) {
                        setCurrentOrder(updatedOrder);
                    }
                    return updatedOrder;
                }
                return o;
            });
        });
    };

    const navigateToOrder = (order: Order) => {
        setCurrentOrder(order);
        setView('order-details');
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
            {view === 'dashboard' && (
                <Dashboard
                    onTaskSelect={handleTaskSelect}
                    orders={orders}
                    onOrderSelect={navigateToOrder}
                    branding={branding}
                    onLogoUpload={handleLogoUpload}
                    onToggleBranding={toggleBranding}
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
                    onSelectCamera={() => setView('camera')}
                    onUploadComplete={handleCaptureComplete}
                    onBack={() => setView(currentOrder?.taskType === 'bg-replacement' ? 'studio' : 'dashboard')}
                    t={t}
                    theme={theme}
                />
            )}

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

            {view === 'angle-test' && (
                <AngleDetectionTest />
            )}
        </div>
    );
};

export default CreateTool;
