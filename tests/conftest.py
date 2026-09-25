from __future__ import annotations

import sys
from pathlib import Path

# Allow `import fixtures_gen` when pytest root is the project.
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
