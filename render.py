import subprocess
import sys
import os
import json

def run_pipeline(video_path):
    output_json = "transcription.json"
    output_video = "output.mp4"
    
    # 1. Transcribe
    print("--- STEP 1: TRANSCRIBING ---")
    subprocess.run(["python3", "transcribe.py", video_path, output_json], check=True)
    
    # 2. Render with Remotion
    print("--- STEP 2: RENDERING ---")
    
    with open(output_json, 'r') as f:
        segments = json.load(f)
    
    # Absolute path for videoSrc to ensure Remotion can find it
    abs_video_path = os.path.abspath(video_path)
    
    props = {
        "segments": segments,
        "videoSrc": abs_video_path
    }
    
    props_json = json.dumps(props)
    
    # Run remotion render
    # Note: We use the entry point src/remotion/index.ts
    command = [
        "npx", "remotion", "render", 
        "src/remotion/index.ts", "CaptionVideo", 
        output_video, 
        "--props", props_json
    ]
    
    print(f"Executing: {' '.join(command[:5])} ...")
    subprocess.run(command, check=True)
    
    print(f"--- DONE! Result saved to {output_video} ---")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python render.py <video_path>")
        sys.exit(1)
    
    run_pipeline(sys.argv[1])
