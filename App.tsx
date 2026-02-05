
import React, { useState, useEffect } from 'react';
import { TASKS, STUDIO_PRESETS, CAMERA_ANGLES } from './constants';
import { TaskType, Order, StudioTemplate, ProcessingJob, CameraAngle, BrandingConfig } from './types';
import { Language, translations } from './i18n';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CameraCapture from './components/CameraCapture';
import StudioPicker from './components/StudioPicker';
import ProcessingScreen from './components/ProcessingScreen';
import OrderDetails from './components/OrderDetails';
import BatchExport from './components/BatchExport';
import UploadChoice from './components/UploadChoice';

type ViewState = 'dashboard' | 'camera' | 'studio' | 'processing' | 'order-details' | 'batch-export' | 'upload-choice';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [activeTask, setActiveTask] = useState<TaskType | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<StudioTemplate>(STUDIO_PRESETS[0]);
  const [branding, setBranding] = useState<BrandingConfig>({ logoUrl: null, isEnabled: true });
  
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>('en');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.remove('dark-mode');
      body.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
    } else {
      body.classList.remove('light-mode');
      body.classList.add('dark-mode');
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleLang = () => setLang(prev => prev === 'en' ? 'de' : 'en');
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

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
    
    if (task.id === 'bg-replacement') {
      setView('studio');
    } else {
      setView('upload-choice');
    }
    setSidebarOpen(false);
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
        branding: { ...branding } // Capture current branding state at start of order
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
    setSidebarOpen(false);
  };

  const handleViewChange = (v: ViewState) => {
    setView(v);
    setSidebarOpen(false);
  };

  return (
    <div className={`flex flex-col md:flex-row h-screen overflow-hidden ${theme === 'light' ? 'bg-white' : 'bg-[#0a0a0a]'}`}>
      <Sidebar 
        currentView={view} 
        onNavigate={handleViewChange} 
        activeOrder={currentOrder}
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onToggleLang={toggleLang}
        t={t}
        isOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />
      
      <main className="flex-1 overflow-y-auto relative transition-colors duration-300">
        <div className="p-4 md:p-6 lg:p-10 min-h-full">
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
        </div>
      </main>
    </div>
  );
};

export default App;
