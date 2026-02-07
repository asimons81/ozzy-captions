from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import shutil
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

@app.get("/health")
async def health():
    return {"status": "alive", "model": "whisper-tiny.en"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
