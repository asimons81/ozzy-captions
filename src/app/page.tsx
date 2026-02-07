"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, CheckCircle, Loader2, Video, FileText, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [bridgeUrl, setBridgeUrl] = useState<string>('https://disclosure-jerry-church-sleeps.trycloudflare.com');
  const [useBridge, setUseBridge] = useState<boolean>(true);

  // We use a ref to store the worker
  const worker = useRef<Worker | null>(null);

  // Check if bridge is alive
  useEffect(() => {
    const checkBridge = async () => {
        try {
            const resp = await fetch(`${bridgeUrl}/health`);
            if (resp.ok) {
                console.log("[Main] Local Bridge is alive");
                addLog("Local Bridge: ONLINE (Hybrid Mode)");
                setUseBridge(true);
            } else {
                setUseBridge(false);
            }
        } catch (e) {
            console.log("[Main] Local Bridge not reachable, using Browser AI");
            addLog("Local Bridge: OFFLINE (Browser Mode)");
            setUseBridge(false);
        }
    };
    checkBridge();
  }, [bridgeUrl]);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 10));
  };

  // Initialize the worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log("[Main] Initializing Worker...");
    try {
      // Create a new worker with module type
      worker.current = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module'
      });

      // Define a callback for messages from the worker
      const onMessageReceived = (e: MessageEvent) => {
        // Log all messages from worker for debugging
        console.log("[Main] Worker Message:", e.data);
        addLog(`Worker: ${e.data.status || 'event'}`);
        
        const { status, progress, file } = e.data;

        const normalizeProgress = (p: number) => (p <= 1 ? p * 100 : p);

        switch (status) {
          case 'worker_alive':
            console.log("[Main] Worker is alive and ready");
            break;
          case 'initiate':
            setStep(0);
            setProgress(0);
            break;
          case 'download':
          case 'progress':
            if (progress !== undefined) {
              setProgress(normalizeProgress(progress));
            }
            break;
          case 'done':
            // One file finished, but others might follow. 
            // We can keep the progress at 100 for this file until the next one starts
            setProgress(100);
            break;
          case 'ready':
            console.log("[Main] Model ready for transcription");
            setStep(1);
            setProgress(0); // Reset progress for the next step (transcription)
            break;
          case 'update':
            // Handle real-time transcription updates
            if (e.data.progress !== undefined) {
                // This might be transcription progress
                setProgress(normalizeProgress(e.data.progress));
            }
            break;
          case 'complete':
            setResult(e.data.output);
            setStep(2);
            setTimeout(() => setStatus('completed'), 500);
            break;
          case 'error':
            console.error("[Main] Worker reported error:", e.data.error);
            const detailedError = typeof e.data.error === 'object' ? JSON.stringify(e.data.error) : String(e.data.error);
            setErrorMessage(detailedError);
            setStatus('error');
            break;
          default:
            // Fallback for any other messages with progress
            if (progress !== undefined) {
              setProgress(normalizeProgress(progress));
            }
            break;
        }
      };

      const onError = (e: ErrorEvent) => {
        console.error("[Main] Worker ErrorEvent:", e.message, "at", e.filename, ":", e.lineno);
        setErrorMessage(`Worker Error: ${e.message}`);
        setStatus('error');
      };

      // Attach listeners
      worker.current.addEventListener('message', onMessageReceived);
      worker.current.addEventListener('error', onError);

      // Clean up
      return () => {
        console.log("[Main] Terminating Worker...");
        worker.current?.terminate();
        worker.current = null;
      };
    } catch (err) {
      console.error("[Main] Failed to initialize worker:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load worker");
      setStatus('error');
    }
  }, []);

  const steps = [
    { name: 'Loading Whisper Model', icon: <Video className="w-5 h-5" /> },
    { name: 'Transcribing Audio', icon: <FileText className="w-5 h-5" /> },
    { name: 'Generating Captions', icon: <Play className="w-5 h-5" /> },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setErrorMessage(null);
    }
  };

  const [isRendering, setIsRendering] = useState(false);

  const handleDownload = async () => {
    if (!result || !file) return;
    
    if (useBridge) {
        try {
            setIsRendering(true);
            addLog("Hybrid: Requesting Render...");
            
            const formData = new FormData();
            formData.append('file', file);
            // result is the object { segments: [...] }
            formData.append('segments', JSON.stringify(result.segments));

            const response = await fetch(`${bridgeUrl}/render`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Bridge render failed');
            }

            // Trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `captioned_${file.name.replace(/\.[^/.]+$/, "")}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            addLog("Hybrid: Download started");

        } catch (error) {
            console.error("[Main] Render error:", error);
            addLog(`Render Error: ${error instanceof Error ? error.message : 'failed'}`);
            setErrorMessage("Rendering failed on the bridge.");
        } finally {
            setIsRendering(false);
        }
    } else {
        alert("Video rendering is only available in Hybrid Mode for now. Please download the transcript.");
    }
  };

  const processVideo = async () => {
    if (!file) return;
    
    if (!worker.current) {
        setErrorMessage("Worker not initialized. Try refreshing.");
        setStatus('error');
        return;
    }

    setStatus('processing');
    setStep(0);
    setErrorMessage(null);

    if (useBridge) {
        try {
            console.log("[Main] Using Hybrid Bridge for transcription...");
            addLog("Hybrid: Sending file to local machine...");
            
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${bridgeUrl}/transcribe`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Bridge transcription failed');
            }

            const data = await response.json();
            console.log("[Main] Hybrid transcription complete:", data);
            addLog("Hybrid: Transcription received");
            
            setResult(data);
            setStep(2);
            setTimeout(() => setStatus('completed'), 500);
            return;

        } catch (error) {
            console.error("[Main] Bridge error, falling back to Browser AI:", error);
            addLog(`Hybrid Error: ${error instanceof Error ? error.message : 'failed'}`);
            // Don't return, fall through to browser AI
            setUseBridge(false);
        }
    }

    try {
      console.log("[Main] Preparing audio data for Browser AI...");
      // 1. Prepare Audio on the main thread (needed for AudioContext)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0);

      console.log("[Main] Sending data to worker...");
      // 2. Send to worker
      // We transfer the buffer to the worker for better performance
      worker.current.postMessage({
        audio: audioData,
        model: 'xenova/whisper-tiny.en'
      }, [audioData.buffer]);

      // Close audio context to free up resources
      audioContext.close();

    } catch (error) {
      console.error("[Main] Error during audio preparation:", error);
      setErrorMessage(error instanceof Error ? error.message : "Audio processing failed");
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-teal/30 font-sans">
      {/* Header */}
      <nav className="p-6 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="font-bold text-black text-xl">O</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tighter">
              OZZY<span className="text-teal">CAPTIONS</span>
            </h1>
          </div>
          <div className="text-sm font-medium text-white/60 border border-white/20 px-3 py-1 rounded-full flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${useBridge ? 'bg-teal animate-pulse' : 'bg-yellow-500'}`} />
            {useBridge ? 'Hybrid: Bridge Online' : 'Browser Mode'}
          </div>
        </div>
      </nav>

      {/* Hero / Main Area */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold mb-6 tracking-tight"
          >
            Video captions <br />
            <span className="text-teal italic">reimagined.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto"
          >
            High-precision local transcription using Whisper AI. 
            Styled with Remotion. Free forever.
          </motion.p>
        </div>

        {/* Action Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal/5 blur-[100px] rounded-full -mr-32 -mt-32" />
          
          <AnimatePresence mode="wait">
            {(status === 'idle' || status === 'error') && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-8"
              >
                {status === 'error' && (
                  <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Error Occurred</p>
                      <p className="text-sm opacity-80">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <label className="cursor-pointer flex flex-col items-center gap-4 w-full">
                   <input 
                    type="file" 
                    className="hidden" 
                    accept="video/*,audio/*"
                    onChange={handleFileChange}
                  />
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-300 ${file ? 'bg-teal text-black border-teal' : 'bg-white/5 border-white/10 group-hover:border-white/20'}`}>
                    {file ? <CheckCircle className="w-10 h-10" /> : <Upload className="w-10 h-10 text-white" />}
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">
                      {file ? file.name : "Drop your video here"}
                    </h3>
                    <p className="text-gray-500">
                      {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB selected` : "MP4, MOV, WEBM or MP3."}
                    </p>
                  </div>
                </label>

                <button 
                  onClick={processVideo}
                  disabled={!file}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2 ${
                    file 
                      ? 'bg-teal text-black hover:bg-white cursor-pointer' 
                      : 'bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  Generate Captions
                </button>

                {logs.length > 0 && (
                    <div className="w-full bg-black/40 border border-white/5 p-4 rounded-xl font-mono text-[10px] text-gray-500 max-h-32 overflow-y-auto mt-4">
                      <p className="text-gray-400 mb-2 font-bold uppercase tracking-widest text-[9px]">Live Diagnostics</p>
                      {logs.map((log, i) => <div key={i}>{`> ${log}`}</div>)}
                    </div>
                )}
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <div className="flex flex-col gap-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold">Processing Pipeline</h3>
                    <div className="flex items-center gap-2 text-teal">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-mono">In Progress...</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {steps.map((s, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                          idx === step 
                            ? 'bg-white/10 border-white/20' 
                            : idx < step 
                              ? 'bg-teal/5 border-teal/20 opacity-50' 
                              : 'bg-white/5 border-white/10 opacity-30'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          idx <= step ? 'bg-teal text-black' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {idx < step ? <CheckCircle className="w-6 h-6" /> : s.icon}
                        </div>
                        <div className="flex-1">
                            <span className="font-bold text-lg block">{s.name}</span>
                            {idx === step && (
                                <div className="mt-2 w-full bg-white/10 h-1.5 rounded-full overflow-hidden relative">
                                    <motion.div 
                                        className="bg-teal h-full absolute left-0 top-0"
                                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                                    />
                                </div>
                            )}
                            {idx === step && (
                                <span className="text-xs text-gray-400 mt-1 block">
                                    {progress ? `${Math.round(progress)}%` : 'Initializing...'}
                                </span>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {logs.length > 0 && (
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl font-mono text-[10px] text-gray-500 max-h-32 overflow-y-auto">
                      <p className="text-gray-400 mb-2 font-bold uppercase tracking-widest text-[9px]">Live Diagnostics</p>
                      {logs.map((log, i) => <div key={i}>{`> ${log}`}</div>)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {status === 'completed' && (
              <motion.div 
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="w-20 h-20 bg-teal rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(79,183,160,0.4)]">
                  <CheckCircle className="w-10 h-10 text-black" />
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-2">Done!</h3>
                  <p className="text-gray-400">Your captioned video is ready.</p>
                  
                  {result && (
                     <div className="mt-4 p-4 bg-gray-900 rounded-lg text-left max-w-lg max-h-40 overflow-y-auto font-mono text-xs text-teal/80">
                       {JSON.stringify(result, null, 2)}
                     </div>
                  )}

                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setStatus('idle')}
                    className="border border-white/20 px-8 py-4 rounded-xl font-bold hover:bg-white/10 transition-colors"
                  >
                    Start Over
                  </button>
                  <button 
                    onClick={handleDownload}
                    disabled={isRendering}
                    className="bg-teal text-black px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {isRendering ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Rendering...
                        </>
                    ) : (
                        "Download Video"
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="p-10 text-center text-gray-600 text-sm">
        Built by Tony & Ozzy • Open Source • Local AI
      </footer>
    </main>
  );
}
