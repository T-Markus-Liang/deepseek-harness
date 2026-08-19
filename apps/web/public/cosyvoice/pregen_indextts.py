#!/usr/bin/env python3
"""IndexTTS-2 方案A+情感升级 全量预生成：方言参考音频克隆腔调 + 场景情感控制（高德式语气）。
- 主打台词（字符串）：IndexTTS-2 + 角色方言参考音频 + emo_vector 场景情感 -> public/dist/tts_cosy_it/
- 彩蛋方言台词（元组）：保留 CosyVoice2 版本（/tts_cosy/，粤语/四川腔明确）
- 情感向量顺序：[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]

用法：先删除旧 tts_cosy_it 再运行（文件名按 key hash，强制重新生成带情感的版本）
"""
import sys, os, time, json, hashlib
sys.path.insert(0, '/Users/markus/humanoid-robot/tts_models/index-tts')
from indextts.infer_v2 import IndexTTS2

# 复用台词表（纯数据文件，无 CosyVoice 依赖）
sys.path.insert(0, '/Users/markus/humanoid-robot/tts_models')
from lines_table import LINES

MODEL_DIR = '/Users/markus/humanoid-robot/tts_models/IndexTTS-2'
# 方言参考音频（重新生成后的持久源在 dou-dizhu/tts_assets）
COSY = '/Users/markus/humanoid-robot/dou-dizhu/tts_assets/tts_cosy'
ASSET = '/Users/markus/humanoid-robot/tts_models/CosyVoice/asset'
# 持久产物目录（先写 dou-dizhu/tts_assets，再同步到服务器目录）
OUT_DIRS = [
    '/Users/markus/humanoid-robot/dou-dizhu/tts_assets/tts_cosy_it',
]

# 角色方言参考音频（IndexTTS-2 用它克隆方言腔调+音色）
ROLE_REF = {
    '小呆': f'{COSY}/3f3efdd58a33.wav',   # CosyVoice2 东北腔「哎呀妈呀，小牌！」
    '老胡': f'{COSY}/771f37d73195.wav',   # CosyVoice2 陕西腔「额滴神，小牌！」
    '你': os.path.join(ASSET, 'zero_shot_prompt.wav'),  # 普通话女声
}

# ===== 场景情感向量（高德式：干脆、有情绪、像真人打牌）=====
# 顺序：[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]
EMO = {
    # 普通出牌：自信 + 平静（稳稳出牌，干脆利落）
    'calm':       [0.35, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.60],
    # 炸弹/王炸：兴奋 + 惊喜（轰出去的气势）
    'excited':    [0.65, 0.05, 0.0, 0.0, 0.0, 0.0, 0.45, 0.10],
    'rocket':     [0.75, 0.0, 0.0, 0.0, 0.0, 0.0, 0.55, 0.05],
    # 过牌：无奈 + 平静（要不起的服气）
    'pass':       [0.10, 0.0, 0.10, 0.0, 0.0, 0.25, 0.0, 0.55],
    # 叫地主：自信 + 兴奋（我要定了）
    'bid':        [0.55, 0.0, 0.0, 0.0, 0.0, 0.0, 0.10, 0.35],
    # 不叫：平静
    'nobid':      [0.10, 0.0, 0.0, 0.0, 0.0, 0.05, 0.0, 0.85],
    # 赢牌：开心 + 得意
    'win':        [0.90, 0.0, 0.0, 0.0, 0.0, 0.0, 0.15, 0.05],
    # 输牌：沮丧 + 无奈
    'lose':       [0.0, 0.0, 0.40, 0.0, 0.0, 0.50, 0.0, 0.25],
}

# 场景键 -> 情感键
SCENE_EMO = {
    'single': 'calm', 'pair': 'calm', 'triple': 'calm',
    'tripleOne': 'calm', 'tripleTwo': 'calm',
    'straight': 'calm', 'doubleStraight': 'calm',
    'plane': 'calm', 'planeSingle': 'calm', 'planePair': 'calm',
    'play': 'calm',
    'bomb': 'excited', 'rocket': 'rocket',
    'pass': 'pass', 'bid': 'bid', 'noBid': 'nobid',
    'win': 'win', 'lose': 'lose',
}
DEFAULT_EMO = 'calm'

def main():
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
    print('加载 IndexTTS2...')
    t0 = time.time()
    tts = IndexTTS2(cfg_path=os.path.join(MODEL_DIR, 'config.yaml'),
                    model_dir=MODEL_DIR, use_fp16=False, use_deepspeed=False)
    print(f'模型加载完成 {time.time()-t0:.1f}s')

    manifest = {}
    total = 0
    t_start = time.time()
    for role, cfg in LINES.items():
        ref = ROLE_REF.get(role)
        if not ref or not os.path.exists(ref):
            print(f'[WARN] 角色 {role} 无参考音频，跳过')
            continue
        voice = cfg['voice']
        for scene, texts in cfg.items():
            if scene in ('voice', 'dialect'):
                continue
            emo_key = SCENE_EMO.get(scene, DEFAULT_EMO)
            emo_vec = EMO[emo_key]
            for entry in texts:
                # 彩蛋方言（元组）保留 CosyVoice2，跳过
                if isinstance(entry, tuple):
                    continue
                text = entry
                total += 1
                key = f"{voice}_{text}"
                fname = hashlib.md5(key.encode('utf-8')).hexdigest()[:12] + '.wav'
                if any(os.path.exists(os.path.join(d, fname)) for d in OUT_DIRS):
                    manifest[key] = '/tts_cosy_it/' + fname
                    continue
                t0 = time.time()
                try:
                    out = os.path.join(OUT_DIRS[0], fname)
                    tts.infer(spk_audio_prompt=ref, text=text, output_path=out,
                              emo_vector=emo_vec, verbose=False)
                    # 复制到其余目录
                    for d in OUT_DIRS[1:]:
                        import shutil; shutil.copy(out, os.path.join(d, fname))
                    dt = time.time() - t0
                    manifest[key] = '/tts_cosy_it/' + fname
                    print(f'[OK] {role}/{scene}: {text} (emo={emo_key}, {dt:.1f}s) -> {fname}')
                except Exception as e:
                    print(f'[FAIL] {role}/{scene}: {text}: {e}')
                for d in OUT_DIRS:
                    with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
                        json.dump(manifest, f, ensure_ascii=False, indent=1)

    for d in OUT_DIRS:
        with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"\nIndexTTS-2 主打台词完成(带情感): {len(manifest)}/{total} 条, 总耗时 {(time.time()-t_start)/60:.1f} 分钟")
    print(f"输出目录: {OUT_DIRS}")

if __name__ == '__main__':
    main()
