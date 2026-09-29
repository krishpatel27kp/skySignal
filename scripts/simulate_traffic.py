"""
Root shortcut to run backend/scripts/simulate_traffic.py.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1] / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import asyncio
from scripts.simulate_traffic import main

if __name__ == "__main__":
    asyncio.run(main())
