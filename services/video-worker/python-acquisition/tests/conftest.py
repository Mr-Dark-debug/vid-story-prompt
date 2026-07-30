import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("VIDRIAL_ACQUISITION_TOKEN", "test-acquisition-token-which-is-long")
