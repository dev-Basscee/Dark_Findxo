import os
import sys
import subprocess
import threading
import time
import socket
from pathlib import Path
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory and the django_api directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Add django_api to sys.path
DJANGO_API_DIR = BASE_DIR / "django_api"
if str(DJANGO_API_DIR) not in sys.path:
    sys.path.insert(0, str(DJANGO_API_DIR))

# Initialize Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "findxo_django.settings")
import django
django.setup()

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def run_frontend():
    frontend_dir = BASE_DIR.parent / "find"
    if not frontend_dir.exists():
        print(f"Frontend directory not found at {frontend_dir}")
        return

    print("Starting frontend server (npm run dev)...")
    # Use shell=True for npm on some systems, or just 'npm'
    try:
        subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception as e:
        print(f"Failed to start frontend: {e}")

# Import the FastAPI app from api_modules
from api_modules.app import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "False").lower() == "true"
    
    if debug and not is_port_open(3000):
        run_frontend()
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=debug,
        log_level="info"
    )
