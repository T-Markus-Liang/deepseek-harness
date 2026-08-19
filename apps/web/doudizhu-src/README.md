# 🃏 斗地主（DSH Web GUI 插件）

前端 AI 斗地主，作为 DeepSeek Harness Web GUI 插件运行：🃏 FAB 按钮 → 弹窗 → iframe 加载 `/doudizhu.html`。

## 功能特性

- **完整斗地主规则**：叫地主（0-3 分）、单张/对子/三带/顺子/连对/飞机/炸弹/王炸/四带二，AI 自动托管
- **真实打牌出牌动画**：出牌先出现在玩家前方（人类=下方 / AI-1=右侧 / AI-2=左侧）展示约 0.9 秒，然后飞向桌子中心加入散乱牌堆（随机位置 + 随机旋转），牌堆永久累积直到游戏结束
- **随机对手角色池**：每局从 8 个角色随机抽取 2 个对手，每个角色有专属 emoji 头像、方言标签、性格化出牌风格
- **三种 AI 性格**：
  - `aggressive`（激进）：爱叫地主（叫分 +3）、爱用炸弹（提前炸抢牌权）、不爱过牌
  - `balanced`（稳健）：合理出牌
  - `conservative`（保守）：少叫地主（叫分 -3）、留大牌晚出、对手出大牌倾向过牌保炸弹
- **方言语音系统**：CosyVoice3 预生成方言台词（东北/四川/粤语），出牌/过牌/叫地主/输赢都有语音，播放失败自动降级 Web Speech
- **QQ 风格 BGM**：小旭音乐背景音乐（fetch + decodeAudioData 播放，Content-Type 无关）
- **出牌记录**：顶部"本局出牌记录"历史条，与牌桌牌堆完全独立

## 角色池

| 角色 | 头像 | 标签 | 性格 | 语音映射 |
|---|---|---|---|---|
| 老胡 | 🧔 | 东北大叔 | aggressive | laohu（东北话） |
| 小呆 | 👩 | 四川大妈 | aggressive | xiaodai（四川话） |
| 阿珍 | 👧 | 粤语女生 | balanced | human（粤语） |
| 德叔 | 🧓 | 北京大爷 | balanced | laohu |
| 王阿姨 | 👵 | 上海阿姨 | conservative | xiaodai |
| 辣妹 | 💃 | 湖南辣妹 | aggressive | human |
| 大壮 | 💪 | 山东大汉 | balanced | laohu |
| 阿妹 | 👸 | 云南阿妹 | conservative | human |

新角色按 `voice` 字段映射到现有 3 个方言语音库（`_roleLines` / `speakViaCosy` 按 voice 查台词与音频），台词文本与音频 key 复用。

## 目录结构

```
dou-dizhu/
├── index.html          # 主页面（含 3 个玩家前方展示位 play-front-0/1/2 + 中心牌堆）
├── css/style.css       # 样式（含牌动画、展示位、散乱牌堆、头像）
├── js/
│   ├── cards.js        # 牌定义、发牌、牌型检测（detectType/findValidPlays）
│   ├── characters.js   # 角色池 + 随机抽取 + 性格参数（PERSONALITY_PARAMS）
│   ├── game.js         # 游戏状态机（开局随机抽对手、叫地主、出牌、胜负）
│   ├── ai.js           # AI 策略（叫分/自由出牌/跟牌，按性格调整）
│   ├── renderer.js     # 渲染（玩家信息/头像/出牌动画/散乱牌堆/历史）
│   ├── audio.js        # BGM 播放（fetch + decodeAudioData）
│   ├── speech.js       # 语音系统（预生成 wav 播放 + Web Speech 降级）
│   └── main.js         # 主控（事件绑定、AI 回合、人类出牌、语音触发）
├── deploy.sh           # 一键部署到 DSH web 服务器目录
├── tts_assets/         # 语音持久源（tts_cosy_it 83 条 + tts_cosy 94 条回退）
└── public/             # 插件脚本（doudizhu-plugin.js）、BGM、试听页
```

## 出牌动画流程（真实打牌复刻）

1. **出牌瞬间**：牌出现在出牌者前方展示位（`play-front-0` 下 / `play-front-1` 右 / `play-front-2` 左），横排展示这一手
2. **停留 0.9 秒**：让玩家看清谁出了什么（`renderer.animatePlayCards` 内 setTimeout 900ms）
3. **汇入中心**：牌飞向桌子中心，`_addToStack` 以行列锚点 + 大幅随机抖动/旋转（±45px / ±14°）散乱堆叠
4. **永久累积**：牌堆不清空直到新一局/游戏结束（`renderPlayArea` 只在 bidding/ended 清空）；超过 15 手时最旧一手淡出（`_trimStack`）

**已知 CSS 要点**：`.played-hand .card` 必须带 `forwards`（覆盖 `.card-animate-in` 的 `opacity:0` 且保持动画结束态），否则动画播完牌变透明（曾导致"出牌闪烁后消失"bug）。

## 部署

```bash
cd /Users/markus/deepseek-harness/apps/web/doudizhu-src
./deploy.sh            # 重新生成 doudizhu.html 并同步到服务器
./deploy.sh --no-build # 只同步已有文件
```

**源码位置**：DSH 仓库 `apps/web/doudizhu-src/`（与部署产物同仓库）。DSH web 服务器实际服务 `apps/web/` 目录（服务器进程 `node apps/cli/lib/bin.js web`，cwd=`/Users/markus/deepseek-harness`），`deploy.sh` 把 `doudizhu.html` 同步到 `apps/web/{public,dist}/`。曾误部署到 `humanoid-robot/deepseek-harness-src/` 导致改动不生效。

部署内容：
- `doudizhu.html` → `apps/web/{public,dist}/`（python 内联拼接 JS/CSS 生成单文件）
- `doudizhu-plugin.js`、`tts_preview.html`、`dou_dizhu_bgm.mp3` → 同上
- `tts_assets/tts_cosy_it` + `tts_assets/tts_cosy` → 同步到 `apps/web/{public,dist}/`（**绝不在同步前 rm 源**，源是持久目录）

部署完成后浏览器 `Cmd+Shift+R` 强制刷新（iframe 有缓存问题，必要时带 `?_t=时间戳` 绕过）。

## 语音系统

- **运行时不用任何模型**：纯播放预生成 wav 文件（`/tts_cosy_it/` 83 条 = Fun-CosyVoice3 生成；`/tts_cosy/` 94 条 = CosyVoice2 旧版回退）
- **播放链**：`speak()` → `speakViaCosy(roleName, text, voiceKey)` → 查 manifest（key = `voice前缀_台词`）→ `playWavAsBlob('/tts_cosy_it/' + filename)`（fetch + blob 强制 `audio/wav` + objectURL + 缓存）
- **降级**：manifest 未命中或 fetch 失败 → `speakViaWebSpeech`（浏览器自带中文语音）
- 语音生成（离线，在 humanoid-robot 的 tts_models 环境）见 `/Users/markus/humanoid-robot/tts_models/README.md`

## 已知注意事项

- 浏览器测试时 `game`/`renderer` 是脚本级变量（不在 `window` 上），只能通过注入 `<script>` + `eval('game')` 访问
- iframe `location.reload()` 可能加载缓存旧版（getState 无 avatar 等），需带 cache-buster 重新加载
- 人类出牌"管不上"时 `handleHumanPlay` 提前 return（不出牌动画），属预期行为
- 小旭音乐 BGM、CosyVoice3（Apache-2.0 系）、IndexTTS-2.5（bilibili 非商用）均为个人学习用途
