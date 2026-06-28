#!/usr/bin/env python3
"""
FinAi - Central Application Control Hub
One file to start/stop/manage the entire application
"""

import os
import sys
import subprocess
import argparse
import time
from loguru import logger

# Configure logger
logger.remove()
logger.add(sys.stdout, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")

def run_command(cmd: list, name: str):
    """Run a command and return the process"""
    logger.info(f"Starting {name}...")
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.getcwd()
        )
        logger.success(f" {name} started (PID: {process.pid})")
        return process
    except Exception as e:
        logger.error(f" Failed to start {name}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="FinAi - Central App Control")
    parser.add_argument("--mode", choices=["all", "api", "chat", "dashboard", "worker", "setup"], 
                       default="all", help="What to start")
    args = parser.parse_args()

    processes = []

    print("\n" + "="*70)
    print("FinAi - Starting Application Components")
    print("="*70 + "\n")

    # Run setup first if requested
    if args.mode in ["all", "setup"]:
        logger.info("Running initial setup...")
        try:
            subprocess.run(["python", "scripts/setup_admin.py"], check=True)
            logger.success("Setup completed successfully")
        except Exception as e:
            logger.warning(f"Setup script warning (may already be done): {e}")

    # Start services based on mode
    if args.mode in ["all", "api"]:
        processes.append(run_command(["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], "FastAPI Backend (API)"))

    if args.mode in ["all", "chat"]:
        processes.append(run_command(["python", "-m", "src.frontend.chat_ui"], "FinAi Chat UI"))

    if args.mode in ["all", "dashboard"]:
        processes.append(run_command(["streamlit", "run", "src/frontend/user_dashboard.py", "--server.port", "8503", "--server.address", "0.0.0.0"], "User Dashboard (Streamlit)"))

    if args.mode in ["all", "worker"]:
        processes.append(run_command(["celery", "-A", "src.celery_app.tasks", "worker", "--loglevel=info", "--beat"], "Celery Worker + Scheduler"))

    print("\n" + "="*70)
    print("All requested services are now running!")
    print("Press Ctrl+C to stop everything gracefully")
    print("="*70 + "\n")

    # Keep the main process alive
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        logger.info("Shutting down all FinAi services...")
        for p in processes:
            if p and p.poll() is None:
                p.terminate()
        logger.success("FinAi shutdown complete. Goodbye!")

if __name__ == "__main__":
    main()