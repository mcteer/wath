# Tier-1 "before" consumer demo — static DB credentials (to be replaced by Wath onboarding).
# See docs/roadmap/03-build-roadmap.md Phase 1.

FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/

ENV DATABASE_URL=postgres://demo:demo@localhost:5432/demo

CMD ["python", "-m", "src.main"]
