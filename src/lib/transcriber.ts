// products/ozzy-captions/src/lib/transcriber.ts

import { pipeline } from '@xenova/transformers';

export class Transcriber {
    static instance: any = null;

    static async getInstance() {
        if (!this.instance) {
            this.instance = await pipeline('automatic-speech-recognition', 'xenova/whisper-tiny.en');
        }
        return this.instance;
    }

    static async transcribe(audioFile: File, progressCallback: (progress: number) => void) {
        const transcriber = await this.getInstance();
        
        // Convert audio file to buffer that transformers.js can use
        const buffer = await audioFile.arrayBuffer();
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        
        const audioData = audioBuffer.getChannelData(0); // Get mono channel
        
        // Run transcription
        const result = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            callback_function: (item: any) => {
                // Approximate progress based on chunks processed
                // This is a rough estimation since the model doesn't give 0-100%
                if (progressCallback) progressCallback(50); 
            }
        });

        return result;
    }
}
