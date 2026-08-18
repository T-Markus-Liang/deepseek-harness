# 斗地主 CosyVoice2 方言语音系统

用**阿里通义开源模型 CosyVoice2-0.5B** 为斗地主生成真实方言语音，替代/增强 edge-tts。

## 为什么用 CosyVoice2

- **17 种中文方言指令**：东北话、陕西话、四川话、广东话、上海话、山东话、河南话、湖北话等
- **多种语气指令**：开心、伤心、大声、轻声、快速、慢速
- **音色克隆**：用参考音频定角色音色，方言指令 + 音色 = 真人感
- 本地推理（Apple Silicon，无需联网），无 API 费用
- 比 edge-tts 的方言自然得多（真实腔调而非普通话腔读方言词）

## 目录结构

```
tts_models/
  CosyVoice2-0.5B/          # 模型（5.3GB，ModelScope 下载）
  CosyVoice/                # 官方推理代码（GitHub）
  cosy_env/                 # Python 3.9 虚拟环境
  pregen_cosyvoice.py       # 方言预生成脚本（源）
  test_cosyvoice.py         # 推理自测
apps/web/public/
  tts_cosy/                 # 生成的方言音频 wav + manifest.json（游戏运行时读取）
  cosyvoice/                # 持久化的脚本 + 文档（本目录）
```

## 角色 → 方言映射

| 角色 | 音色 | 主打方言 | 彩蛋方言 |
|------|------|---------|---------|
| 小呆 | 女声音色 | 东北话 | 偶尔粤语/四川话 |
| 老胡 | 男声音色 | 陕西话 | 偶尔四川话/东北话 |
| 你 | 女声音色 | 普通话 | — |

彩蛋台词：角色偶尔"学别人口音"逗乐，活跃气氛。

## 如何运行

```bash
# 1. 启动 edge-tts 兜底服务器（端口 3098）
./apps/web/public/cosyvoice/start_cosyvoice.sh start-tts

# 2. 用 CosyVoice2 预生成方言台词（增量，已生成自动跳过）
./apps/web/public/cosyvoice/start_cosyvoice.sh pregen

# 3. 查看状态
./apps/web/public/cosyvoice/start_cosyvoice.sh status
```

## 游戏语音链路（三层降级）

```
CosyVoice2 预生成方言音频（/tts_cosy/*.wav，最有人情味）
    ↓ manifest 未命中
edge-tts 方言（东北/陕西）
    ↓ 服务器不可用
Web Speech API
```

游戏运行时 **fetch /tts_cosy/manifest.json** → 说话时按 `音色_台词文本` 查 manifest → 命中即播放预生成音频（零延迟），未命中回退 edge-tts。

## 新增台词流程

1. 编辑 `apps/web/public/cosyvoice/pregen_cosyvoice.py` 的 `LINES` 台词表
   - 字符串 = 角色默认方言
   - 元组 `(文本, 'yue')` = 指定方言（彩蛋）
   - 方言 key 见 `DIALECT_INSTRUCT`
2. 同步编辑 `dou-dizhu/js/speech.js` 的 `ROLE_CONFIG`（加对应台词）
3. 运行 `start_cosyvoice.sh pregen` 增量生成
4. 重新构建部署 doudizhu.html 并同步 public/dist

## 更新：IndexTTS-2（B站2025，主引擎）

用户反馈 CosyVoice2 机械感强，已升级到 **IndexTTS-2**（B站 Index 团队 2025 开源，中文自然度 SOTA，支持情感控制）。

### 架构（双引擎分层）
- **IndexTTS-2（优先）** `/tts_cosy_it/`：主打台词，用 CosyVoice2 方言音频作参考音频**克隆方言腔调**（方案A），自然度+方言味兼得。82 条。
- **CosyVoice2（回退）** `/tts_cosy/`：彩蛋方言台词（粤语/四川话腔调明确）。94 条。
- **edge-tts（兜底）**：以上未命中时。

### 技术要点
- 环境：`tts_models/indextts_env`（Python 3.11 + torch 2.8.0，MPS）
- 模型：`tts_models/IndexTTS-2`（5.6GB，ModelScope `IndexTeam/IndexTTS-2`）
- 源码：`tts_models/index-tts`（GitHub 镜像 ghfast.top 克隆）
- 推理：`indextts_env/bin/python pregen_indextts.py`（3-8s/短句，5分钟全量）
- 情感控制：`emo_audio_prompt` 或 `emo_alpha` 情感向量 `[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]`

### 情感升级（IndexTTS-2 emo_vector，高德式语气）

按场景为每条台词分配 8 维情感向量（顺序 `[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]`）：

| 场景 | 情感 | 效果 |
|------|------|------|
| 普通出牌 single/pair/.../play | calm 自信平静 | 干脆利落 |
| 炸弹 bomb | excited 兴奋惊喜 | 轰出去的气势 |
| 王炸 rocket | rocket 更兴奋 | 底气十足 |
| 过牌 pass | pass 无奈平静 | 要不起的服气 |
| 叫地主 bid | bid 自信兴奋 | 志在必得 |
| 不叫 noBid | nobid 平静 | 稳 |
| 赢牌 win | win 开心得意 | 爽快 |
| 输牌 lose | lose 沮丧无奈 | 遗憾 |

重新生成：删除 tts_cosy_it 旧音频 → `start_cosyvoice.sh pregen-indextts`（约 7 分钟）。

### 角色参考音频（IndexTTS-2 方言克隆源）
- 小呆（东北）：CosyVoice2 东北腔「哎呀妈呀，小牌！」
- 老胡（陕西）：CosyVoice2 陕西腔「额滴神，小牌！」
- 你（普通话）：CosyVoice asset 女声

### 新增台词流程
1. 编辑 `public/cosyvoice/lines_table.py`（台词表，字符串=主打/元组=彩蛋）
2. 同步编辑 `dou-dizhu/js/speech.js` ROLE_CONFIG
3. `start_cosyvoice.sh pregen-indextts`（IndexTTS-2 主打）+ `pregen`（CosyVoice2 彩蛋）
4. 重新构建部署 doudizhu.html 并同步 public/dist

## 已生成音频

IndexTTS-2 主打 82 条（方案A方言克隆）+ CosyVoice2 彩蛋 94 条（粤语/四川），manifest 与 wav 在 public 与 dist 双目录同步。

> 版权提示：BGM 为小旭音乐《欢乐斗地主-游戏中1》，仅个人学习使用，不用于分发。
