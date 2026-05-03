FROM python:3.12-slim

WORKDIR /app

ENV PYTHONPATH=/app

# Each package is its own layer — Docker caches successes, so a network
# timeout only forces a re-download of the one package that failed.
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 numpy==1.26.4
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 Pillow==10.3.0
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 onnxruntime==1.18.0
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 asyncpg==0.29.0
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 psycopg2-binary==2.9.9
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 celery==5.3.6
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 redis==5.0.4
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 sqlalchemy==2.0.30
RUN pip install --no-cache-dir --prefer-binary --timeout 300 --retries 10 \
    aiofiles==23.2.1 httpx==0.27.0 pydantic==2.7.1 pydantic-settings==2.2.1

COPY . .

CMD ["celery", "-A", "worker", "worker", "--loglevel=info", "--queues=crack.detect"]
