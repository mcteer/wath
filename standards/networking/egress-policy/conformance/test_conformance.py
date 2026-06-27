"""Conformance tests for egress-policy (EGR-001..002)."""
from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
if "WATH_ARTIFACT_ROOT" in __import__("os").environ:
    ROOT = Path(__import__("os").environ["WATH_ARTIFACT_ROOT"]).resolve()

SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schema" / "integration.params.schema.json").read_text()
)


def _load_params():
    path = ROOT / "integration.params.json"
    assert path.exists(), "integration.params.json missing"
    data = json.loads(path.read_text())
    jsonschema.validate(data, SCHEMA)
    return data


def test_EGR_001_explicit_destinations_no_wildcards():
    params = _load_params()
    for rule in params["egress"]:
        assert "*" not in rule["host"], f"wildcard host: {rule['host']}"


def test_EGR_002_no_broad_internet_egress():
    params = _load_params()
    for rule in params["egress"]:
        host = rule["host"]
        assert host not in ("0.0.0.0", "0.0.0.0/0", "*"), f"broad egress: {host}"


def test_artifact_networkpolicy_when_kubernetes():
    params = _load_params()
    if params["runtime"] == "kubernetes":
        np = ROOT / "k8s" / "networkpolicy-egress.yaml"
        assert np.exists(), "k8s/networkpolicy-egress.yaml required for kubernetes runtime"
        yaml.safe_load(np.read_text())
