#!/usr/bin/env bash
# 斗地主插件一键部署脚本
#
# 重要：DSH web 服务器实际服务的是 /Users/markus/deepseek-harness/apps/web/ 目录
# （服务器进程: node apps/cli/lib/bin.js web, cwd=/Users/markus/deepseek-harness）
# 以前误部署到 humanoid-robot/deepseek-harness-src/ 导致改动完全不生效！
#
# 用法:
#   ./deploy.sh            # 重新生成 doudizhu.html 并同步全部文件到服务器目录
#   ./deploy.sh --no-build # 跳过重新生成，只同步已有文件（快速部署）
set -euo pipefail

DOU_DIR="$(cd "$(dirname "$0")" && pwd)"
DST="/Users/markus/deepseek-harness/apps/web"

echo "=== 斗地主源码目录: $DOU_DIR ==="
echo "=== 部署目标(服务器实际读取): $DST ==="

if [[ "${1:-}" != "--no-build" ]]; then
  echo "=== 重新生成 doudizhu.html ==="
  cd "$DOU_DIR"
  python3 -c "
import os
js_files = ['cards.js', 'characters.js', 'game.js', 'ai.js', 'renderer.js', 'audio.js', 'speech.js', 'main.js']
js_content = ''
for f in js_files:
    with open(f'js/{f}', 'r') as fh:
        js_content += fh.read() + '\n\n'
with open('css/style.css', 'r') as fh:
    css_content = fh.read()
with open('index.html', 'r') as fh:
    html_content = fh.read()
html_content = html_content.replace('<link rel=\"stylesheet\" href=\"css/style.css\">', '')
for f in js_files:
    html_content = html_content.replace(f'<script src=\"js/{f}\"></script>', '')
html_content = html_content.replace('</head>', f'<style>{css_content}</style></head>')
html_content = html_content.replace('</body>', f'<script>{js_content}</script></body>')
html_content = html_content.replace('padding: 10px;', 'padding: 6px;')
html_content = html_content.replace('padding: 8px 16px;', 'padding: 6px 12px;')
html_content = html_content.replace('padding: 8px 20px 8px;', 'padding: 4px 12px 4px;')
html_content = html_content.replace('padding: 10px 20px 20px;', 'padding: 6px 16px 12px;')
html_content = html_content.replace('padding: 10px 20px;', 'padding: 6px 12px;')
html_content = html_content.replace('margin-bottom: 10px;', 'margin-bottom: 6px;')
html_content = html_content.replace('margin-bottom: 8px;', 'margin-bottom: 4px;')
html_content = html_content.replace('width: 60px;\n  height: 84px;', 'width: 52px;\n  height: 72px;')
html_content = html_content.replace('.card-small {\n  width: 44px;\n  height: 62px;', '.card-small {\n  width: 38px;\n  height: 54px;')
html_content = html_content.replace('#hand-cards .card {\n  margin-left: -18px;', '#hand-cards .card {\n  margin-left: -14px;')
with open('_deploy_tmp.html', 'w') as fh:
    fh.write(html_content)
print(f'生成 _deploy_tmp.html: {os.path.getsize(\"_deploy_tmp.html\")} bytes')
"
fi

echo "=== 同步到服务器目录 (public + dist) ==="
# doudizhu.html（优先用刚生成的文件，否则用服务器目录现有最新版）
DDZ_SRC="$DOU_DIR/_deploy_tmp.html"
if [[ ! -f "$DDZ_SRC" ]]; then
  DDZ_SRC="$DST/dist/doudizhu.html"
  echo "（--no-build 模式，从服务器目录现有 doudizhu.html 同步）"
fi
cp "$DDZ_SRC" "$DST/public/doudizhu.html"
cp "$DDZ_SRC" "$DST/dist/doudizhu.html"
# 插件脚本 + 试听页 + BGM
cp "$DOU_DIR/public/doudizhu-plugin.js" "$DST/public/doudizhu-plugin.js" 2>/dev/null || true
cp "$DOU_DIR/public/doudizhu-plugin.js" "$DST/dist/doudizhu-plugin.js" 2>/dev/null || true
cp "$DOU_DIR/public/tts_preview.html" "$DST/public/tts_preview.html" 2>/dev/null || true
cp "$DOU_DIR/public/tts_preview.html" "$DST/dist/tts_preview.html" 2>/dev/null || true
cp "$DOU_DIR/public/dou_dizhu_bgm.mp3" "$DST/public/dou_dizhu_bgm.mp3" 2>/dev/null || true
cp "$DOU_DIR/public/dou_dizhu_bgm.mp3" "$DST/dist/dou_dizhu_bgm.mp3" 2>/dev/null || true
# 语音同步：从持久源 dou-dizhu/tts_assets 同步到服务器目录（public + dist）
# 注意：绝不能在同步前 rm 源（源是持久目录，不在服务器目录内）
TTS_SRC="$DOU_DIR/tts_assets"
if [ -d "$TTS_SRC/tts_cosy_it" ]; then
  rm -rf "$DST/public/tts_cosy_it" "$DST/dist/tts_cosy_it"
  cp -R "$TTS_SRC/tts_cosy_it" "$DST/public/tts_cosy_it"
  cp -R "$TTS_SRC/tts_cosy_it" "$DST/dist/tts_cosy_it"
  echo "tts_cosy_it: $(ls $DST/dist/tts_cosy_it/*.wav | wc -l | tr -d ' ') wav"
else
  echo "⚠ 持久源缺少 tts_cosy_it（先在 tts_models 跑 pregen_indextts.py）"
fi
if [ -d "$TTS_SRC/tts_cosy" ]; then
  rm -rf "$DST/public/tts_cosy" "$DST/dist/tts_cosy"
  cp -R "$TTS_SRC/tts_cosy" "$DST/public/tts_cosy"
  cp -R "$TTS_SRC/tts_cosy" "$DST/dist/tts_cosy"
  echo "tts_cosy: $(ls $DST/dist/tts_cosy/*.wav | wc -l | tr -d ' ') wav"
else
  echo "⚠ 持久源缺少 tts_cosy（先在 tts_models 跑 pregen_cosyvoice.py）"
fi

echo "=== 清理临时文件 ==="
rm -f "$DOU_DIR/_deploy_tmp.html"

echo "=== 验证服务器 ==="
echo "doudizhu.html 大小: $(stat -f%z $DST/dist/doudizhu.html) bytes"
curl -s "http://127.0.0.1:3080/doudizhu.html?check=$(date +%s)" | grep -c "MIN_STAY" | xargs echo "服务器 MIN_STAY 引用:"
curl -s "http://127.0.0.1:3080/tts_cosy_it/manifest.json" | python3 -c "import json,sys; print('服务器 tts_cosy_it manifest:', len(json.load(sys.stdin)), '条')" 2>/dev/null || echo "⚠ manifest 校验失败"
echo "=== 部署完成！浏览器 Cmd+Shift+R 刷新 ==="
