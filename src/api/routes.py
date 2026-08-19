"""API route recovery shim.

The checked-out routes module was replaced by a prose placeholder in the
upstream snapshot.  Keep the application bootable while loading the last
complete, syntax-checked route module that is present in the repository's
history.
"""

from fastapi import APIRouter
import subprocess
from pathlib import Path


_RECOVERY_REVISION = "7478e62"
_workspace = Path(__file__).resolve().parents[2]

try:
    _source = subprocess.check_output(
        ["git", "show", f"{_RECOVERY_REVISION}:src/api/routes.py"],
        cwd=_workspace,
        stderr=subprocess.STDOUT,
    )
except (OSError, subprocess.CalledProcessError) as exc:
    raise RuntimeError(
        "The API routes module is missing and its repository recovery source "
        "is unavailable."
    ) from exc

exec(compile(_source, str(Path(__file__)), "exec"), globals(), globals())