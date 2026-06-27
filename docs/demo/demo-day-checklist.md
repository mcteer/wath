# Demo-day checklist

Run `./scripts/demo-prewarm.sh` the morning of the demo.

## Environment

- [ ] Node 20+, Python 3.11+, `pytest` deps installed
- [ ] `./scripts/verify-golden-fixture.sh --static-only` passes
- [ ] `npm run build` clean (engine + MCP server)
- [ ] **wath-core** running: `podman compose -f deploy/podman-compose.yml up -d` and `curl http://localhost:8080/healthz`
- [ ] Docker running (optional — tier-1 live curl)
- [ ] `vault` + `kubeconform` installed if showing full toolchain step

## Credentials

- [ ] `deploy/.env` copied from `deploy/.env.example` with `CURSOR_API_KEY` set (or exported in shell)
- [ ] `WATH_CONSUMER_REPO_URL` set to a GitHub repo the cloud agent can push to (e.g. fork of orders-api demo)
- [ ] `gh` authenticated for merge polling (`./scripts/poll-merge-prs.sh`)
- [ ] MCP URLs reachable from cloud agent VM (if using custom MCP)
- [ ] Egress allowlist configured in Cursor cloud environment (if applicable)

## Latency hedge

- [ ] `./scripts/demo-fallback-pr.sh` rehearsed — know which files to open
- [ ] Screen recording of a clean full run saved (ultimate fallback)
- [ ] Decision made: live kickoff + cut to fallback PR, or full live walkthrough

## Talking points (reflexive)

- [ ] "Wath proposes, never merges" — human ratification
- [ ] "Failing gates are hard stops" — never weaken checks
- [ ] JWT stand-in honest limitation — see [boundary-lines.md](./boundary-lines.md)

## 10-minute front-load drill

- [ ] `./scripts/demo-run.sh` completes segments 1–4 in under 10 minutes
