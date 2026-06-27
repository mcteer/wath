# orders-api — tier-1 consumer demo

Deliberately **bad** integration: a small FastAPI service that reads Postgres using a **static**
`DATABASE_URL` credential. This is the "before" state that Wath onboarding replaces with Vault
dynamic secrets.

## What it does

- `GET /health` — liveness
- `GET /orders` — list rows from `orders.orders` (proves DB connectivity)
- `GET /db-check` — reports static DSN usage and connection status

## Run locally (Docker)

```bash
cd examples/consumer-demo
docker compose up --build
```

Then:

```bash
curl http://localhost:8000/orders
curl http://localhost:8000/db-check
```

Expected `db-check` response (abbreviated):

```json
{
  "uses_static_dsn": true,
  "connected": true,
  "order_count": 3,
  "dsn_host": "postgres:5432/orders"
}
```

## Run locally (Postgres + app on host)

Start Postgres with the seed data (or use `docker compose up postgres` only), then:

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## Kubernetes manifests

Static credential is embedded in `k8s/deployment.yaml` — another tier-1 smell Wath fixes.

```bash
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## Onboarding with Wath

Fill out `INTEGRATION_REQUIREMENTS.md` and run Wath onboarding from the repo root:

```bash
node packages/engine/dist/cli/index.js onboard ./examples/consumer-demo
```

Wath should detect the static credential pattern and prescribe a Vault dynamic-secrets integration.
