# Tier-1 "before" consumer demo — static DB credentials (replaced by Wath onboarding).

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config/ ./config/
COPY src/ ./src/

ENV DATABASE_URL=postgres://orders:orders@postgres:5432/orders
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
