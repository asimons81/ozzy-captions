from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import shutil
import subprocess
from faster_whisper import WhisperModel

app = FastAPI()

# Enable CORS for Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once on startup
# Using 'tiny' for speed, can be changed to 'base' or 'small'
print("Loading Whisper model...")
model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
print("Model loaded.")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"Transcribing {file.filename}...")
        segments, info = model.transcribe(temp_path, beam_size=5)
        
        result = []
        for segment in segments:
            result.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            
        print(f"Transcription complete: {len(result)} segments")
        return {"segments": result}
    
    except Exception as e:
        print(f"Error during transcription: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/render")
async def render(file: UploadFile = File(...), segments: str = Form(...)):
    temp_video = f"render_input_{file.filename}"
    output_video = f"render_output_{file.filename}"
    temp_json = "render_segments.json"
    
    try:
        # Save video
        with open(temp_video, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Save segments
        # segments is passed as a JSON string
        segments_data = json.loads(segments)
        with open(temp_json, "w") as f:
            json.dump(segments_data, f)
            
        # Prepare props for Remotion
        abs_video_path = os.path.abspath(temp_video)
        props = {
            "segments": segments_data,
            "videoSrc": abs_video_path
        }
        props_json = json.dumps(props)
        
        print(f"Rendering video... {output_video}")
        # Run remotion render
        command = [
            "npx", "remotion", "render", 
            "src/remotion/index.ts", "CaptionVideo", 
            output_video, 
            "--props", props_json,
            "--gl=angle", # Use software rendering if GPU fails
            "--concurrency=1"
        ]
        
        subprocess.run(command, check=True)
        
        if not os.path.exists(output_video):
            raise Exception("Render failed to produce output file")
            
        return FileResponse(output_video, media_type="video/mp4", filename="captioned_video.mp4")

    except Exception as e:
        print(f"Error during rendering: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        for p in [temp_video, temp_json]:
            if os.path.exists(p):
                os.remove(p)
        # Note: We keep output_video briefly to serve it, 
        # but FileResponse usually handles open files. 
        # For a simple bridge, we might leave the output file until next run or use a background task to clean.
        # Here we won't delete output_video immediately so it can be streamed.

@app.get("/health")
async def health():
    return {"status": "alive", "model": "whisper-tiny.en"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
