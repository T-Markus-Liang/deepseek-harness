#!/bin/bash
# 启动 斗地主 TTS 服务器（Microsoft Neural 语音，edge-tts）
# 用法: ./start_tts.sh  或  bash start_tts.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3098

if curl -s --max-time 2 "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
  echo "✅ TTS 服务器已在运行: http://127.0.0.1:${PORT}"
  exit 0
fi

python3 -c "import edge_tts" 2>/dev/null || {
  echo "❌ edge-tts 未安装，正在安装..."
  pip3 install edge-tts --timeout 60 || { echo "❌ 安装失败"; exit 1; }
}

cd "$SCRIPT_DIR"
nohup python3 tts_server.py > /tmp/tts_server.log 2>&1 &
disown

sleep 2
if curl -s --max-time 3 "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
  echo "✅ TTS 服务器已启动: http://127.0.0.1:${PORT}"
  echo "   日志: /tmp/tts_server.log"
else
  echo "❌ 启动失败，查看日志: cat /tmp/tts_server.log"
  exit 1
fi