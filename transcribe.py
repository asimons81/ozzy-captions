import whisper
import json
import sys
import os
from moviepy.editor import VideoFileClip

def transcribe_video(video_path, output_json):
    print(f"Extracting audio from {video_path}...")
    video = VideoFileClip(video_path)
    audio_path = "temp_audio.mp3"
    video.audio.write_audiofile(audio_path, logger=None)

    print("Loading Whisper model...")
    model = whisper.load_model("base")
    
    print("Transcribing...")
    result = model.transcribe(audio_path, verbose=False)
    
    # Save segments
    segments = []
    for segment in result['segments']:
        segments.append({
            'start': segment['start'],
            'end': segment['end'],
            'text': segment['text'].strip()
        })
    
    with open(output_json, 'w') as f:
        json.dump(segments, f, indent=2)
    
    # Cleanup
    os.remove(audio_path)
    print(f"Transcription saved to {output_json}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python transcribe.py <video_path> <output_json>")
        sys.exit(1)
    
    transcribe_video(sys.argv[1], sys.argv[2])
