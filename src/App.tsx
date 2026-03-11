import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, Settings, Download, Trash2, RefreshCw, X } from 'lucide-react';
import { MagickFormat } from '@imagemagick/magick-wasm';
import { convertImage, ConvertOptions, initMagick } from './services/magickService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  resultBlob?: Blob;
  error?: string;
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [format, setFormat] = useState<MagickFormat>(MagickFormat.Jpeg);
  const [quality, setQuality] = useState(80);
  const [resizeMode, setResizeMode] = useState<'percentage' | 'exact' | 'none'>('none');
  const [percentage, setPercentage] = useState(100);
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rotate, setRotate] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        status: 'pending' as const
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      await initMagick();
    } catch (err) {
      alert("Failed to initialize ImageMagick. See console for details.");
      setIsProcessing(false);
      return;
    }

    const options: ConvertOptions = {
      format,
      quality,
      flipHorizontal: flipH,
      flipVertical: flipV,
      rotate: rotate > 0 ? rotate : undefined,
    };

    if (resizeMode === 'percentage') {
      options.percentage = percentage;
    } else if (resizeMode === 'exact') {
      if (width) options.width = Number(width);
      if (height) options.height = Number(height);
    }

    let completed = 0;
    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      const item = updatedFiles[i];
      if (item.status === 'done') {
        completed++;
        continue; // Skip already processed
      }

      // Update status to processing
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));

      try {
        const blob = await convertImage(item.file, options);
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', resultBlob: blob } : f));
      } catch (error: any) {
        console.error("Error processing file", item.file.name, error);
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: error.message || 'Unknown error' } : f));
      }

      completed++;
      setProgress(Math.round((completed / updatedFiles.length) * 100));
    }

    setIsProcessing(false);
  };

  const downloadAll = async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);
    if (doneFiles.length === 0) return;

    if (doneFiles.length === 1) {
      // Single file download
      const f = doneFiles[0];
      const ext = format.toLowerCase();
      const newName = f.file.name.replace(/\.[^/.]+$/, "") + "." + ext;
      saveAs(f.resultBlob!, newName);
      return;
    }

    // Multiple files -> ZIP
    const zip = new JSZip();
    doneFiles.forEach(f => {
      const ext = format.toLowerCase();
      const newName = f.file.name.replace(/\.[^/.]+$/, "") + "." + ext;
      zip.file(newName, f.resultBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'converted_images.zip');
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Bulk Image Converter</h1>
        </div>
        <div className="text-sm text-zinc-500">
          Supports CR2, JPG, PNG, WEBP & more
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Settings */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-400" />
              Conversion Settings
            </h2>

            <div className="space-y-5">
              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Output Format</label>
                <select 
                  className="w-full rounded-lg border-zinc-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as MagickFormat)}
                >
                  <option value={MagickFormat.Jpeg}>JPG / JPEG</option>
                  <option value={MagickFormat.Png}>PNG</option>
                  <option value={MagickFormat.Webp}>WEBP</option>
                  <option value={MagickFormat.Gif}>GIF</option>
                  <option value={MagickFormat.Bmp}>BMP</option>
                  <option value={MagickFormat.Tiff}>TIFF</option>
                </select>
              </div>

              {/* Quality */}
              {(format === MagickFormat.Jpeg || format === MagickFormat.Webp) && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-zinc-700">Quality</label>
                    <span className="text-xs text-zinc-500">{quality}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={quality} 
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              )}

              <hr className="border-zinc-100" />

              {/* Resize */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Resize Mode</label>
                <div className="flex bg-zinc-100 p-1 rounded-lg mb-3">
                  {(['none', 'percentage', 'exact'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setResizeMode(mode)}
                      className={cn(
                        "flex-1 text-xs font-medium py-1.5 rounded-md capitalize transition-colors",
                        resizeMode === mode ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {resizeMode === 'percentage' && (
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="1" 
                      max="200" 
                      value={percentage} 
                      onChange={(e) => setPercentage(Number(e.target.value))}
                      className="flex-1 accent-indigo-600"
                    />
                    <span className="text-sm font-medium w-12 text-right">{percentage}%</span>
                  </div>
                )}

                {resizeMode === 'exact' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500 mb-1 block">Width (px)</label>
                      <input 
                        type="number" 
                        placeholder="Auto"
                        value={width}
                        onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-lg border-zinc-300 border px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500 mb-1 block">Height (px)</label>
                      <input 
                        type="number" 
                        placeholder="Auto"
                        value={height}
                        onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-lg border-zinc-300 border px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-zinc-100" />

              {/* Transforms */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Transforms</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={flipH} onChange={e => setFlipH(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                    Flip Horizontal
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={flipV} onChange={e => setFlipV(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                    Flip Vertical
                  </label>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-zinc-500 mb-1">Rotate</label>
                  <select 
                    className="w-full rounded-lg border-zinc-300 border px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                    value={rotate}
                    onChange={e => setRotate(Number(e.target.value))}
                  >
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col gap-3">
            <button
              onClick={processFiles}
              disabled={files.length === 0 || isProcessing}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-medium transition-colors flex justify-center items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Processing... {progress}%
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Convert {files.length > 0 ? files.length : ''} Files
                </>
              )}
            </button>

            {files.some(f => f.status === 'done') && (
              <button
                onClick={downloadAll}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex justify-center items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Results
              </button>
            )}
          </div>
        </div>

        {/* Right Column: File List */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Files ({files.length})</h2>
            {files.length > 0 && (
              <button onClick={clearAll} className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>

          <div 
            className={cn(
              "flex-1 bg-white rounded-2xl border-2 border-dashed border-zinc-300 p-8 flex flex-col items-center justify-center text-center transition-colors relative",
              files.length === 0 ? "min-h-[400px]" : "min-h-[200px] mb-6"
            )}
          >
            <input 
              type="file" 
              multiple 
              accept="image/*,.cr2,.crw,.nef,.dng,.arw" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            <div className="bg-indigo-50 p-4 rounded-full mb-4 text-indigo-600">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 mb-1">Drag & drop images here</h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              Supports standard formats (JPG, PNG) and RAW formats (CR2, NEF, DNG, etc.)
            </p>
            <button className="mt-6 px-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 relative z-10 pointer-events-none">
              Browse Files
            </button>
          </div>

          {files.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <ul className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
                {files.map(file => (
                  <li key={file.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{file.file.name}</p>
                      <p className="text-xs text-zinc-500">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {file.status === 'pending' && <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">Pending</span>}
                      {file.status === 'processing' && <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> Processing</span>}
                      {file.status === 'done' && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Done</span>}
                      {file.status === 'error' && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full truncate max-w-[100px]" title={file.error}>Error</span>}
                      
                      {file.status === 'done' && file.resultBlob && (
                        <span className="text-xs text-zinc-500 w-16 text-right">
                          {(file.resultBlob.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}

                      <button 
                        onClick={() => removeFile(file.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
