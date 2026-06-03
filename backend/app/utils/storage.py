import json
from pathlib import Path
from typing import Any, Union


def read_file(path: Union[str, Path]) -> Any:
    with Path(path).open(encoding="utf-8") as f:
        return json.load(f)


def write_file(path: Union[str, Path], data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
