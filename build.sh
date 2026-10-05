#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Membangun Executable DNA - Daily Notes Aku"
echo "========================================================"
echo ""

# Jalankan skrip builder cross-platform menggunakan uv
uv run build_exe.py "$@"

echo ""
echo "[OK] Selesai! File executable / bundle aplikasi tersedia di folder dist/"
