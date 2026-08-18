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
# 同时输出到 public（源码持久化）和 dist（服务器实际服务目录）
OUT_DIRS = [
    '/Users/markus/humanoid-robot/deepseek-harness-src/apps/web/public/tts_cosy',
    '/Users/markus/humanoid-robot/deepseek-harness-src/apps/web/dist/tts_cosy',
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
LINES = {
    '小呆': {
        'voice': 'xiaodai', 'dialect': 'dongbei',
        'single': ['哎呀妈呀，小牌！', '贼拉带劲！', '这单张你接得住不？',
                   ('走一张，巴适！', 'sichuan')],
        'pair': ['对子走你！', '成双成对的！'],
        'triple': ['三条！', '仨！'],
        'tripleOne': ['三带一！', '仨带个跟班的！'],
        'tripleTwo': ['三带二！', '三拖俩！'],
        'straight': ['老顺子了！', '这顺子溜得很！'],
        'doubleStraight': ['连对！', '成双成对走起！'],
        'plane': ['飞机起飞咯！', '呜嗷飞过去！'],
        'planeSingle': ['灰机带翅膀！'],
        'planePair': ['灰机带双！'],
        'bomb': ['看我东北大炮！', '炸你没商量！', '轰隆！',
                 ('冇问题，我炸你！', 'yue'), ('巴适得很，炸咯！', 'sichuan')],
        'rocket': ['王炸，这局稳了！', '妥妥的！', ('王炸！冇得商量！', 'yue')],
        'pass': ['要不起！', '你厉害，服了！', '这可咋整！',
                 ('莫得办法！', 'sichuan'), ('过，唔该！', 'yue')],
        'bid': ['这牌必须叫！', '老铁们，看我的！'],
        'noBid': ['这牌不大行', '俺先不掺和'],
        'win': ['哎呀真带劲！', '东北人打牌就是利索！', ('赢咯赢咯，巴适！', 'sichuan')],
        'lose': ['下把翻盘！', '运气背啊！', ('唔系挂，输咗！', 'yue')],
    },
    '老胡': {
        'voice': 'laohu', 'dialect': 'shaanxi',
        'single': ['额滴神，小牌！', '美滴很！', '这单张你能管住？',
                   ('走一张，巴适！', 'sichuan')],
        'pair': ['成对咧！', '对子走！'],
        'triple': ['三条！', '仨！'],
        'tripleOne': ['三带一！', '仨带一！'],
        'tripleTwo': ['三带二！', '仨带俩！'],
        'straight': ['连上咧！', '这顺子美滴很！'],
        'doubleStraight': ['连对！', '对子连上咧！'],
        'plane': ['飞咯！', '呜地飞走！'],
        'planeSingle': ['飞带一！'],
        'planePair': ['飞带二！'],
        'bomb': ['看额滴炸！', '么麻达，炸了！', '这一炸够劲！',
                 ('安逸惨了，炸！', 'sichuan')],
        'rocket': ['王炸，额赢定咧！', '么麻达！'],
        'pass': ['额先过！', '么办法！', '好牌都在你手里！',
                 ('哎呀妈呀，要不起！', 'dongbei')],
        'bid': ['这牌中！', '额当定了！'],
        'noBid': ['这手牌不行', '让给你们！'],
        'win': ['额滴牌就是好！', '美滴很！', ('赢咯，安逸！', 'sichuan')],
        'lose': ['么关系，再来！', '额滴运气不好！'],
    },
    '你': {
        'voice': 'human', 'dialect': 'putonghua',
        'play': ['看我的！', '这把我志在必得！', '接招吧！'],
        'pass': ['要不起！', '先让你一马！'],
        'bid': ['这牌我得拿下！', '当定了！'],
        'noBid': ['这牌不行', '先稳一稳'],
        'win': ['承让承让！', '手气真好！'],
        'lose': ['再来一局！', '这局让给你们！'],
    },
}

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
