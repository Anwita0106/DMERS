FROM python:3.12-slim
WORKDIR /srv/backend
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
# Migrations live in database/migrations at the project root
COPY database/migrations /srv/database/migrations
ENV DMERS_MIGRATIONS_DIR=/srv/database/migrations UPLOAD_DIR=/srv/uploads
# Hosting platforms (Render, Railway...) pass the port in $PORT; 8000 otherwise (docker compose)
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
