# Tier-1 "before" consumer demo — static DB credentials (to be replaced by Wath onboarding).

FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/

ENV DATABASE_URL=postgres://demo:demo@localhost:5432/demo

CMD ["python", "-m", "src.main"]
