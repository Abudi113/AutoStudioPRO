
import React, { useEffect, useState, useRef } from 'react';
import { Order, StudioTemplate } from '../types';
import { processCarImage } from '../services/geminiService';
import { useCredits } from '../context/CreditsContext';

interface ProcessingScreenProps {
  order: Order;
  studio: StudioTemplate;
  onJobProcessed: (jobId: string, processedImage?: string, status?: 'completed' | 'failed') => void;
  onComplete: () => void;
  t: any;
  theme: 'light' | 'dark';
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ order, studio, onJobProcessed, onComplete, t, theme }) => {
  const { deductCredit } = useCredits();
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const processingStarted = useRef(false);

  // Helper for simple interpolation
  const format = (str: string, params: Record<string, string | number>) => {
    let result = str;
    for (const key in params) {
      result = result.replace(`{${key}}`, String(params[key]));
    }
    return result;
  };

  // Elapsed time timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    // Initialize logs with translation
    if (logs.length === 0) {
      setLogs([t.initializing, t.systemCheck]);
    }

    if (processingStarted.current) return;
    processingStarted.current = true;

    const processAll = async () => {
      setLogs(prev => [...prev,
      format(t.taskInitiated, { task: (order.taskType || 'PROCESSING').toUpperCase() }),
      format(t.batchQueued, { count: order.jobs.length })
      ]);

      if (order.branding?.isEnabled && order.branding?.logoUrl) {
        setLogs(prev => [...prev, t.brandDetected]);
      }

      const BATCH_SIZE = Math.min(5, order.jobs.length);
      setLogs(prev => [...prev, `⚡ Parallel mode: ${BATCH_SIZE} images at a time (${order.jobs.length} total)`]);

      let count = 0;
      for (let batchStart = 0; batchStart < order.jobs.length; batchStart += BATCH_SIZE) {
        const batch = order.jobs.slice(batchStart, batchStart + BATCH_SIZE);

        // Add delay between batches (not before the first)
        if (batchStart > 0) {
          setLogs(prev => [...prev, '⏳ Rate-limit cooldown (2s)...']);
          await new Promise(r => setTimeout(r, 2000));
        }

        setLogs(prev => [...prev, `🚀 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(order.jobs.length / BATCH_SIZE)} (${batch.length} images)...`]);

        // Fire all jobs in this batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (job) => {
            const angleLabel = job.angle === 'AUTO' ? 'Auto-Detect' : (t[job.angle] || job.angle.replace(/_/g, ' '));
            setLogs(prev => [...prev, `🔍 ${format(t.analyzingInfo, { angle: angleLabel })} — KI erkennt Bildtyp automatisch...`]);

            const result = await processCarImage(job.originalImage, studio.id, job.angle, order.taskType, order.branding);
            return { job, result, angleLabel };
          })
        );

        // Process results
        for (const outcome of results) {
          if (outcome.status === 'fulfilled') {
            const { job, result, angleLabel } = outcome.value;
            onJobProcessed(job.id, result, 'completed');
            await deductCredit();
            setLogs(prev => [...prev, format(t.successEnhanced, { angle: angleLabel })]);
          } else {
            // Find which job failed (use index)
            const idx = results.indexOf(outcome);
            const job = batch[idx];
            const angleLabel = job.angle === 'AUTO' ? 'Auto-Detect' : (t[job.angle] || job.angle.replace(/_/g, ' '));
            const errorMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            console.error(`AI Error for job ${job.id}:`, outcome.reason);
            onJobProcessed(job.id, job.originalImage, 'failed');
            setLogs(prev => [...prev, `❌ FAILED: ${angleLabel} — ${errorMsg.slice(0, 100)}`]);
          }
          count++;
          setProcessedCount(count);
        }
      }

      setLogs(prev => [...prev, t.batchVerification, t.assetsReady, t.redirecting]);

      setTimeout(onComplete, 2000);
    };

    processAll();
  }, [order.id, onComplete, onJobProcessed, studio.name, order.taskType, order.branding, t]);

  const progress = (processedCount / order.jobs.length) * 100;
  const accentColor = theme === 'light' ? 'text-gold-dark' : 'text-blue-500';
  const accentBg = theme === 'light' ? 'bg-gold-dark' : 'bg-blue-600';
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center py-10 px-4">
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
      <p className="text-gray-500 mb-2 text-center max-w-md text-sm md:text-lg font-medium">{t.identityLock}</p>
      <p className={`text-lg md:text-xl font-mono font-bold mb-10 ${accentColor} tabular-nums`}>⏱ {formatTime(elapsedSeconds)}</p>

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
