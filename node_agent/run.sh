#!/usr/bin/env bash
set -euo pipefail

cd /home/ajustconsulting/projeto_enok_microservicos/modulo_ia/node_agent
set -a
. ./.env
set +a

SITE=$(.venv/bin/python - <<'PY'
import site
print(site.getsitepackages()[0])
PY
)

export LD_LIBRARY_PATH="$SITE/nvidia/cublas/lib:$SITE/nvidia/cudnn/lib:$SITE/nvidia/cuda_nvrtc/lib:$SITE/nvidia/curand/lib:$SITE/nvidia/cuda_runtime/lib:$SITE/nvidia/cufft/lib:$SITE/nvidia/cusparse/lib:$SITE/nvidia/cusolver/lib:$SITE/nvidia/nvjitlink/lib:${LD_LIBRARY_PATH:-}"
exec .venv/bin/python -m uvicorn app:app --host "${NODE_BIND:-127.0.0.1}" --port "${NODE_PORT:-9873}" --workers 1
