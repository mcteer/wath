# Demo — rehearsal & demo-day

Phase 7 hardening for the live run-of-show.

| Doc | Purpose |
|-----|---------|
| [run-of-show.md](./run-of-show.md) | 30-minute timed script |
| [demo-day-checklist.md](./demo-day-checklist.md) | Pre-flight checklist |
| [latency-hedge.md](./latency-hedge.md) | Live vs pre-baked PR strategy |
| [boundary-lines.md](./boundary-lines.md) | Q&A one-liners |

## Scripts

```bash
./scripts/demo-prewarm.sh          # before rehearsal or live demo
./scripts/demo-run.sh              # timed local segments (~5-10 min); prefers wath-core
./scripts/demo-run.sh --launch     # + live cloud agent (needs API key + repo URL)
./scripts/demo-live-launch.sh      # live agent only (segment 5 rehearsal)
./scripts/demo-fallback-pr.sh      # walk pre-baked tier-4 PR artifacts
./scripts/poll-merge-prs.sh        # after agent opens PRs — record merges
```

## Quick rehearsal (10 min front-load)

1. `./scripts/demo-prewarm.sh`
2. `cd examples/consumer-demo && docker compose up --build -d` (optional, for live curl)
3. `./scripts/demo-run.sh`

Target: segments 1–4 complete in under 10 minutes. That is the "working tool" beat before architecture slides.
