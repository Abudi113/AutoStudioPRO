
import React, { useEffect, useState, useRef } from 'react';
import { Order, StudioTemplate } from '../types';
import { processCarImage } from '../services/geminiService';

interface ProcessingScreenProps {
  order: Order;
  studio: StudioTemplate;
  onJobProcessed: (jobId: string, processedImage?: string, status?: 'completed' | 'failed') => void;
  onComplete: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ order, studio, onJobProcessed, onComplete, t, theme }) => {
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState<string[]>(["Initializing neural engine...", "System Check: Photo Detection logic online."]);
  const processingStarted = useRef(false);

  useEffect(() => {
    if (processingStarted.current) return;
    processingStarted.current = true;

    const processAll = async () => {
      setLogs(prev => [...prev, `Task: ${order.taskType.toUpperCase()} processing initiated.`, `Batch: ${order.jobs.length} assets queued.`]);

      if (order.branding?.isEnabled && order.branding?.logoUrl) {
        setLogs(prev => [...prev, "Brand Identity: Logo detected. Preparing for studio wall & plate branding."]);
      }

      let count = 0;
      for (const job of order.jobs) {
        setLogs(prev => [...prev, `[AI Vision] Analyzing ${job.angle.replace(/_/g, ' ')}...`]);

        try {
          await new Promise(r => setTimeout(r, 600));

          if (order.taskType === 'interior' || job.angle === 'interior') {
            setLogs(prev => [...prev, `[Processing] Applying Luxury Interior HDR, Reflection Removal & Cabin Cleaning...`]);
          } else {
            setLogs(prev => [...prev, `[Processing] Executing Studio Compositing${order.branding?.isEnabled ? ' with Branding' : ''}...`]);
          }

          const result = await processCarImage(job.originalImage, studio.id, job.angle, order.taskType, order.branding);
          onJobProcessed(job.id, result, 'completed');

          setLogs(prev => [...prev, `[SUCCESS] ${job.angle.replace(/_/g, ' ')} enhanced and optimized.`]);
        } catch (e) {
          console.error(`AI Error for job ${job.id}:`, e);
          onJobProcessed(job.id, undefined, 'failed');
          setLogs(prev => [...prev, `[ERROR] Failed to process ${job.angle.replace(/_/g, ' ')}.`]);
        }

        count++;
        setProcessedCount(count);
      }

      setLogs(prev => [...prev, "Batch verification successful.", "All dealership assets ready.", "Redirecting..."]);

      setTimeout(onComplete, 2000);
    };

    processAll();
  }, [order.id, onComplete, onJobProcessed, studio.name, order.taskType, order.branding]);

  const progress = (processedCount / order.jobs.length) * 100;
  const accentColor = theme === 'light' ? 'text-gold-dark' : 'text-blue-500';
  const accentBg = theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600';
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';

  return (
    <div className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center py-10 px-4">
      <div className="w-24 h-24 md:w-32 md:h-32 relative mb-10">
        <div className={`absolute inset-0 rounded-full border-4 ${theme === 'light' ? 'border-gold-dark/20' : 'border-blue-600/20'}`}></div>
        <div
          className={`absolute inset-0 rounded-full border-4 ${theme === 'light' ? 'border-gold-dark' : 'border-blue-600'} border-t-transparent animate-spin`}
          style={{ animationDuration: '1.2s' }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className={`fa-solid fa-wand-magic-sparkles ${accentColor} text-3xl md:text-4xl animate-pulse`}></i>
        </div>
      </div>

      <h2 className={`text-2xl md:text-4xl font-black mb-3 text-center ${textTitle}`}>{t.processing}</h2>
      <p className="text-gray-500 mb-10 text-center max-w-md text-sm md:text-lg font-medium">{t.identityLock}</p>

      <div className={`${theme === 'light' ? 'bg-gray-50' : 'bg-white/5'} border ${theme === 'light' ? 'border-gray-200' : 'border-white/10'} w-full rounded-[32px] overflow-hidden mb-10 shadow-2xl`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.overallProgress}</span>
            <span className={`text-lg font-black ${accentColor}`}>{Math.round(progress)}%</span>
          </div>
          <div className={`w-full h-4 ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'} rounded-full overflow-hidden shadow-inner`}>
            <div
              className={`h-full ${accentBg} transition-all duration-700 ease-out shadow-lg`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className={`w-full ${theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-[#0d0d0d] border-white/10'} rounded-[32px] border p-8 font-mono text-[12px] md:text-base overflow-hidden h-56 relative`}>
        <div className="space-y-3 overflow-y-auto h-full pr-4 scrollbar-hide">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 opacity-90 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-gray-500 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
              <span className={log.includes('FAIL') || log.includes('ERROR') ? 'text-red-500 font-bold' : (theme === 'light' ? 'text-gray-800' : 'text-blue-400')}>
                {log}
              </span>
            </div>
          ))}
          <div className={`animate-pulse inline-block w-2 h-5 ${accentBg} ml-1`}></div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-16 ${theme === 'light' ? 'bg-gradient-to-t from-gray-100' : 'bg-gradient-to-t from-[#0d0d0d]'} to-transparent pointer-events-none`}></div>
      </div>
    </div>
  );
};

export default ProcessingScreen;
