#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sudo install -m 0644 "$ROOT_DIR/deploy/systemd/viralforge-api.service" /etc/systemd/system/viralforge-api.service
sudo install -m 0644 "$ROOT_DIR/deploy/systemd/viralforge-web.service" /etc/systemd/system/viralforge-web.service
sudo install -m 0644 "$ROOT_DIR/deploy/systemd/viralforge-worker.service" /etc/systemd/system/viralforge-worker.service
sudo systemctl daemon-reload
sudo systemctl enable viralforge-api.service viralforge-web.service viralforge-worker.service
sudo systemctl restart viralforge-api.service viralforge-web.service viralforge-worker.service
sudo systemctl --no-pager --full status viralforge-api.service viralforge-web.service viralforge-worker.service
