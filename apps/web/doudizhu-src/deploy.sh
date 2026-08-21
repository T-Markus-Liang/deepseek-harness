#!/usr/bin/env bash
# 斗地主插件一键部署脚本
#
# 重要：DSH web 服务器实际服务的是 apps/web/dist/ 目录
# （服务器进程: node apps/cli/lib/bin.js web, 由 launchd com.deepseek.dsh-web 管理）
# dist/ 是 Vite 构建产物目录，frontend-static 从 distIndex serve。
#
# 集成架构（抗 DSH 更新）：
#   - 插件注入：不再修改 apps/web/index.html，改由 dsh-doudizhu 用户级插件
#     （~/.dsh/local-plugins/dsh-doudizhu）通过 webServer.tapIndex() 在服务时
#     动态注入 <script src="/doudizhu-plugin.js">。DSH 更新重建 index.html 不影响。
#   - 静态资源：doudizhu.html / doudizhu-plugin.js / BGM / TTS 全部部署到 dist/，
#     frontend-static 直接 serve。public/ 是 Vite 源目录，不再同步（避免冗余）。
#
# 用法:
#   ./deploy.sh            # 重新生成 doudizhu.html 并同步全部文件到 dist/
#   ./deploy.sh --no-build # 跳过重新生成，只同步已有文件（快速部署）
set -euo pipefail

# 自动解析 DSH 仓库根（本脚本位于 <root>/apps/web/doudizhu-src/deploy.sh）
DOU_DIR="$(cd "$(dirname "$0")" && pwd)"
DSH_ROOT="$(cd "$DOU_DIR/../../.." && pwd)"
DST="$DSH_ROOT/apps/web/dist"

echo "=== 斗地主源码目录: $DOU_DIR ==="
echo "=== DSH 仓库根: $DSH_ROOT ==="
echo "=== 部署目标(服务器实际读取): $DST ==="

# JS 文件按依赖顺序（cards → characters → game → ai → renderer → audio → speech → main）
# 新 JS 文件需手动加入此列表（保持依赖顺序）
JS_FILES=('cards.js' 'characters.js' 'game.js' 'ai.js' 'renderer.js' 'audio.js' 'speech.js' 'main.js')

if [[ "${1:-}" != "--no-build" ]]; then
  echo "=== 重新生成 doudizhu.html ==="
  cd "$DOU_DIR"
  python3 - "$DST" "${JS_FILES[@]}" << 'PYEOF'
import os, sys

dst_root = sys.argv[1]
js_files = sys.argv[2:]

# 读取源文件
js_content = ''
for f in js_files:
    path = f'js/{f}'
    if not os.path.exists(path):
        print(f'⚠ 缺少 js/{f}，跳过')
        continue
    with open(path, 'r') as fh:
        js_content += fh.read() + '\n\n'
with open('css/style.css', 'r') as fh:
    css_content = fh.read()
with open('index.html', 'r') as fh:
    html_content = fh.read()

# 构建时替换：移除外部引用，内联 css/js
html_content = html_content.replace('<link rel="stylesheet" href="css/style.css">', '')
for f in js_files:
    html_content = html_content.replace(f'<script src="js/{f}"></script>', '')
html_content = html_content.replace('</head>', f'<style>{css_content}</style></head>')
html_content = html_content.replace('</body>', f'<script>{js_content}</script></body>')

# 尺寸压缩（弹窗 iframe 内更紧凑）
SIZE_REPLACES = [
    ('padding: 10px;', 'padding: 6px;'),
    ('padding: 8px 16px;', 'padding: 6px 12px;'),
    ('padding: 8px 20px 8px;', 'padding: 4px 12px 4px;'),
    ('padding: 10px 20px 20px;', 'padding: 6px 16px 12px;'),
    ('padding: 10px 20px;', 'padding: 6px 12px;'),
    ('margin-bottom: 10px;', 'margin-bottom: 6px;'),
    ('margin-bottom: 8px;', 'margin-bottom: 4px;'),
    ('width: 60px;\n  height: 84px;', 'width: 52px;\n  height: 72px;'),
    ('.card-small {\n  width: 44px;\n  height: 62px;', '.card-small {\n  width: 38px;\n  height: 54px;'),
    ('#hand-cards .card {\n  margin-left: -18px;', '#hand-cards .card {\n  margin-left: -14px;'),
]
for old, new in SIZE_REPLACES:
    html_content = html_content.replace(old, new)

# 写入构建产物
out = '_deploy_tmp.html'
with open(out, 'w') as fh:
    fh.write(html_content)
print(f'生成 {out}: {os.path.getsize(out)} bytes')
PYEOF
fi

echo "=== 同步到服务器目录 (dist) ==="
# doudizhu.html（优先用刚生成的文件，否则用服务器目录现有最新版）
DDZ_SRC="$DOU_DIR/_deploy_tmp.html"
if [[ ! -f "$DDZ_SRC" ]]; then
  DDZ_SRC="$DST/doudizhu.html"
  echo "（--no-build 模式，从服务器目录现有 doudizhu.html 同步）"
fi
cp -f "$DDZ_SRC" "$DST/doudizhu.html" 2>/dev/null || true
# 插件脚本 + 试听页 + BGM
cp "$DOU_DIR/public/doudizhu-plugin.js" "$DST/doudizhu-plugin.js" 2>/dev/null || true
cp "$DOU_DIR/public/tts_preview.html" "$DST/tts_preview.html" 2>/dev/null || true
cp "$DOU_DIR/public/dou_dizhu_bgm.mp3" "$DST/dou_dizhu_bgm.mp3" 2>/dev/null || true
# 角色头像（真人+二次元风格，8 角色 + 玩家）
if [ -d "$DOU_DIR/public/avatars" ]; then
  rm -rf "$DST/avatars"
  cp -R "$DOU_DIR/public/avatars" "$DST/avatars"
  echo "avatars: $(ls $DST/avatars/*.jpg 2>/dev/null | wc -l | tr -d ' ') jpg"
fi
# 语音同步：从持久源 tts_assets 同步到服务器目录（dist）
# 注意：绝不能在同步前 rm 源（源是持久目录，不在服务器目录内）
TTS_SRC="$DOU_DIR/tts_assets"
if [ -d "$TTS_SRC/tts_cosy_roles" ]; then
  rm -rf "$DST/tts_cosy_roles"
  cp -R "$TTS_SRC/tts_cosy_roles" "$DST/tts_cosy_roles"
  echo "tts_cosy_roles: $(ls $DST/tts_cosy_roles/*.wav | wc -l | tr -d ' ') wav"
else
  echo "⚠ 持久源缺少 tts_cosy_roles（先在 tts_models 跑 pregen_cosyvoice3_roles.py）"
fi
if [ -d "$TTS_SRC/tts_cosy_it" ]; then
  rm -rf "$DST/tts_cosy_it"
  cp -R "$TTS_SRC/tts_cosy_it" "$DST/tts_cosy_it"
  echo "tts_cosy_it: $(ls $DST/tts_cosy_it/*.wav | wc -l | tr -d ' ') wav"
else
  echo "⚠ 持久源缺少 tts_cosy_it（先在 tts_models 跑 pregen_indextts.py）"
fi
if [ -d "$TTS_SRC/tts_cosy" ]; then
  rm -rf "$DST/tts_cosy"
  cp -R "$TTS_SRC/tts_cosy" "$DST/tts_cosy"
  echo "tts_cosy: $(ls $DST/tts_cosy/*.wav | wc -l | tr -d ' ') wav"
else
  echo "⚠ 持久源缺少 tts_cosy（先在 tts_models 跑 pregen_cosyvoice.py）"
fi

echo "=== 清理临时文件 ==="
rm -f "$DOU_DIR/_deploy_tmp.html"

echo "=== 验证服务器 ==="
echo "doudizhu.html 大小: $(stat -f%z "$DST/doudizhu.html") bytes"
curl -s "http://127.0.0.1:3080/doudizhu.html?check=$(date +%s)" | grep -c "MIN_STAY" | xargs echo "服务器 MIN_STAY 引用:"
curl -s "http://127.0.0.1:3080/tts_cosy_it/manifest.json" | python3 -c "import json,sys; print('服务器 tts_cosy_it manifest:', len(json.load(sys.stdin)), '条')" 2>/dev/null || echo "⚠ manifest 校验失败"
curl -s -o /dev/null -w "doudizhu-plugin.js: HTTP %{http_code}\n" "http://127.0.0.1:3080/doudizhu-plugin.js"
curl -s -o /dev/null -w "doudizhu.html: HTTP %{http_code}\n" "http://127.0.0.1:3080/doudizhu.html"
echo "=== 部署完成！浏览器 Cmd+Shift+R 刷新 ==="
