#!/bin/bash
# ============================================================
# 斗地主 CosyVoice2 方言语音系统 - 启动/维护脚本
# ============================================================
# 功能：
#   1. start-tts   : 启动 edge-tts 方言兜底服务器 (127.0.0.1:3098)
#   2. pregen      : 用 CosyVoice2 预生成方言台词音频 (写入 public+dist/tts_cosy)
#   3. status      : 查看各服务/音频状态
#
# 环境要求：
#   - Python 虚拟环境: /Users/markus/humanoid-robot/tts_models/cosy_env
#   - CosyVoice2 模型: /Users/markus/humanoid-robot/tts_models/CosyVoice2-0.5B
#   - CosyVoice 代码: /Users/markus/humanoid-robot/tts_models/CosyVoice
#   - 游戏源码: /Users/markus/humanoid-robot/dou-dizhu
#   - DSH public:  /Users/markus/deepseek-harness/apps/web/public
# ============================================================

ENV=/Users/markus/humanoid-robot/tts_models/cosy_env
PUBLIC=/Users/markus/deepseek-harness/apps/web/public
DIST=/Users/markus/deepseek-harness/apps/web/dist
PRESEN="$PUBLIC/cosyvoice/pregen_cosyvoice.py"

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
  pregen-indextts)
    echo "用 IndexTTS-2（B站2025，方案A方言克隆）预生成主打台词..."
    cd /Users/markus/humanoid-robot/tts_models && \
      indextts_env/bin/python "$PUBLIC/cosyvoice/pregen_indextts.py" 2>&1 | grep -E "OK|FAIL|完成|加载"
    echo "同步到 dist..."
    mkdir -p "$DIST/tts_cosy_it"
    cp "$PUBLIC"/tts_cosy_it/*.wav "$PUBLIC"/tts_cosy_it/manifest.json "$DIST"/tts_cosy_it/ 2>/dev/null
    echo "完成"
    ;;
  pregen)
    echo "用 CosyVoice2 预生成方言台词（已生成自动跳过）..."
    cd /Users/markus/humanoid-robot/tts_models/CosyVoice && \
      "$ENV/bin/python" "$PRESEN" 2>&1 | grep -E "OK|FAIL|完成|加载"
    echo "同步到 dist..."
    mkdir -p "$DIST/tts_cosy"
    cp "$PUBLIC"/tts_cosy/*.wav "$PUBLIC"/tts_cosy/manifest.json "$DIST"/tts_cosy/ 2>/dev/null
    echo "完成"
    ;;
  status)
    echo "=== edge-tts 服务器 ==="
    curl -s --max-time 3 http://127.0.0.1:3098/health || echo "未运行"
    echo ""
    echo "=== CosyVoice 音频 ==="
    echo "public: $(ls $PUBLIC/tts_cosy/*.wav 2>/dev/null | wc -l | tr -d ' ') 条"
    echo "dist:   $(ls $DIST/tts_cosy/*.wav 2>/dev/null | wc -l | tr -d ' ') 条"
    curl -s --max-time 3 http://127.0.0.1:3080/tts_cosy/manifest.json | python3 -c "import json,sys; print('服务器 manifest:', len(json.load(sys.stdin)), '条')" 2>/dev/null || echo "服务器 manifest: 不可达"
    echo ""
    echo "=== CosyVoice2 模型 ==="
    du -sh /Users/markus/humanoid-robot/tts_models/CosyVoice2-0.5B 2>/dev/null | awk '{print $1}'
    ;;
  help|*)
    echo "用法: $0 {start-tts|pregen|status}"
    ;;
esac
