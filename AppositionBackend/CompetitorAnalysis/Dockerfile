# Python analysis API (FastAPI + sentence-transformers + Gemini).
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface

# CPU-only PyTorch: the GPU build is gigabytes larger and the server has no GPU.
# Streamlit is only for the local dashboard, so it is left out of the server image.
COPY requirements.txt .
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && grep -v -i streamlit requirements.txt > requirements-server.txt \
 && pip install -r requirements-server.txt

# Download the embedding model at build time so the service starts without it.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

# Render sets PORT; GEMINI_KEY comes from the service's environment variables.
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
