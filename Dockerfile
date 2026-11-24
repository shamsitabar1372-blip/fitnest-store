FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --create-home --uid 10001 fitnest
COPY backend /app/backend
COPY assets /app/assets
COPY index.html /app/index.html
RUN mkdir -p /app/.private /app/backend/media /app/backend/staticfiles && chown -R fitnest:fitnest /app
USER fitnest
WORKDIR /app/backend
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "30", "--access-logfile", "-", "--error-logfile", "-"]
