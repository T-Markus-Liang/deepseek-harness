#!/usr/bin/env python3
"""CosyVoice2-0.5B 方言台词预生成器
将斗地主方言台词用 CosyVoice2 instruct 方言指令批量生成为 wav 音频，
输出到 web public 目录，游戏运行时直接播放（零延迟）。
"""
import os, sys, time, json, hashlib
sys.path.append('/Users/markus/humanoid-robot/tts_models/CosyVoice/third_party/Matcha-TTS')
sys.path.insert(0, '/Users/markus/humanoid-robot/tts_models/CosyVoice')

import torch, torchaudio
from cosyvoice.cli.cosyvoice import CosyVoice2

MODEL_DIR = '/Users/markus/humanoid-robot/tts_models/CosyVoice2-0.5B'
ASSET = '/Users/markus/humanoid-robot/tts_models/CosyVoice/asset'
# 持久产物目录（dou-dizhu/tts_assets 作为唯一源头，部署时同步到服务器）
OUT_DIRS = [
    '/Users/markus/humanoid-robot/dou-dizhu/tts_assets/tts_cosy',
]

# 方言指令映射（CosyVoice2 支持 17 种方言 + 语气）
DIALECT_INSTRUCT = {
    'dongbei': 'You are a helpful assistant. 请用东北话表达。<|endofprompt|>',
    'shaanxi': 'You are a helpful assistant. 请用陕西话表达。<|endofprompt|>',
    'sichuan': 'You are a helpful assistant. 请用四川话表达。<|endofprompt|>',
    'yue': 'You are a helpful assistant. 请用广东话表达。<|endofprompt|>',
    'putonghua': 'You are a helpful assistant. 请用普通话表达。<|endofprompt|>',
}

# 音色参考（不同角色用不同音色区分）
VOICE_PROMPTS = {
    'xiaodai': os.path.join(ASSET, 'zero_shot_prompt.wav'),      # 小呆音色
    'laohu': os.path.join(ASSET, 'cross_lingual_prompt.wav'),    # 老胡音色
    'human': os.path.join(ASSET, 'zero_shot_prompt.wav'),        # 你（人类）音色
}

# 台词表（与 speech.js ROLE_CONFIG 保持一致，方言文本 + CosyVoice 方言腔调双重强化）
# 条目格式：字符串 = 用角色默认方言；元组 (text, dialect) = 指定方言（彩蛋台词）
from lines_table import LINES


def main(test_only=False):
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
    print('加载 CosyVoice2-0.5B...')
    model = CosyVoice2(model_dir=MODEL_DIR, load_jit=False)
    print('模型加载完成, 采样率', model.sample_rate)

    manifest = {}
    total = 0
    t_start = time.time()
    for role, cfg in LINES.items():
        prompt_wav = VOICE_PROMPTS[cfg['voice']]
        for scene, texts in cfg.items():
            if scene in ('voice', 'dialect'):
                continue
            for entry in texts:
                # 元组 (text, dialect) 指定方言；字符串用角色默认方言
                if isinstance(entry, tuple):
                    text, dialect_ov = entry
                else:
                    text, dialect_ov = entry, None
                instruct = DIALECT_INSTRUCT[dialect_ov or cfg['dialect']]
                total += 1
                if test_only and total > 6:
                    continue
                key = f"{cfg['voice']}_{text}"
                fname = hashlib.md5(key.encode('utf-8')).hexdigest()[:12] + '.wav'
                # 任一目录已存在则跳过
                if any(os.path.exists(os.path.join(d, fname)) for d in OUT_DIRS):
                    manifest[key] = '/tts_cosy/' + fname
                    continue
                try:
                    t0 = time.time()
                    for i, j in enumerate(model.inference_instruct2(
                            text, instruct, prompt_wav, stream=False)):
                        for d in OUT_DIRS:
                            torchaudio.save(os.path.join(d, fname), j['tts_speech'], model.sample_rate)
                    dt = time.time() - t0
                    manifest[key] = '/tts_cosy/' + fname
                    print(f"[OK] {role}/{scene}: {text} ({dt:.1f}s, {dialect_ov or cfg['dialect']}) -> {fname}")
                except Exception as e:
                    print(f"[FAIL] {role}/{scene}: {text}: {e}")
                # 保存进度（双目录）
                for d in OUT_DIRS:
                    with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
                        json.dump(manifest, f, ensure_ascii=False, indent=1)

    for d in OUT_DIRS:
        with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"\n完成: {len(manifest)}/{total} 条, 总耗时 {(time.time()-t_start)/60:.1f} 分钟")
    print(f"输出目录: {OUT_DIRS}")

if __name__ == '__main__':
    test_only = '--test' in sys.argv
    main(test_only=test_only)
