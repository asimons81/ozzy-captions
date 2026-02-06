import { pipeline, env, type PipelineType } from '@xenova/transformers';

// Skip local model checks since we are in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * This class uses the singleton pattern to ensure that only one instance of the
 * pipeline is loaded. This is important as loading the model can be a slow
 * and memory-intensive process.
 */
class TranscriptionPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(progress_callback: any = null) {
        if (this.instance === null) {
            console.log('[Worker] Initializing pipeline for task:', this.task);
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { audio, model } = event.data;
    console.log('[Worker] Received message from main thread');

    if (!audio) {
        console.error('[Worker] No audio data received');
        self.postMessage({ status: 'error', error: 'No audio data provided to worker' });
        return;
    }

    try {
        // Load the pipeline
        console.log('[Worker] Getting pipeline instance...');
        const transcriber = await TranscriptionPipeline.getInstance((x: any) => {
            // Send progress back to the main thread
            self.postMessage(x);
        });

        if (typeof transcriber !== 'function') {
            throw new Error('Pipeline initialized but is not a function');
        }

        // Run transcription
        console.log('[Worker] Starting transcription execution...');
        const output = await transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            // callback_function is for real-time updates
            callback_function: (item: any) => {
                self.postMessage({
                    status: 'update',
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
