# 斗地主 CosyVoice3 方言语音系统

用**阿里通义开源模型 Fun-CosyVoice3-0.5B**（instruct2 模式）为斗地主生成真实方言 + 情感语音。

## 为什么用 CosyVoice3

- **方言指令 + 情感指令组合**：`请用东北话/四川话/广东话表达，请非常开心/伤心地说一句话`
  - 真实方言腔调（whisper 验证：搞啥子→"靠傻子"、咗→"走"、瞅你咋整→"仇你砸著"）
- **角色音色**：方言基准音色参考（保真音色），每个角色固定音色
- 对比 IndexTTS-2.5：zero-shot 只克隆音色但发音是普通话（无方言），CosyVoice3 instruct 才能出真方言
- 本地推理（Apple Silicon MPS，10-15s/条），无 API 费用

## 模型状态（2025-08 清理后）

| 项目 | 路径 | 状态 |
|---|---|---|
| Fun-CosyVoice3-0.5B-2512 | `/Users/markus/humanoid-robot/tts_models/` | ✅ 保留（9.1G，唯一在用） |
| cosy_env | `/Users/markus/humanoid-robot/tts_models/` | ✅ 保留（Python 3.9 + torch MPS） |
| IndexTTS-2 / 2.5 | 同上 | ❌ 已删（无方言，被取代） |
| CosyVoice2-0.5B / CosyVoice-300M | 同上 | ❌ 已删（wav 已固化） |

## 角色 → 方言映射

| voice 前缀 | 方言 | 角色 |
|---|---|---|
| `laohu` | 东北话 | 老胡（🧔）/ 德叔 / 大壮 |
| `xiaodai` | 四川话 | 小呆（👩）/ 王阿姨 |
| `human` | 粤语 | 你（👧）/ 阿珍 / 辣妹 / 阿妹 |

游戏运行时 manifest key = `{voice前缀}_{台词文本}`，如 `laohu_来一张！`、`xiaodai_过！`。

## 生成流程

```bash
# 生成脚本（源）：/Users/markus/humanoid-robot/tts_models/pregen_cosyvoice3_lines.py
# 输出：dou-dizhu/tts_assets/tts_cosy_it/（83 条 wav + manifest.json）
cd /Users/markus/humanoid-robot/tts_models
cosy_env/bin/python pregen_cosyvoice3_lines.py

# 同步到服务器（public + dist）
cd /Users/markus/humanoid-robot/dou-dizhu && ./deploy.sh
```

关键配置（脚本内）：
- `MODEL_DIR` = `/Users/markus/humanoid-robot/tts_models/Fun-CosyVoice3-0.5B-2512`
- `MODELSCOPE_CACHE` = `/Users/markus/humanoid-robot/tts_models/mscache`
- 角色基准音色：`/tmp/cv3_test/{dongbei_base,sichuan_base,cantonese_base}.wav`（**注意 /tmp 可能被清理，需重新生成**）

## 游戏语音链路（三层降级）

```
CosyVoice3 预生成方言音频（/tts_cosy_it/*.wav，83 条，最有人情味）
    ↓ manifest 未命中
CosyVoice2 旧版回退（/tts_cosy/*.wav，94 条）
    ↓ 仍未命中 / fetch 失败
Web Speech API（浏览器自带中文语音）
```

游戏运行时 **fetch /tts_cosy_it/manifest.json** → 说话时按 `voice前缀_台词文本` 查 manifest → 命中即播放预生成音频（`playWavAsBlob` 转 objectURL），未命中降级。**运行时不用任何 TTS 模型**。

## 新增台词流程

1. 编辑 `tts_models/lines_table.py`（台词表）+ `dou-dizhu/js/speech.js` 的 `ROLE_CONFIG`
   - 两者文本必须一致（manifest key 匹配）
2. 运行 `pregen_cosyvoice3_lines.py` 增量生成
3. `cd dou-dizhu && ./deploy.sh` 重新构建部署

## 当前音频部署

- `/tts_cosy_it/`：**83 条**（CosyVoice3，前缀 laohu 35 / xiaodai 35 / human 13）
- `/tts_cosy/`：**94 条**（CosyVoice2 旧版，保留作回退）

> 版权提示：BGM 为小旭音乐《欢乐斗地主-游戏中1》，仅个人学习使用，不用于分发。
> CosyVoice3 为 Apache-2.0 系开源；IndexTTS-2.5 曾用（bilibili 非商用），现已删除。
