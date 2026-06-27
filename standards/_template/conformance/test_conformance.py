# {{STANDARD_ID}} conformance — run via verify.sh

import json
import os
from pathlib import Path

import pytest

ROOT = Path(os.environ.get("WATH_ARTIFACT_ROOT", ".")).resolve()


def test_{{RULE_PREFIX}}_001_placeholder():
    p = ROOT / "integration.params.json"
    assert p.exists(), "integration.params.json missing"
