import asyncio
import json
import uuid
import os
import shutil
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from downloader import fetch_info, download_video

app = FastAPI(title="VideoDL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = Path("/tmp/videodl")
TEMP_DIR.mkdir(exist_ok=True)


class InfoRequest(BaseModel):
    url: str


@app.post("/api/info")
async def api_info(req: InfoRequest):
    try:
        data = await asyncio.to_thread(fetch_info, req.url)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.websocket("/api/download")
async def api_download(ws: WebSocket):
    await ws.accept()
    try:
        raw = await ws.receive_text()
        payload = json.loads(raw)
        url = payload["url"]
        format_id = payload.get("format_id", "best")

        file_id = uuid.uuid4().hex
        out_path = TEMP_DIR / f"{file_id}.mp4"

        def progress_hook(d):
            if d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes", 0)
                percent = (downloaded / total * 100) if total else 0
                asyncio.run_coroutine_threadsafe(
                    ws.send_text(json.dumps({"status": "progress", "percent": percent})),
                    loop
                )
            elif d["status"] == "finished":
                asyncio.run_coroutine_threadsafe(
                    ws.send_text(json.dumps({"status": "progress", "percent": 100})),
                    loop
                )

        loop = asyncio.get_running_loop()
        await asyncio.to_thread(download_video, url, format_id, str(out_path), progress_hook)

        await ws.send_text(json.dumps({"status": "done", "file_id": file_id}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"status": "error", "detail": str(e)}))
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


@app.get("/api/file/{file_id}")
async def api_file(file_id: str):
    path = TEMP_DIR / f"{file_id}.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="video/mp4", filename=f"{file_id}.mp4")


@app.get("/")
async def root():
    return {"status": "ok", "service": "VideoDL"}
