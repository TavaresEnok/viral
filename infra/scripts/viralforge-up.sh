#!/usr/bin/env bash
#
# Sobe o ViralForge detectando a GPU automaticamente.
#
# Com placa utilizável, aplica o override que entrega a GPU ao worker (NVENC +
# IA). Sem placa — ou com driver/runtime quebrado — sobe igual, só que em CPU.
# Se a subida COM GPU falhar por qualquer motivo, tenta de novo sem ela: o
# sistema no ar em CPU é sempre melhor que o sistema fora do ar.
#
# Uso:
#   infra/scripts/viralforge-up.sh            # detecta sozinho
#   VIRALFORGE_FORCE_CPU=1 infra/…/up.sh      # ignora a GPU de propósito
#
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR" || exit 1

PROJECT="viralforge"
ENV_FILE="infra/.env.deploy"
BASE_FILE="infra/docker-compose.deploy.yml"
GPU_FILE="infra/docker-compose.gpu.yml"

log() { echo "[viralforge-up] $*"; }

if [ ! -f "$ENV_FILE" ]; then
  log "ERRO: $ENV_FILE não encontrado (copie de infra/.env.deploy.example)."
  exit 1
fi

# --- Detecção de GPU -------------------------------------------------------
# Três condições, todas necessárias. Qualquer uma faltando => CPU.
gpu_usable() {
  [ "${VIRALFORGE_FORCE_CPU:-0}" = "1" ] && { log "VIRALFORGE_FORCE_CPU=1: subindo em CPU."; return 1; }

  command -v nvidia-smi >/dev/null 2>&1 || { log "nvidia-smi ausente: sem GPU."; return 1; }
  nvidia-smi -L >/dev/null 2>&1 || { log "nvidia-smi não respondeu (placa removida ou driver quebrado): sem GPU."; return 1; }
  docker info 2>/dev/null | grep -qi 'runtimes:.*nvidia' || { log "runtime nvidia não registrado no Docker: sem GPU."; return 1; }

  return 0
}

compose_up() {
  # "$@" = arquivos de compose extras
  docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$BASE_FILE" "$@" up -d --remove-orphans
}

if gpu_usable; then
  log "GPU detectada: subindo com aceleração (NVENC + IA na placa)."
  if compose_up -f "$GPU_FILE"; then
    log "Pronto — worker com acesso à GPU."
    exit 0
  fi
  log "AVISO: subida com GPU falhou; recaindo para CPU para não deixar o sistema fora do ar."
fi

log "Subindo em CPU."
compose_up
