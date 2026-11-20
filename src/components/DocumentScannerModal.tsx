import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Camera,
  Upload,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileCheck,
  X,
  Sliders,
} from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang } from '../lib/i18n';

interface ScannedPage {
  id: string;
  rawDataUrl: string;
  rotation: number; // 0 | 90 | 180 | 270
  brightness: number; // 70 - 150
  contrast: number; // 80 - 160
  cropMarginPct: number; // 0 - 15
  processedDataUrl: string;
}

interface DocumentScannerModalProps {
  lang: Lang;
  examId: number;
  examTitle: string;
  onClose: () => void;
  onSubmitted: (summary: {
    pageCount: number;
    originalSizeBytes: number;
    optimizedSizeBytes: number;
    profile: string;
  }) => void;
}

async function processPageCanvas(
  rawDataUrl: string,
  rotation: number,
  brightness: number,
  contrast: number,
  cropMarginPct: number,
  quality: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const marginX = Math.floor((img.width * cropMarginPct) / 100);
      const marginY = Math.floor((img.height * cropMarginPct) / 100);
      const srcW = Math.max(100, img.width - marginX * 2);
      const srcH = Math.max(100, img.height - marginY * 2);

      // Resize unnecessarily large captures while keeping math handwriting crisp
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
      const drawW = Math.round(srcW * scale);
      const drawH = Math.round(srcH * scale);

      const rotated = rotation === 90 || rotation === 270;
      const canvas = document.createElement('canvas');
      canvas.width = rotated ? drawH : drawW;
      canvas.height = rotated ? drawW : drawH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(rawDataUrl);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        img,
        marginX,
        marginY,
        srcW,
        srcH,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
      );
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = rawDataUrl;
  });
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  lang,
  examId,
  examTitle,
  onClose,
  onSubmitted,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<'HighQuality' | 'Balanced' | 'SmallSize'>('Balanced');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const qualityMap = {
    HighQuality: 0.9,
    Balanced: 0.72,
    SmallSize: 0.55,
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        lang === 'bn'
          ? 'ক্যামেরা চালু করা যায়নি। নিচে থেকে উত্তরপত্রের ছবি আপলোড করুন।'
          : 'Camera unavailable or permission denied. Use image upload below to scan pages.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const addRawPage = async (rawDataUrl: string) => {
    const processed = await processPageCanvas(rawDataUrl, 0, 108, 118, 2, qualityMap[profile]);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newPage: ScannedPage = {
      id,
      rawDataUrl,
      rotation: 0,
      brightness: 108,
      contrast: 118,
      cropMarginPct: 2,
      processedDataUrl: processed,
    };
    setPages((prev) => [...prev, newPage]);
    setSelectedId(id);
    setPdfBlob(null);
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    await addRawPage(canvas.toDataURL('image/jpeg', 0.92));
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            await addRawPage(reader.result);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const updateSelectedPage = async (patch: Partial<ScannedPage>) => {
    if (!selectedId) return;
    const target = pages.find((p) => p.id === selectedId);
    if (!target) return;
    const next = { ...target, ...patch };
    next.processedDataUrl = await processPageCanvas(
      next.rawDataUrl,
      next.rotation,
      next.brightness,
      next.contrast,
      next.cropMarginPct,
      qualityMap[profile]
    );
    setPages((prev) => prev.map((p) => (p.id === selectedId ? next : p)));
    setPdfBlob(null);
  };

  const movePage = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= pages.length) return;
    const copy = [...pages];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    setPages(copy);
    setPdfBlob(null);
  };

  const deletePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    setPdfBlob(null);
  };

  const buildPdfPreview = async () => {
    if (pages.length === 0) return;
    setError('');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage();
      const processed = await processPageCanvas(
        pages[i].rawDataUrl,
        pages[i].rotation,
        pages[i].brightness,
        pages[i].contrast,
        pages[i].cropMarginPct,
        qualityMap[profile]
      );
      doc.addImage(processed, 'JPEG', 8, 8, pageW - 16, pageH - 16, undefined, 'FAST');
    }

    const blob = doc.output('blob');
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(URL.createObjectURL(blob));
    setPdfBlob(blob);
  };

  const handleSubmit = async () => {
    if (!pdfBlob) return;
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('answerPdf', pdfBlob, `written-exam-${examId}.pdf`);
      formData.append('compressionProfile', profile);
      formData.append('pageCount', String(pages.length));

      const res = await apiFetch(`/api/exams/${examId}/submit-written`, {
        method: 'POST',
        body: formData,
      });
      stopCamera();
      onSubmitted(res.optimization);
    } catch (e: any) {
      setError(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPage = pages.find((p) => p.id === selectedId) || pages[0] || null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn' ? 'ইন্টিগ্রেটেড ডকুমেন্ট স্ক্যানার ও PDF সাবমিশন' : 'Integrated Mobile Document Scanner'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{examTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[82vh] overflow-y-auto">
          {/* Left: Camera / Capture + Page List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4" />
                    {lang === 'bn' ? 'ক্যামেরা চালু করুন' : 'Open Camera'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4" />
                    {lang === 'bn' ? 'পৃষ্ঠা ক্যাপচার করুন' : 'Capture Page'}
                  </button>
                )}

                <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap">
                  <Upload className="w-4 h-4" />
                  {lang === 'bn' ? 'ছবি যোগ করুন' : 'Add Page Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </label>
              </div>

              {cameraError && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{cameraError}</p>
              )}

              {cameraActive && (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-4 border-2 border-dashed border-sky-400/80 pointer-events-none rounded" />
                </div>
              )}
            </div>

            {/* Captured Pages Queue */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  {lang === 'bn' ? `স্ক্যান করা পৃষ্ঠা (${pages.length})` : `Captured Pages (${pages.length})`}
                </span>
              </div>
              {pages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'উত্তরপত্রের ছবি তুলুন অথবা ডিভাইস থেকে আপলোড করুন।'
                    : 'Capture pages with your camera or upload photos of your handwritten sheets.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {pages.map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${
                        selectedPage?.id === p.id
                          ? 'border-sky-600 bg-sky-50/50 dark:bg-sky-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <img
                        src={p.processedDataUrl}
                        alt={`Page ${idx + 1}`}
                        className="w-12 h-14 object-cover rounded border border-slate-200 dark:border-slate-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {lang === 'bn' ? `পৃষ্ঠা ${idx + 1}` : `Page ${idx + 1}`}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {p.rotation}° · B:{p.brightness}% · C:{p.contrast}%
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => movePage(idx, -1)}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePage(idx, 1)}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePage(p.id)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Delete page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Page Editor, Compression Profile & PDF Preview */}
          <div className="lg:col-span-7 space-y-4">
            {selectedPage && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <Sliders className="w-4 h-4" />
                    {lang === 'bn' ? 'পৃষ্ঠা এডিটর (ক্রপ, রোটেট ও ক্লিয়ারিটি)' : 'Page Editor (Crop, Rotate & Readability)'}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedPage({ rotation: (selectedPage.rotation + 90) % 360 })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    {lang === 'bn' ? '৯০° ঘোরান' : 'Rotate 90°'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="bg-slate-100 dark:bg-slate-950 rounded-lg p-2 flex items-center justify-center max-h-64 overflow-hidden">
                    <img
                      src={selectedPage.processedDataUrl}
                      alt="Selected page preview"
                      className="max-h-60 object-contain rounded"
                    />
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>{lang === 'bn' ? 'ব্রাইটনেস' : 'Brightness'}</span>
                        <span className="font-mono">{selectedPage.brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min={70}
                        max={150}
                        value={selectedPage.brightness}
                        onChange={(e) =>
                          updateSelectedPage({ brightness: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>{lang === 'bn' ? 'কনট্রাস্ট' : 'Contrast'}</span>
                        <span className="font-mono">{selectedPage.contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min={80}
                        max={160}
                        value={selectedPage.contrast}
                        onChange={(e) =>
                          updateSelectedPage({ contrast: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>{lang === 'bn' ? 'ম্যানুয়াল ক্রপ মার্জিন' : 'Manual Edge Crop'}</span>
                        <span className="font-mono">{selectedPage.cropMarginPct}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={15}
                        value={selectedPage.cropMarginPct}
                        onChange={(e) =>
                          updateSelectedPage({ cropMarginPct: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compression Profile & PDF Generation */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    {lang === 'bn' ? 'PDF কমপ্রেশন প্রোফাইল' : 'PDF Compression Profile'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {lang === 'bn'
                      ? 'গাণিতিক লেখা পড়ার উপযোগী রেখে স্বয়ংক্রিয় অপ্টিমাইজেশন'
                      : 'Preserves handwritten mathematics legibility while reducing storage size'}
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(['HighQuality', 'Balanced', 'SmallSize'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setProfile(p);
                        setPdfBlob(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        profile === p
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p === 'HighQuality' ? 'High Quality' : p === 'Balanced' ? 'Balanced' : 'Small Size'}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pages.length === 0}
                  onClick={buildPdfPreview}
                  className="py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {lang === 'bn' ? 'PDF তৈরি ও প্রিভিউ দেখুন' : 'Generate & Preview PDF'}
                </button>

                {pdfBlob && (
                  <>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      {(pdfBlob.size / 1024).toFixed(1)} KB · {pages.length} pages
                    </span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSubmit}
                      className="ml-auto flex items-center gap-2 py-2 px-5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium disabled:opacity-50"
                    >
                      <FileCheck className="w-4 h-4" />
                      {submitting
                        ? lang === 'bn'
                          ? 'অপ্টিমাইজ ও আপলোড হচ্ছে...'
                          : 'Optimizing & Uploading...'
                        : lang === 'bn'
                        ? 'চূড়ান্ত উত্তরপত্র জমা দিন'
                        : 'Submit Optimized PDF'}
                    </button>
                  </>
                )}
              </div>

              {pdfPreviewUrl && (
                <iframe
                  src={pdfPreviewUrl}
                  title="Generated Answer Script PDF Preview"
                  className="w-full h-56 rounded-lg border border-slate-200 dark:border-slate-800"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
