#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# firewall-rules.sh — Regras de iptables para o sistema ViralForge
#
# IPs públicos desta VM:
#   168.194.13.20 — IP principal do sistema ViralForge (roteado diretamente)
#   168.194.15.42 — IP do gateway upstream (via NAT 1:1 no roteador)
#
# Regras de hairpin NAT permitem que esta máquina acesse seus próprios
# serviços via IP público sem "Connection refused".
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Hairpin NAT — IP 168.194.13.20 (IP principal do ViralForge) ─────────────
iptables -t nat -D OUTPUT -d 168.194.13.20 -p tcp --dport 3002 -j DNAT --to-destination 127.0.0.1:3002 2>/dev/null || true
iptables -t nat -D OUTPUT -d 168.194.13.20 -p tcp --dport 3001 -j DNAT --to-destination 127.0.0.1:3001 2>/dev/null || true
iptables -t nat -I OUTPUT 1 -d 168.194.13.20 -p tcp --dport 3002 -j DNAT --to-destination 127.0.0.1:3002
iptables -t nat -I OUTPUT 2 -d 168.194.13.20 -p tcp --dport 3001 -j DNAT --to-destination 127.0.0.1:3001

# ─── Hairpin NAT — IP 168.194.15.42 (gateway upstream via NAT) ───────────────
iptables -t nat -D OUTPUT -d 168.194.15.42 -p tcp --dport 3002 -j DNAT --to-destination 127.0.0.1:3002 2>/dev/null || true
iptables -t nat -D OUTPUT -d 168.194.15.42 -p tcp --dport 3001 -j DNAT --to-destination 127.0.0.1:3001 2>/dev/null || true
iptables -t nat -I OUTPUT 3 -d 168.194.15.42 -p tcp --dport 3002 -j DNAT --to-destination 127.0.0.1:3002
iptables -t nat -I OUTPUT 4 -d 168.194.15.42 -p tcp --dport 3001 -j DNAT --to-destination 127.0.0.1:3001

# ─── Acesso sem porta: 80 → 3002 (web) no IP principal ───────────────────────
# Escopado ao IP público para não capturar tráfego HTTP de saída dos containers.
iptables -t nat -D PREROUTING -d 168.194.13.20 -p tcp --dport 80 -j REDIRECT --to-port 3002 2>/dev/null || true
iptables -t nat -A PREROUTING -d 168.194.13.20 -p tcp --dport 80 -j REDIRECT --to-port 3002
iptables -t nat -D OUTPUT -d 168.194.13.20 -p tcp --dport 80 -j DNAT --to-destination 127.0.0.1:3002 2>/dev/null || true
iptables -t nat -A OUTPUT -d 168.194.13.20 -p tcp --dport 80 -j DNAT --to-destination 127.0.0.1:3002

# ─── node_agent (porta 9873) ──────────────────────────────────────────────────
# Aceita apenas conexões do localhost (modulo_ia acessa via 127.0.0.1).
iptables -D INPUT -p tcp --dport 9873 -j DROP 2>/dev/null || true
iptables -D INPUT -p tcp --dport 9873 -s 127.0.0.1 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 1 -p tcp --dport 9873 -s 127.0.0.1 -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 9873 -j DROP

echo "Regras de firewall aplicadas com sucesso."
