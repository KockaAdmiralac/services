import os.path
from pathlib import Path


def get_script_dir() -> Path:
    return Path(os.path.dirname(os.path.realpath(__file__)))
