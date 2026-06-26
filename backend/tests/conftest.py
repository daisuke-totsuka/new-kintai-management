import atexit
import runpy
from pathlib import Path


def pytest_configure(config):
    if not getattr(config.option, "json_report", False):
        return

    script_path = Path(__file__).resolve().parents[1] / "scripts" / "export-test-result.py"

    def export_excel():
        if script_path.exists():
            runpy.run_path(str(script_path), run_name="__main__")

    atexit.register(export_excel)
