# vault-dynamic-secrets conformance — VDS-000..008. Run: verify.sh / pytest -q

import json
import os
import re
from pathlib import Path

import hcl2
import pytest
import yaml
from jsonschema import validate as jsonschema_validate

ROOT = Path(os.environ.get("WATH_ARTIFACT_ROOT", ".")).resolve()
STANDARD_DIR = Path(__file__).resolve().parent.parent

STATIC_CRED_PATTERNS = [
    re.compile(r"(postgres|postgresql|mysql)://[^/\s:]+:[^@/\s]+@", re.I),
    re.compile(r"\bpassword\s*[:=]\s*['\"]?[^\s'\"]{6,}", re.I),
    re.compile(r"secret/data/.*(db|database|postgres|mysql)", re.I),
]
SCAN_EXCLUDE_DIRS = {"vault", "conformance", "schema", ".git", "node_modules", ".wath"}


def _load_params():
    p = ROOT / "integration.params.json"
    assert p.exists(), "integration.params.json missing"
    return json.loads(p.read_text())


def _load_policy_paths():
    p = ROOT / "vault" / "policy.hcl"
    assert p.exists(), "vault/policy.hcl missing"
    with p.open() as fh:
        doc = hcl2.load(fh)
    paths = {}
    for block in doc.get("path", []):
        for path_str, body in block.items():
            key = path_str.strip('"')
            caps = body.get("capabilities", [])
            if caps and isinstance(caps[0], str):
                caps = [c.strip('"') for c in caps]
            paths[key] = {**body, "capabilities": caps}
    assert paths, "policy.hcl declares no path blocks"
    return paths


def _load_manifests():
    docs = []
    for f in (ROOT / "k8s").glob("**/*.y*ml") if (ROOT / "k8s").exists() else []:
        docs.extend(d for d in yaml.safe_load_all(f.read_text()) if d)
    return docs


def _consumer_files():
    for f in ROOT.rglob("*"):
        if f.is_file() and not (set(f.relative_to(ROOT).parts) & SCAN_EXCLUDE_DIRS):
            if "PULL_REQUEST_TEMPLATE" in f.relative_to(ROOT).parts:
                continue
            yield f


@pytest.fixture(scope="module")
def params():
    return _load_params()


def test_VDS_000_params_schema_valid(params):
    schema = json.loads((STANDARD_DIR / "schema" / "integration.params.schema.json").read_text())
    jsonschema_validate(instance=params, schema=schema)


def test_VDS_001_uses_dynamic_creds_path(params):
    assert params["creds_path"].startswith("database/creds/")


def test_VDS_001_no_static_credentials_in_repo():
    offenders = []
    for f in _consumer_files():
        try:
            text = f.read_text(errors="ignore")
        except Exception:
            continue
        for pat in STATIC_CRED_PATTERNS:
            if pat.search(text):
                offenders.append(f"{f.relative_to(ROOT)} :: /{pat.pattern[:40]}.../")
    assert not offenders, "static credential pattern found:\n" + "\n".join(offenders)


def test_VDS_002_ttl_ceilings(params):
    assert params["default_ttl_seconds"] <= 1800
    assert params["max_ttl_seconds"] <= 3600
    assert params["default_ttl_seconds"] <= params["max_ttl_seconds"]


def test_VDS_003_creds_path_is_read_only(params):
    paths = _load_policy_paths()
    creds_path = params["creds_path"]
    assert creds_path in paths, f"policy missing creds_path {creds_path!r}"
    caps = paths[creds_path].get("capabilities", [])
    assert caps == ["read"], f"expected ['read'], got {caps}"


def test_VDS_004_no_wildcard_paths():
    bad = [p for p in _load_policy_paths() if "*" in p]
    assert not bad, f"wildcard path grants: {bad}"


RUNTIME_AUTH = {
    "kubernetes": {"kubernetes"},
    "nomad": {"jwt"},
    "vm": {"approle", "aws", "gcp", "azure"},
}


def test_VDS_005_auth_method_matches_runtime(params):
    allowed = RUNTIME_AUTH[params["runtime"]]
    assert params["auth_method"] in allowed


def test_VDS_006_policy_is_scoped_not_default(params):
    name = params["identity_binding"]["policy_name"]
    assert name != "default" and "admin" not in name


def test_VDS_006_identity_binding_is_specific(params):
    b = params["identity_binding"]
    if params["runtime"] == "kubernetes":
        sas = b.get("k8s_service_accounts", [])
        ns = b.get("k8s_namespaces", [])
        assert sas and "*" not in sas
        assert ns and "*" not in ns
    elif params["runtime"] == "nomad":
        assert b.get("bound_claims")


def test_VDS_007_secret_delivery_present(params):
    docs = _load_manifests()
    kinds = {d.get("kind") for d in docs}
    if params["secret_delivery"] == "vso":
        assert "VaultDynamicSecret" in kinds
    else:
        has_annotations = any(
            any(k.startswith("vault.hashicorp.com/") for k in
                (d.get("spec", {}).get("template", {}).get("metadata", {}).get("annotations", {}) or {}))
            for d in docs if d.get("kind") == "Deployment"
        )
        assert has_annotations


def test_VDS_007_no_plaintext_secret_objects():
    docs = _load_manifests()
    for d in docs:
        if d.get("kind") == "Secret":
            blob = json.dumps(d.get("stringData", {})) + json.dumps(d.get("data", {}))
            assert not re.search(r"(password|postgres|mysql|user:)", blob, re.I)


def test_VDS_008_ships_ci_verification():
    wf = ROOT / ".github" / "workflows"
    candidates = list(wf.glob("*vault*verif*.y*ml")) if wf.exists() else []
    assert candidates
