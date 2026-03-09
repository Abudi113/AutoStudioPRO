import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraAngle } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraCaptureProps {
  onComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

// ─── Camera Angles ─────────────────────────────────────────────────────────────

const CAMERA_ANGLES = [
  { id: 'front', label: 'Front', img: '/angles/front.png', isInterior: false },
  { id: 'front_right_34', label: 'Front Right', img: '/angles/front_right.png', isInterior: false },
  { id: 'right', label: 'Side Right', img: '/angles/right.png', isInterior: false },
  { id: 'rear_right_34', label: 'Rear Right', img: '/angles/rear_right.png', isInterior: false },
  { id: 'rear', label: 'Rear', img: '/angles/rear.png', isInterior: false },
  { id: 'rear_left_34', label: 'Rear Left', img: '/angles/rear_left.png', isInterior: false },
  { id: 'left', label: 'Side Left', img: '/angles/left.png', isInterior: false },
  { id: 'front_left_34', label: 'Front Left', img: '/angles/front_left.png', isInterior: false },
  { id: 'interior_1', label: 'Steering Wheel', img: '/angles/interior_1.png', isInterior: true },
  { id: 'interior_2', label: 'Dashboard', img: '/angles/interior_2.png', isInterior: true },
  { id: 'interior_3', label: 'Center Console', img: '/angles/interior_3.png', isInterior: true },
  { id: 'interior_4', label: 'Front Cabin', img: '/angles/interior_4.png', isInterior: true },
  { id: 'interior_5', label: 'Trunk', img: '/angles/interior_5.png', isInterior: true },
  { id: 'interior_6', label: 'Front Seats', img: '/angles/interior_6.png', isInterior: true },
  { id: 'interior_7', label: 'Gauges', img: '/angles/interior_7.png', isInterior: true },
  { id: 'interior_8', label: 'Rear Seats', img: '/angles/interior_8.png', isInterior: true },
] as const;

// ─── YOLOv8n via ONNX Runtime Web ─────────────────────────────────────────────

const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';
const YOLO_MODEL_URL = '/yolov8n.onnx';
const DETECTION_CONFIDENCE = 0.65;
const YOLO_SIZE = 640;
const YOLO_VEHICLE_IDS = new Set([2, 5, 7]);

let yoloSession: any = null;
let yoloLoading = false;
let yoloCanvas: HTMLCanvasElement | null = null;
let yoloCtx: CanvasRenderingContext2D | null = null;
let analysisCanvas: HTMLCanvasElement | null = null;
let analysisCtx: CanvasRenderingContext2D | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

async function loadYoloModel() {
  if (yoloSession || yoloLoading) return yoloSession;
  yoloLoading = true;
  try {
    await loadScript(ORT_CDN);
    const ort = (window as any).ort;
    if (!ort) throw new Error('ort not found');
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
    const buf = await (await fetch(YOLO_MODEL_URL)).arrayBuffer();
    yoloSession = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
  } catch (e) { console.warn('[YOLOv8]', e); }
  yoloLoading = false;
  return yoloSession;
}

function buildYoloTensor(video: HTMLVideoElement): any {
  if (!yoloCanvas) { yoloCanvas = document.createElement('canvas'); yoloCtx = yoloCanvas.getContext('2d', { willReadFrequently: true }); }
  yoloCanvas.width = YOLO_SIZE; yoloCanvas.height = YOLO_SIZE;
  yoloCtx!.drawImage(video, 0, 0, YOLO_SIZE, YOLO_SIZE);
  const { data } = yoloCtx!.getImageData(0, 0, YOLO_SIZE, YOLO_SIZE);
  const px = YOLO_SIZE * YOLO_SIZE, t = new Float32Array(3 * px);
  for (let i = 0; i < px; i++) { t[i] = data[i * 4] / 255; t[px + i] = data[i * 4 + 1] / 255; t[px * 2 + i] = data[i * 4 + 2] / 255; }
  return new (window as any).ort.Tensor('float32', t, [1, 3, YOLO_SIZE, YOLO_SIZE]);
}

function iou(a: number[], b: number[]) {
  const ox = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const oy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - ox * oy;
  return ua > 0 ? (ox * oy) / ua : 0;
}

function nms(boxes: number[][], scores: number[]): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep: number[] = []; const sup = new Uint8Array(scores.length);
  for (const i of order) { if (sup[i]) continue; keep.push(i); for (const j of order) { if (!sup[j] && j !== i && iou(boxes[i], boxes[j]) > 0.45) sup[j] = 1; } }
  return keep;
}

async function runYoloDetection(video: HTMLVideoElement) {
  if (!yoloSession) return [];
  const input = buildYoloTensor(video);
  const results = await yoloSession.run({ [yoloSession.inputNames[0]]: input });
  const out = results[yoloSession.outputNames[0]].data as Float32Array;
  const nd = 8400, sx = video.videoWidth / YOLO_SIZE, sy = video.videoHeight / YOLO_SIZE;
  const boxes: number[][] = [], scores: number[] = [], ids: number[] = [];
  for (let i = 0; i < nd; i++) {
    const cx = out[0 * nd + i], cy = out[1 * nd + i], bw = out[2 * nd + i], bh = out[3 * nd + i];
    let bs = 0, bc = -1;
    for (const c of YOLO_VEHICLE_IDS) { const s = out[(4 + c) * nd + i]; if (s > bs) { bs = s; bc = c; } }
    if (bs < DETECTION_CONFIDENCE || bc < 0) continue;
    boxes.push([(cx - bw / 2) * sx, (cy - bh / 2) * sy, (cx + bw / 2) * sx, (cy + bh / 2) * sy]); scores.push(bs); ids.push(bc);
  }
  return nms(boxes, scores).map(i => ({ bbox: [boxes[i][0], boxes[i][1], boxes[i][2] - boxes[i][0], boxes[i][3] - boxes[i][1]] as [number, number, number, number], score: scores[i] }));
}

function getAC() {
  if (!analysisCanvas) { analysisCanvas = document.createElement('canvas'); analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true }); }
  return { canvas: analysisCanvas, ctx: analysisCtx };
}

function analyzeCarFrontSide(v: HTMLVideoElement, b: [number, number, number, number]): 'left' | 'right' | 'unknown' {
  try {
    const { canvas, ctx } = getAC(); if (!ctx) return 'unknown';
    canvas.width = 72; canvas.height = 48;
    ctx.drawImage(v, b[0], b[1], b[2], b[3], 0, 0, 72, 48);
    const p = ctx.getImageData(0, 0, 72, 48).data;
    const qw = 18; let ll = 0, ln = 0, rl = 0, rn = 0;
    for (let y = 10; y < 38; y++) for (let x = 0; x < 72; x++) { const i = (y * 72 + x) * 4; const lm = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; if (x < qw) { ll += lm; ln++; } else if (x >= 54) { rl += lm; rn++; } }
    const al = ln > 0 ? ll / ln : 0, ar = rn > 0 ? rl / rn : 0, d = Math.abs(al - ar), m = Math.max(al, ar);
    if (m === 0 || d / m < 0.12) return 'unknown';
    return al > ar ? 'left' : 'right';
  } catch { return 'unknown'; }
}

function analyzeCarFrontRear(v: HTMLVideoElement, b: [number, number, number, number]): 'front' | 'rear' | 'unknown' {
  try {
    const { canvas, ctx } = getAC(); if (!ctx) return 'unknown';
    canvas.width = 72; canvas.height = 48;
    ctx.drawImage(v, b[0], b[1] + b[3] * 0.6, b[2], b[3] * 0.4, 0, 0, 72, 48);
    const p = ctx.getImageData(0, 0, 72, 48).data, tot = 72 * 48;
    let rc = 0, wc = 0;
    for (let i = 0; i < tot; i++) { const r = p[i * 4], g = p[i * 4 + 1], bv = p[i * 4 + 2]; if (r > 140 && r > g * 1.5 && r > bv * 1.5) rc++; else if (r > 180 && g > 180 && bv > 180) wc++; }
    const rr = rc / tot, wr = wc / tot;
    if (rr < 0.04 && wr < 0.06) return 'unknown';
    if (rr > wr && rr > 0.05) return 'rear';
    if (wr > rr && wr > 0.07) return 'front';
    return 'unknown';
  } catch { return 'unknown'; }
}

type GuideZone = { x: number; y: number; w: number; h: number; minAspect: number; maxAspect: number; minOverlap: number; minSizeFraction: number; expectedFrontSide: 'left' | 'right' | 'center' | 'any'; expectedView?: 'front' | 'rear' };
const ANGLE_GUIDE_ZONES: Record<string, GuideZone | null> = {
  front: { x: .18, y: .28, w: .64, h: .50, minAspect: .5, maxAspect: 1.8, minOverlap: .55, minSizeFraction: .04, expectedFrontSide: 'center', expectedView: 'front' },
  rear: { x: .18, y: .28, w: .64, h: .50, minAspect: .5, maxAspect: 1.8, minOverlap: .55, minSizeFraction: .04, expectedFrontSide: 'center', expectedView: 'rear' },
  left: { x: .08, y: .25, w: .84, h: .52, minAspect: 2.2, maxAspect: 6.0, minOverlap: .55, minSizeFraction: .06, expectedFrontSide: 'left' },
  right: { x: .08, y: .25, w: .84, h: .52, minAspect: 2.2, maxAspect: 6.0, minOverlap: .55, minSizeFraction: .06, expectedFrontSide: 'right' },
  front_right_34: { x: .08, y: .18, w: .84, h: .65, minAspect: 1.3, maxAspect: 3.0, minOverlap: .50, minSizeFraction: .05, expectedFrontSide: 'right' },
  front_left_34: { x: .08, y: .18, w: .84, h: .65, minAspect: 1.3, maxAspect: 3.0, minOverlap: .50, minSizeFraction: .05, expectedFrontSide: 'left' },
  rear_right_34: { x: .08, y: .18, w: .84, h: .65, minAspect: 1.3, maxAspect: 3.0, minOverlap: .50, minSizeFraction: .05, expectedFrontSide: 'left' },
  rear_left_34: { x: .08, y: .18, w: .84, h: .65, minAspect: 1.3, maxAspect: 3.0, minOverlap: .50, minSizeFraction: .05, expectedFrontSide: 'right' },
  interior_1: null, interior_2: null, interior_3: null, interior_4: null,
  interior_5: null, interior_6: null, interior_7: null, interior_8: null,
};

function overlapRatio(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  const ox = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const oy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return aw * ah > 0 ? (ox * oy) / (aw * ah) : 0;
}

// ─── SVG Guides ───────────────────────────────────────────────────────────────

const FC = '#10B981', RC = '#EF4444', SC = '#06b6d4', GF = 'rgba(6,182,212,0.15)';

function Guide3DOverlay({ angleId }: { angleId: string }) {
  const shape = () => {
    switch (angleId) {
      case 'front': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <path d="M 30 35 L 130 35 L 130 80 L 30 80 Z" fill={GF} />
          <line x1={30} y1={80} x2={130} y2={80} stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={30} y1={35} x2={30} y2={80} stroke={FC} strokeWidth={2} strokeLinecap="round" />
          <line x1={130} y1={35} x2={130} y2={80} stroke={FC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'rear': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <path d="M 30 35 L 130 35 L 130 80 L 30 80 Z" fill={GF} />
          <line x1={30} y1={80} x2={130} y2={80} stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={30} y1={35} x2={30} y2={80} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={130} y1={35} x2={130} y2={80} stroke={RC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'left': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <rect x={20} y={30} width={120} height={50} fill={GF} />
          <line x1={20} y1={80} x2={140} y2={80} stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={20} y1={30} x2={20} y2={80} stroke={FC} strokeWidth={2} strokeLinecap="round" />
          <line x1={140} y1={30} x2={140} y2={80} stroke={RC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'right': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <rect x={20} y={30} width={120} height={50} fill={GF} />
          <line x1={20} y1={80} x2={140} y2={80} stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={20} y1={30} x2={20} y2={80} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={140} y1={30} x2={140} y2={80} stroke={FC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'front_left_34': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <path d="M 20 40 L 60 30 L 60 85 L 20 80 Z" fill={GF} /><path d="M 60 30 L 140 25 L 140 70 L 60 85 Z" fill={GF} />
          <path d="M 20 80 L 60 85 L 140 70" fill="none" stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={20} y1={40} x2={20} y2={80} stroke={FC} strokeWidth={2} strokeLinecap="round" />
          <line x1={60} y1={30} x2={60} y2={85} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={140} y1={25} x2={140} y2={70} stroke={RC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'front_right_34': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <path d="M 100 30 L 140 40 L 140 80 L 100 85 Z" fill={GF} /><path d="M 20 25 L 100 30 L 100 85 L 20 70 Z" fill={GF} />
          <path d="M 140 80 L 100 85 L 20 70" fill="none" stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={140} y1={40} x2={140} y2={80} stroke={FC} strokeWidth={2} strokeLinecap="round" />
          <line x1={100} y1={30} x2={100} y2={85} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={20} y1={25} x2={20} y2={70} stroke={RC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'rear_left_34': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <path d="M 100 30 L 140 40 L 140 80 L 100 85 Z" fill={GF} /><path d="M 20 25 L 100 30 L 100 85 L 20 70 Z" fill={GF} />
          <path d="M 140 80 L 100 85 L 20 70" fill="none" stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={140} y1={40} x2={140} y2={80} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={100} y1={30} x2={100} y2={85} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={20} y1={25} x2={20} y2={70} stroke={FC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'rear_right_34': return (
        <svg viewBox="0 0 160 100" className="w-full h-full">
          <path d="M 20 40 L 60 30 L 60 85 L 20 80 Z" fill={GF} /><path d="M 60 30 L 140 25 L 140 70 L 60 85 Z" fill={GF} />
          <path d="M 20 80 L 60 85 L 140 70" fill="none" stroke={SC} strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
          <line x1={20} y1={40} x2={20} y2={80} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={60} y1={30} x2={60} y2={85} stroke={RC} strokeWidth={2} strokeLinecap="round" />
          <line x1={140} y1={25} x2={140} y2={70} stroke={FC} strokeWidth={2} strokeLinecap="round" />
        </svg>);
      case 'interior_1': case 'interior_2': case 'interior_3': case 'interior_4':
      case 'interior_5': case 'interior_6': case 'interior_7': case 'interior_8': {
        const num = angleId.split('_')[1];
        return (
          <img
            src={`/guides/${num}.png`}
            alt={`Interior guide ${num}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.55, filter: 'invert(1) brightness(1.8)' }}
          />
        );
      }
      default: return null;
    }
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
      <div style={{ width: '92%', height: '82%' }}>{shape()}</div>
      {/* crosshair */}
      <div className="absolute" style={{ width: 24, height: 24, opacity: .2 }}>
        <div className="absolute" style={{ top: '50%', left: 0, right: 0, height: 1, background: '#fff', transform: 'translateY(-50%)' }} />
        <div className="absolute" style={{ left: '50%', top: 0, bottom: 0, width: 1, background: '#fff', transform: 'translateX(-50%)' }} />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getIsLandscape = () =>
  typeof window !== 'undefined' && window.innerWidth > window.innerHeight;

// ─── Main Component ────────────────────────────────────────────────────────────

const CameraCapture: React.FC<CameraCaptureProps> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({});
  const [showGuides, setShowGuides] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCarDetected, setIsCarDetected] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(getIsLandscape);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const angleStripRef = useRef<HTMLDivElement>(null);

  const activeAngle = CAMERA_ANGLES[currentStep];
  const totalCaptures = Object.keys(capturedImages).length;
  const isCurrentCaptured = !!capturedImages[activeAngle.id];
  const guidesVisible = showGuides && !isCarDetected;

  // Signal camera mode to other components (hides the Navbar)
  useEffect(() => {
    document.body.setAttribute('data-camera-mode', 'true');
    return () => document.body.removeAttribute('data-camera-mode');
  }, []);

  // Orientation detection via resize
  useEffect(() => {
    const onResize = () => setIsLandscape(getIsLandscape());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Scroll active angle into view in the bottom strip
  useEffect(() => {
    const strip = angleStripRef.current;
    if (!strip) return;
    const activeEl = strip.querySelector(`[data-idx="${currentStep}"]`) as HTMLElement | null;
    activeEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentStep]);

  // Camera stream
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => { }); setIsCameraActive(true); }
    }).catch(() => alert('Unable to access camera. Please check your browser permissions.'));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Load YOLO model
  useEffect(() => { loadYoloModel().then(s => { if (s) setModelReady(true); }); }, []);

  // Detection loop
  useEffect(() => {
    if (!modelReady) return;
    const gz = ANGLE_GUIDE_ZONES[activeAngle.id];
    if (!gz) { setIsCarDetected(false); return; }
    let cancelled = false;

    const run = async () => {
      if (cancelled || !yoloSession) return;
      try {
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          const vw = video.videoWidth, vh = video.videoHeight, fa = vw * vh;
          const dets = await runYoloDetection(video);
          const inZone = dets.some(({ bbox }) => {
            const [bx, by, bw, bh] = bbox;
            if ((bw * bh) / fa < gz.minSizeFraction) return false;
            const nx = bx / vw, ny = by / vh, nw = bw / vw, nh = bh / vh;
            const asp = bw / Math.max(bh, 1);
            if (asp < gz.minAspect || asp > gz.maxAspect) return false;
            if (overlapRatio(nx, ny, nw, nh, gz.x, gz.y, gz.w, gz.h) < gz.minOverlap) return false;
            const cx = nx + nw / 2, cy = ny + nh / 2;
            if (cx < gz.x || cx > gz.x + gz.w || cy < gz.y || cy > gz.y + gz.h) return false;
            if (gz.expectedView) { const v = analyzeCarFrontRear(video, [bx, by, bw, bh]); if (v === 'unknown' || v !== gz.expectedView) return false; }
            if (gz.expectedFrontSide === 'center' || gz.expectedFrontSide === 'any') return true;
            const fs = analyzeCarFrontSide(video, [bx, by, bw, bh]);
            return fs !== 'unknown' && fs === gz.expectedFrontSide;
          });
          if (!cancelled) setIsCarDetected(inZone);
        }
      } catch { /* ignore */ }
      if (!cancelled) detectionRef.current = setTimeout(run, 400);
    };
    detectionRef.current = setTimeout(run, 800);
    return () => { cancelled = true; if (detectionRef.current) clearTimeout(detectionRef.current); };
  }, [modelReady, currentStep]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.9);
    setReviewImage(data);
  }, []);

  const confirmPhoto = useCallback(() => {
    if (!reviewImage) return;
    setCapturedImages(prev => ({ ...prev, [activeAngle.id]: reviewImage }));
    setReviewImage(null);
    if (currentStep < CAMERA_ANGLES.length - 1) setTimeout(() => setCurrentStep(s => s + 1), 200);
  }, [reviewImage, activeAngle.id, currentStep]);

  const retakePhoto = useCallback(() => {
    setReviewImage(null);
  }, []);

  const handleRetake = useCallback(() => setCapturedImages(prev => { const n = { ...prev }; delete n[activeAngle.id]; return n; }), [activeAngle.id]);
  const handleSkip = useCallback(() => { if (currentStep < CAMERA_ANGLES.length - 1) setCurrentStep(s => s + 1); }, [currentStep]);
  const handleFinish = useCallback(() => {
    if (!totalCaptures) return;
    onComplete(Object.entries(capturedImages).map(([angle, data]) => ({ angle: angle as CameraAngle, data })));
  }, [capturedImages, totalCaptures, onComplete]);

  // ── Shared sub-components ──────────────────────────────────────────────────

  /** Angle-chip factory used by both portrait strip and landscape sidebar. */
  const renderAngleChip = (angle: typeof CAMERA_ANGLES[number], idx: number, vertical = false) => {
    const isActive = currentStep === idx;
    const isCaptured = !!capturedImages[angle.id];
    return (
      <button
        key={angle.id}
        data-idx={idx}
        onClick={() => setCurrentStep(idx)}
        style={{
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '5px 8px', borderRadius: 14,
          background: isActive
            ? 'rgba(37,99,235,0.85)'
            : isCaptured
              ? 'rgba(16,185,129,0.7)'
              : 'rgba(0,0,0,0.5)',
          border: `1.5px solid ${isActive ? '#3b82f6' : isCaptured ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.1)'}`,
          cursor: 'pointer', transition: 'all .2s',
          backdropFilter: 'blur(8px)',
          minWidth: vertical ? 48 : 52,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 9, overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {isCaptured ? (
            <>
              <img src={capturedImages[angle.id]} alt={angle.label}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: '#fff', fontWeight: 900
              }}>✓</div>
            </>
          ) : (
            <img src={angle.img} alt={angle.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
        <span style={{
          fontSize: 7, fontWeight: 700,
          color: isActive ? '#fff' : isCaptured ? 'rgba(255,255,255,0.85)' : '#6b7280',
          textTransform: 'uppercase', letterSpacing: .5,
          whiteSpace: 'nowrap', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {angle.label}
        </span>
      </button>
    );
  };

  /** Add-extra-angle slot chip. */
  const renderAddSlot = () => (
    <button style={{
      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '5px 8px', borderRadius: 14,
      background: 'rgba(0,0,0,0.3)',
      border: '1.5px dashed rgba(255,255,255,0.12)',
      cursor: 'pointer', opacity: .5, minWidth: 48,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 18, color: '#6b7280' }}>+</span>
      </div>
      <span style={{ fontSize: 7, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 }}>Add</span>
    </button>
  );

  /** Capture ring + retake thumbnail + finish button. */
  const renderCaptureControls = (vertical = false) => (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      justifyContent: 'center', alignItems: 'center', gap: 0,
    }}>
      {/* Retake */}
      <div style={{ width: vertical ? 'auto' : 56, height: vertical ? 56 : 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isCurrentCaptured && (
          <button onClick={handleRetake} style={{
            position: 'relative', width: 46, height: 46, borderRadius: 12, overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, background: 'none',
          }}>
            <img src={capturedImages[activeAngle.id]} alt="retake" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff'
            }}>↺</div>
          </button>
        )}
      </div>

      {/* Capture ring */}
      <button onClick={takePhoto} style={{
        width: 72, height: 72, borderRadius: 36,
        border: '5px solid rgba(255,255,255,0.9)', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        margin: vertical ? '16px 0' : '0 24px',
        boxShadow: '0 0 20px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 28,
          background: isCurrentCaptured ? '#22c55e' : '#ef4444',
          boxShadow: `0 0 16px ${isCurrentCaptured ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'}`,
          transition: 'background .25s, box-shadow .25s',
        }} />
      </button>

      {/* Finish */}
      <div style={{ width: vertical ? 'auto' : 56, height: vertical ? 56 : 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {totalCaptures > 0 && (
          <button onClick={handleFinish} style={{
            width: 48, height: 48, borderRadius: 24,
            background: '#2563eb', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 20, color: '#fff',
            boxShadow: '0 0 16px rgba(37,99,235,0.5)',
          }} title="Finish & Process">✓</button>
        )}
      </div>
    </div>
  );

  /** Front / Rear legend badges. */
  const renderLegend = () => {
    if (!guidesVisible || activeAngle.isInterior) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
        {[{ c: FC, l: 'FRONT' }, { c: RC, l: 'REAR' }].map(({ c, l }) => (
          <div key={l} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ width: 3, height: 12, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 7, fontWeight: 800, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: .8 }}>{l}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000', display: 'flex',
      flexDirection: isLandscape ? 'row' : 'column',
    }}>

      {/* ─── CAMERA FEED (full layer behind everything) ─── */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
      />

      {/* Green glow border on detection */}
      {isCarDetected && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none',
          border: '5px solid rgba(16,185,129,0.6)', boxShadow: 'inset 0 0 40px rgba(16,185,129,0.2)'
        }} />
      )}

      {/* SVG Guide */}
      {guidesVisible && isCameraActive && !reviewImage && <Guide3DOverlay angleId={activeAngle.id} />}

      {/* ─── PHOTO REVIEW OVERLAY ─── */}
      {reviewImage && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: '#000', display: 'flex',
          flexDirection: isLandscape ? 'row' : 'column',
          justifyContent: 'space-between',
        }}>
          {/* Angle label */}
          <div style={{
            padding: '16px', zIndex: 51,
            background: isLandscape
              ? 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)'
              : 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
            ...(isLandscape ? { position: 'absolute', top: 0, left: 0, right: 0 } : {}),
          }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: 10,
              color: '#fff', fontSize: 13, fontWeight: 700,
            }}>
              {activeAngle.label} — {currentStep + 1}/{CAMERA_ANGLES.length}
            </div>
          </div>

          {/* Photo preview */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: isLandscape ? '48px 16px 16px' : '0 16px' }}>
            <img src={reviewImage} alt="Review" style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8,
            }} />
          </div>

          {/* Confirm / Retake buttons */}
          <div style={{
            display: 'flex',
            flexDirection: isLandscape ? 'column' : 'row',
            justifyContent: 'center', alignItems: 'center', gap: 24,
            padding: isLandscape ? '16px 20px' : '20px 16px max(env(safe-area-inset-bottom, 16px), 28px)',
            background: isLandscape
              ? 'linear-gradient(to left, rgba(0,0,0,0.85), transparent)'
              : 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
            flexShrink: 0,
          }}>
            <button onClick={retakePhoto} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '16px 32px', borderRadius: 20,
              background: 'rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.6)',
              color: '#ef4444', fontSize: 16, fontWeight: 800,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1.5,
            }}>↺ Retake</button>
            <button onClick={confirmPhoto} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '16px 40px', borderRadius: 20,
              background: '#22c55e', border: '2px solid rgba(34,197,94,0.8)',
              color: '#fff', fontSize: 16, fontWeight: 800,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1.5,
              boxShadow: '0 0 24px rgba(34,197,94,0.4)',
            }}>✓ Confirm</button>
          </div>
        </div>
      )}

      {/* ─── TOP BAR ─── */}
      <div style={{
        position: 'absolute', top: 0,
        left: isLandscape ? 80 : 0,
        right: isLandscape ? 90 : 0,
        zIndex: 30,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: 'env(safe-area-inset-top, 12px) 12px 10px',
        paddingTop: 'max(env(safe-area-inset-top,0px) + 8px, 12px)',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
      }}>
        {/* Back + step info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} style={{
            width: 34, height: 34, borderRadius: 17,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#3b82f6', letterSpacing: 2, textTransform: 'uppercase' }}>
              {currentStep + 1} / {CAMERA_ANGLES.length}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: .5,
              textShadow: '0 1px 4px rgba(0,0,0,0.8)', lineHeight: 1.1
            }}>
              {activeAngle.label}
            </div>
            {!modelReady && <div style={{ fontSize: 8, color: '#6b7280', marginTop: 1 }}>Loading detector…</div>}
          </div>
        </div>

        {/* Right buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {totalCaptures > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(16,185,129,0.85)', padding: '4px 10px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)'
            }}>
              <div style={{ width: 5, height: 5, borderRadius: 3, background: '#fff' }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {totalCaptures} done
              </span>
            </div>
          )}
          <button onClick={() => setShowGuides(g => !g)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 14,
            background: showGuides ? 'rgba(37,99,235,0.7)' : 'rgba(0,0,0,0.35)',
            border: `1px solid ${showGuides ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: showGuides ? '#fff' : '#9ca3af', fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
          }}>
            {showGuides ? '👁' : '🚫'}
          </button>
          <button onClick={handleSkip} style={{
            padding: '4px 9px', borderRadius: 14,
            background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#9ca3af', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer',
          }}>SKIP</button>
        </div>
      </div>

      {/* ─── CAR DETECTED BADGE ─── */}
      {isCarDetected && (
        <div style={{
          position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.9)', padding: '5px 14px', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.2)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />
          <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 2.5 }}>CAR DETECTED</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LANDSCAPE LAYOUT                                                      */}
      {/* Left sidebar = angle strip ▸ right column = legend + capture controls */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {isLandscape && (
        <>
          {/* ── Left sidebar: vertical angle strip ── */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 30,
            width: 74, display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(to right, rgba(0,0,0,0.80) 0%, transparent 100%)',
            paddingTop: 8, paddingBottom: 8,
          }}>
            <div
              ref={angleStripRef}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 6,
                overflowY: 'auto', padding: '4px 6px',
                scrollbarWidth: 'none',
              }}
              className="angle-strip-hide-scrollbar"
            >
              {CAMERA_ANGLES.map((angle, idx) => renderAngleChip(angle, idx, true))}
              {renderAddSlot()}
            </div>
          </div>

          {/* ── Right column: legend + capture controls ── */}
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30,
            width: 90, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', gap: 12,
            background: 'linear-gradient(to left, rgba(0,0,0,0.60) 0%, transparent 100%)',
          }}>
            {renderLegend()}
            {renderCaptureControls(true)}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* PORTRAIT FALLBACK — "Rotate your device" overlay                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {!isLandscape && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
        }}>
          <div style={{ fontSize: 56 }}>📱🔄</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, textAlign: 'center', letterSpacing: 0.5 }}>
            Gerät drehen
          </div>
          <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
            Bitte drehen Sie Ihr Gerät ins Querformat, um die Kamera zu verwenden.
          </div>
          <button onClick={onBack} style={{
            marginTop: 16, padding: '12px 32px', borderRadius: 16,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>← Zurück</button>
        </div>
      )}

      {/* Hidden capture canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default CameraCapture;
