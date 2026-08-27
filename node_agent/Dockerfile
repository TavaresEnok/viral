# Serviço de ASR (Whisper) acelerado por GPU.
#
# Base CUDA + cuDNN: o faster-whisper usa CTranslate2, que precisa do cuDNN,
# mas NÃO precisa de PyTorch — por isso a imagem fica bem menor que um stack
# de deep learning tradicional.
#
# Esta tag já existe localmente (é a base das imagens GPU do DRAC), então o
# build não baixa os ~5,5GB de novo.
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# ffmpeg/ffprobe: o app usa para normalizar e inspecionar áudio.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# Conjunto MÍNIMO: só o caminho de transcrição. A detecção facial do app
# (insightface/YOLO/torch) fica de fora de propósito — quem faz isso é o
# worker, local, no face-engine em C++. Instalar torch aqui somaria ~3GB à toa.
RUN pip3 install --no-cache-dir \
      "fastapi==0.115.6" \
      "uvicorn[standard]==0.34.0" \
      "faster-whisper==1.1.1" \
      "python-multipart==0.0.20" \
      "pydantic==2.10.4" \
      # faster_whisper/utils.py importa requests, mas o pacote não o declara
      # como dependência — sem isto o serviço nem sobe (ModuleNotFoundError).
      "requests==2.32.3"

# Falha o build se algum import do app não resolver, em vez de descobrir isso
# só quando o container sobe e fica unhealthy.
RUN python3 -c "from faster_whisper import BatchedInferencePipeline, WhisperModel; import fastapi, uvicorn; print('imports ok')"

WORKDIR /app
COPY node_agent/app.py ./app.py

# Modelos ficam em volume (ver compose): sem isso, cada recriação do container
# baixaria o Whisper de novo (~1,5GB no caso do turbo).
ENV HF_HOME=/models \
    NODE_DIR=/tmp/node-agent \
    NODE_BIND=0.0.0.0 \
    NODE_PORT=9873

EXPOSE 9873
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=120s \
  CMD curl -fsS http://localhost:9873/health || exit 1

CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9873", "--workers", "1"]
