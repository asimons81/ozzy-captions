import { pipeline, env, type PipelineType } from '@xenova/transformers';

// Configuration
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

// Ensure ONNX runtime wasm files load correctly in browser
// (otherwise it can hang at 0% if the wasm files 404)
// Using a more robust version-less path if possible, or sticking to the exact version
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
// Avoid SharedArrayBuffer requirements on hosts without cross-origin isolation
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = true;

console.log('[Worker] Worker script loaded and initializing...', { env: JSON.parse(JSON.stringify(env)) });

// Notify main thread that worker is alive
self.postMessage({ status: 'worker_alive' });

// Global error handler for the worker
self.onerror = (event) => {
    console.error('[Worker Global Error]', event);
    self.postMessage({ status: 'error', error: `Global Worker Error: ${String(event)}` });
};

/**
 * This class uses the singleton pattern to ensure that only one instance of the
 * pipeline is loaded. This is important as loading the model can be a slow
 * and memory-intensive process.
 */
class TranscriptionPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(model: string, progress_callback: any = null) {
        if (this.instance === null || this.model !== model) {
            this.model = model;
            console.log('[Worker] Initializing pipeline for task:', this.task, 'model:', this.model);
            try {
                this.instance = await pipeline(this.task, this.model, { 
                    progress_callback,
                    // Additional options for better reliability
                    revision: 'main',
                    // Use custom quantized models if needed, but tiny is safe
                });
                console.log('[Worker] Pipeline initialized successfully');
            } catch (error) {
                console.error('[Worker] Error initializing pipeline:', error);
                
                // Fallback: try loading without progress callback or with different settings
                if (progress_callback) {
                    console.log('[Worker] Retrying without progress callback...');
                    this.instance = await pipeline(this.task, this.model);
                } else {
                    this.instance = null;
                    throw error;
                }
            }
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { audio, model } = event.data;
    const modelToUse = model || TranscriptionPipeline.model;
    
    console.log('[Worker] Received message from main thread', { 
        hasAudio: !!audio, 
        model: modelToUse,
        audioLength: audio?.length 
    });

    if (!audio) {
        console.error('[Worker] No audio data received');
        self.postMessage({ status: 'error', error: 'No audio data provided to worker' });
        return;
    }

    try {
        // Load the pipeline
        console.log('[Worker] Getting pipeline instance for', modelToUse);
        const transcriber = await TranscriptionPipeline.getInstance(modelToUse, (x: any) => {
            // Send progress back to the main thread
            console.log('[Worker] Progress Update:', x);
            self.postMessage(x);
        });

        // Ensure UI knows model is ready (especially if cached)
        self.postMessage({ status: 'ready', model: modelToUse });

        if (typeof transcriber !== 'function') {
            throw new Error('Pipeline initialized but is not a function');
        }

        // Run transcription
        console.log('[Worker] Starting transcription execution...');
        const totalDuration = audio.length / 16000;
        
        const output = await transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            // callback_function is for real-time updates
            callback_function: (item: any) => {
                // Calculate progress based on how many seconds have been processed
                // Whisper callback 'item' contains chunks or partial results
                let currentProgress = 0;
                if (item && item.chunks && item.chunks.length > 0) {
                    const lastChunk = item.chunks[item.chunks.length - 1];
                    if (lastChunk.timestamp) {
                        const currentTime = lastChunk.timestamp[1] || lastChunk.timestamp[0];
                        currentProgress = (currentTime / totalDuration) * 100;
                    }
                }

                self.postMessage({
                    status: 'update',
                    progress: currentProgress,
                    ...item
                });
            }
        });

        // Send the result back to the main thread
        console.log('[Worker] Transcription complete successfully');
        self.postMessage({
            status: 'complete',
            output: output
        });
    } catch (error) {
        console.error('[Worker] Fatal error during transcription:', error);
        self.postMessage({
            status: 'error',
            error: error instanceof Error ? error.stack || error.message : String(error)
        });
    }
});
