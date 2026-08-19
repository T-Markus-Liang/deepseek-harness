#!/bin/bash
# ============================================================
# 斗地主 CosyVoice3 方言语音系统 - 启动/维护脚本
# ============================================================
# 功能：
#   1. start-tts   : 启动 edge-tts 兜底服务器 (127.0.0.1:3098)
#   2. pregen      : 用 CosyVoice3 预生成方言台词音频（写入 public+dist/tts_cosy_it）
#   3. status      : 查看各服务/音频状态
#
# 环境要求：
#   - Python 虚拟环境: /Users/markus/humanoid-robot/tts_models/cosy_env
#   - CosyVoice3 模型: /Users/markus/humanoid-robot/tts_models/Fun-CosyVoice3-0.5B-2512
#   - 生成脚本(源):   /Users/markus/humanoid-robot/tts_models/pregen_cosyvoice3_lines.py
#   - 游戏源码: /Users/markus/humanoid-robot/dou-dizhu
#   - DSH public:  /Users/markus/deepseek-harness/apps/web/public
# ============================================================

ENV=/Users/markus/humanoid-robot/tts_models/cosy_env
PUBLIC=/Users/markus/deepseek-harness/apps/web/public
DIST=/Users/markus/deepseek-harness/apps/web/dist

case "${1:-help}" in
  start-tts)
    echo "启动 edge-tts 兜底服务器 (127.0.0.1:3098)..."
    lsof -ti:3098 | xargs kill -9 2>/dev/null
    sleep 1
    cd "$PUBLIC" && nohup python3 tts_server.py > /tmp/tts_server.log 2>&1 &
    disown
    sleep 2
    curl -s --max-time 3 http://127.0.0.1:3098/health && echo " - edge-tts OK" || echo " - 启动失败，看 /tmp/tts_server.log"
    ;;
  pregen)
    echo "用 CosyVoice3（instruct2 方言+情感）预生成方言台词..."
    echo "生成脚本源: /Users/markus/humanoid-robot/tts_models/pregen_cosyvoice3_lines.py"
    echo "（在 tts_models 目录运行 cosy_env/bin/python，输出到 dou-dizhu/tts_assets/，再 ./deploy.sh 同步）"
    ;;
  status)
    echo "=== edge-tts 服务器 ==="
    curl -s --max-time 3 http://127.0.0.1:3098/health || echo "未运行"
    echo ""
    echo "=== CosyVoice3 方言音频 ==="
    echo "public tts_cosy_it: $(ls $PUBLIC/tts_cosy_it/*.wav 2>/dev/null | wc -l | tr -d ' ') 条"
    echo "public tts_cosy:    $(ls $PUBLIC/tts_cosy/*.wav 2>/dev/null | wc -l | tr -d ' ') 条"
    curl -s --max-time 3 http://127.0.0.1:3080/tts_cosy_it/manifest.json | python3 -c "import json,sys; print('服务器 manifest:', len(json.load(sys.stdin)), '条')" 2>/dev/null || echo "服务器 manifest: 不可达"
    ;;
  help|*)
    echo "用法: $0 {start-tts|pregen|status}"
    ;;
esac
