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

# insightface compila uma extensão C++ (face3d/mesh) na instalação — sem
# gcc/Python.h o pip falha (testado: "gcc: No such file" e depois "Python.h:
# No such file" quando só build-essential é instalado, sem python3-dev).
# build-essential+python3-dev são instalados E removidos no MESMO RUN do pip
# install: como cada RUN vira uma camada, purgar num RUN separado não encolhe
# a imagem — o toolchain continuaria na camada de baixo, só escondido.
#
# Detecção facial na GPU (backend "scrfd", já era o padrão no código, só
# nunca tinha as libs instaladas). A decisão anterior de deixar isso de fora
# citava ~3GB do stack YOLO/PyTorch (get_yolo_face_model) — mas o backend
# padrão do app (get_face_app/insightface) é ONNX puro, sem PyTorch:
# onnxruntime-gpu + insightface + opencv somam ~300MB, não 3GB. cuDNN 9
# (exigido pelo onnxruntime-gpu 1.23 nesta versão de CUDA) já vem montado
# pelo NVIDIA Container Toolkit, então não precisa de nada a mais na imagem.
#
# Algo na árvore de dependências (nenhum dos dois declara isso na própria
# metadata, então é indireto) puxa o pacote `onnxruntime` normal (CPU) além
# do `onnxruntime-gpu` pedido. Os dois instalam arquivos no MESMO diretório
# `onnxruntime/`, e o pacote CPU sobrescreve o provider bridge do pacote GPU
# — resultado: `undefined symbol: Provider_GetHost` ao tentar carregar
# CUDAExecutionProvider, falhando em silêncio pro CPU (testado e confirmado
# com dlopen manual). Por isso o force-reinstall --no-deps no final: garante
# que os arquivos do wheel GPU são os que ficam de pé.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3-dev \
    && pip3 install --no-cache-dir \
      "fastapi==0.115.6" \
      "uvicorn[standard]==0.34.0" \
      "faster-whisper==1.1.1" \
      "python-multipart==0.0.20" \
      "pydantic==2.10.4" \
      "requests==2.32.3" \
      "opencv-python-headless==4.10.0.84" \
      "onnxruntime-gpu==1.23.2" \
      "insightface==0.7.3" \
    && pip3 uninstall -y onnxruntime \
    && pip3 install --no-cache-dir --force-reinstall --no-deps "onnxruntime-gpu==1.23.2" \
    && apt-get purge -y --auto-remove build-essential python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Falha o build se algum import do app não resolver, em vez de descobrir isso
# só quando o container sobe e fica unhealthy.
RUN python3 -c "from faster_whisper import BatchedInferencePipeline, WhisperModel; import fastapi, uvicorn; import cv2, onnxruntime, insightface; print('imports ok')"

# Baixa os pesos do detector (buffalo_sc, só o módulo de detecção) durante o
# build, não na primeira requisição em produção — sem isso o primeiro corte
# smart-crop de cada deploy pagaria um download de rede antes de renderizar.
# ctx_id=-1 (CPU) de propósito: o build não tem acesso à GPU (sem --gpus),
# só precisa baixar o arquivo .onnx pro cache, não rodar inferência real.
RUN python3 -c "\
from insightface.app import FaceAnalysis; \
app = FaceAnalysis(name='buffalo_sc', allowed_modules=['detection']); \
app.prepare(ctx_id=-1, det_size=(320, 320)); \
print('modelo de deteccao facial baixado e pronto')"

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
