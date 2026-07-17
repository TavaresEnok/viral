#!/usr/bin/env bash
# Regras de firewall para o node_agent (porta 9873)
# Aceita apenas conexões locais (127.0.0.1) — o modulo_ia acessa via localhost.
set -euo pipefail
iptables -D INPUT -p tcp --dport 9873 -j DROP 2>/dev/null || true
iptables -D INPUT -p tcp --dport 9873 -s 127.0.0.1 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 1 -p tcp --dport 9873 -s 127.0.0.1 -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 9873 -j DROP
