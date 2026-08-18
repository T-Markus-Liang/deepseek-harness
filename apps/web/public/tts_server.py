#!/usr/bin/env python3
"""
TTS HTTP Server for 斗地主 game.
Uses edge-tts (Microsoft Neural TTS) for high-quality Chinese voices.
No API key needed - uses Microsoft's free Edge TTS service.
"""
import asyncio
import json
import os
import tempfile
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.parse

try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts not installed. Run: pip install edge-tts")
    exit(1)

VOICES = {
    # 普通话
    'xiaoxiao': 'zh-CN-XiaoxiaoNeural',   # 晓晓 女 亲切温柔
    'xiaoyi': 'zh-CN-XiaoyiNeural',       # 晓伊 女 情感丰富
    'yunjian': 'zh-CN-YunjianNeural',     # 云健 男 沉稳
    'yunxi': 'zh-CN-YunxiNeural',         # 云希 男 阳光少年
    'yunxia': 'zh-CN-YunxiaNeural',       # 云夏 男 少年
    'yunyang': 'zh-CN-YunyangNeural',     # 云扬 男 播音
    # 方言
    'dongbei': 'zh-CN-liaoning-XiaobeiNeural',  # 东北方言 女 晓北
    'shaanxi': 'zh-CN-shaanxi-XiaoniNeural',    # 陕西方言 女 晓妮
    # 粤语
    'yue_m': 'zh-HK-WanLungNeural',       # 粤语 男 云龙
    'yue_f1': 'zh-HK-HiuGaaiNeural',      # 粤语 女 晓佳
    'yue_f2': 'zh-HK-HiuMaanNeural',      # 粤语 女 晓曼
    # 台湾国语
    'tw_f1': 'zh-TW-HsiaoChenNeural',
    'tw_f2': 'zh-TW-HsiaoYuNeural',
    'tw_m': 'zh-TW-YunJheNeural',
}

ROLE_VOICES = {
    '小呆': 'dongbei',   # 东北方言（年轻活泼）
    '老胡': 'shaanxi',   # 陕西方言（沉稳老练）
    '你': 'xiaoxiao',    # 普通话（亲切女声）
}

PORT = 3098
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tts_cache')
os.makedirs(CACHE_DIR, exist_ok=True)


class TTSHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == '/tts':
            self.handle_tts(params)
        elif parsed.path == '/voices':
            self.handle_voices()
        elif parsed.path == '/health':
            self.handle_health()
        else:
            self.send_error(404, 'Not Found')

    def handle_tts(self, params):
        text = params.get('text', [''])[0]
        voice_key = params.get('voice', ['xiaoxiao'])[0]
        voice_name = VOICES.get(voice_key, 'zh-CN-XiaoxiaoNeural')

        if not text:
            self.send_error(400, 'Missing text parameter')
            return

        cache_key = f"{voice_key}_{hash(text)}"
        cache_path = os.path.join(CACHE_DIR, cache_key + '.mp3')

        try:
            if os.path.exists(cache_path):
                with open(cache_path, 'rb') as f:
                    audio_data = f.read()
            else:
                async def generate():
                    communicate = edge_tts.Communicate(text, voice_name)
                    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                        tmp_path = tmp.name
                    await communicate.save(tmp_path)
                    with open(tmp_path, 'rb') as f:
                        data = f.read()
                    os.unlink(tmp_path)
                    with open(cache_path, 'wb') as f:
                        f.write(data)
                    return data

                audio_data = asyncio.run(generate())

            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(audio_data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            self.wfile.write(audio_data)

        except Exception as e:
            self.send_error(500, f'TTS Error: {str(e)}')

    def handle_voices(self):
        voices_info = []
        for key, name in VOICES.items():
            role = '通用'
            for r, v in ROLE_VOICES.items():
                if v == key:
                    role = r
                    break
            voices_info.append({'key': key, 'name': name, 'role': role})

        response = json.dumps({
            'voices': voices_info,
            'default_voice': 'xiaoxiao',
            'role_voices': ROLE_VOICES
        }, ensure_ascii=False)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response.encode('utf-8'))

    def handle_health(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'OK')

    def log_message(self, format, *args):
        pass


def main():
    # 多线程服务器：单个请求异常不会拖垮整个服务
    server = ThreadingHTTPServer(('127.0.0.1', PORT), TTSHandler)
    print(f"[TTS Server] Running on http://127.0.0.1:{PORT}")
    print(f"[TTS Server] Cache dir: {CACHE_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[TTS Server] Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()