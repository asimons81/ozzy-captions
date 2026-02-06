"use client";

import React, { useState } from 'react';
import { Upload, Play, CheckCircle, Loader2, Video, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [step, setStep] = useState(0);

  const steps = [
    { name: 'Extracting Audio', icon: <Video className="w-5 h-5" /> },
    { name: 'Whisper AI Transcribe', icon: <FileText className="w-5 h-5" /> },
    { name: 'Remotion Video Render', icon: <Play className="w-5 h-5" /> },
  ];

  const handleStart = () => {
    setStatus('processing');
    setStep(0);
    
    // Simulate pipeline steps
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps.length) {
        clearInterval(interval);
        setStatus('completed');
      } else {
        setStep(currentStep);
      }
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-teal/30 font-sans">
      {/* Header */}
      <nav className="p-6 border-b border-teal/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center">
              <span className="font-bold text-black text-xl">O</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tighter">
              OZZY<span className="text-teal">CAPTIONS</span>
            </h1>
          </div>
          <div className="text-sm font-medium text-teal/60 border border-teal/20 px-3 py-1 rounded-full">
            $0.00 Auto-Captioning
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
          className="bg-[#0a0a0a] border border-teal/20 rounded-3xl p-8 md:p-12 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal/5 blur-[100px] rounded-full -mr-32 -mt-32" />
          
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="w-20 h-20 bg-teal/10 rounded-2xl flex items-center justify-center border border-teal/20 group-hover:border-teal/50 transition-colors">
                  <Upload className="w-10 h-10 text-teal" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Drop your video here</h3>
                  <p className="text-gray-500">MP4, MOV or WEBM. Max 500MB.</p>
                </div>
                <button 
                  onClick={handleStart}
                  className="bg-teal text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-white transition-colors flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Generate Captions
                </button>
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
                            ? 'bg-teal/10 border-teal/50' 
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
                        <span className="font-bold text-lg">{s.name}</span>
                      </div>
                    ))}
                  </div>
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
                  <p className="text-gray-400">Your captioned video is ready for download.</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setStatus('idle')}
                    className="border border-teal/20 px-8 py-4 rounded-xl font-bold hover:bg-teal/10 transition-colors"
                  >
                    Start Over
                  </button>
                  <button className="bg-teal text-black px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition-colors">
                    Download Video
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
