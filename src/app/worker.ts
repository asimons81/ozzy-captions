// products/ozzy-captions/src/app/worker.ts
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

class TranscriptionPipeline {
    static task = 'automatic-speech-recognition';
    static model = 'xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(progress_callback: any = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { audio } = event.data;
    console.log('[Worker] Received audio data for transcription');

    try {
        // Load the pipeline
        const transcriber = await TranscriptionPipeline.getInstance((x: any) => {
            // Send progress back to the main thread
            self.postMessage(x);
        });

        // Run transcription
        console.log('[Worker] Starting transcription...');
        const output = await transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            callback_function: (item: any) => {
                self.postMessage({
                    status: 'update',
                    ...item
                });
            }
        });

        // Send the result back to the main thread
        console.log('[Worker] Transcription complete', output);
        self.postMessage({
            status: 'complete',
            output: output
        });
    } catch (error) {
        console.error('[Worker] Error during transcription:', error);
        self.postMessage({
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});
