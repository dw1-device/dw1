#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DW1 暴龍機 實時連線小程式（RetroArch → 網頁）
適用：數碼暴龍世界（PS1 日版 Rev 1，SLPS-01797），RetroArch + Beetle PSX / SwanStation 核心。

用法：
  1. RetroArch：設定 → 網絡 → 網絡指令 開啟（連接埠 55355）。開始遊戲。
  2. 終端機： python3 dw1_bridge.py
  3. 瀏覽器開 http://127.0.0.1:55356/ （同一資料夾內的 index.html 會在這裏顯示），網頁會自動連線。
  加 --lan：同一個 Wi-Fi 的 iPad／手機也可以開，位址會顯示在終端機。
只用 Python 內建模組，不會連接互聯網。只讀取遊戲記憶體，不會改動遊戲。
"""
import argparse, json, os, socket, struct, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---- 遊戲記憶體位置（日版 Rev 1）----
A_SPECIES = 0x8016C8B8   # u32 精靈種類
A_STATS   = 0x8016C8F0   # 攻 防 速 智 ... HP上限(+16) MP上限(+18) HP(+20) MP(+22)
A_LEARNED = 0x8016C910   # 16 bytes 已學招式位元
A_LIVES   = 0x8016C934   # u8 生命
A_PARA    = 0x8014274C   # 132 bytes 育成狀態
A_CLOCK   = 0x8013ECB8   # s16 時、s16 分
A_DAY     = 0x8013ED00   # s16 日
A_FLAGPTR = 0x8013EB44   # u32 劇情旗標表指標（旗標 n 在 指標+245+n/8）
A_BAG     = 0x80147760   # 背包：+0 道具編號×30、+30 數量×30、+90 背包格數
A_STORE   = 0x8014787C   # 倉庫（預り屋）：+0 數量×30、+0x20 道具編號×30

class RA:
    """RetroArch 網絡指令（UDP）"""
    def __init__(self, host, port, timeout=0.4):
        self.addr = (host, port); self.timeout = timeout; self.mode = None
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); self.sock.settimeout(timeout)
        self.lock = threading.Lock()
    def _cmd(self, text):
        with self.lock:
            try:
                while True:  # 清掉舊回覆
                    self.sock.setblocking(False); self.sock.recvfrom(65536)
            except (BlockingIOError, OSError):
                pass
            finally:
                self.sock.settimeout(self.timeout)
            self.sock.sendto((text + "\n").encode(), self.addr)
            data, _ = self.sock.recvfrom(65536)
            return data.decode(errors="replace").strip()
    def _raw(self, mode, addr, n):
        if mode == "mem80":   cmd, a = "READ_CORE_MEMORY", addr
        elif mode == "mem00": cmd, a = "READ_CORE_MEMORY", addr & 0x1FFFFF
        else:                 cmd, a = "READ_CORE_RAM", addr & 0x1FFFFF
        out = bytearray(); off = 0
        while off < n:
            k = min(64, n - off)
            r = self._cmd(f"{cmd} {a + off:x} {k}").split()
            if len(r) < 3 or r[0] != cmd or r[2] == "-1":
                raise IOError(" ".join(r[:8]) or "沒有回覆")
            out += bytes(int(x, 16) for x in r[2:2 + k]); off += k
        return bytes(out)
    def read(self, addr, n):
        if self.mode is None: self.detect()
        try:
            return self._raw(self.mode, addr, n)
        except Exception:
            self.mode = None; raise
    def detect(self):
        last = None
        for m in ("mem80", "mem00", "ram"):
            try:
                sp = struct.unpack("<I", self._raw(m, A_SPECIES, 4))[0]
                if 1 <= sp <= 65:
                    self.mode = m; return m
                last = f"{m}: 種類 {sp} 不合理（遊戲可能未開始）"
            except socket.timeout:
                last = "RetroArch 沒有回應：請確認已開啟「網絡指令」、連接埠 55355，並已開始遊戲"
            except Exception as e:
                last = f"{m}: {e}"
        raise IOError(last or "讀取失敗")

def snapshot(ra):
    i16 = lambda b, o: struct.unpack_from("<h", b, o)[0]
    sp = struct.unpack("<I", ra.read(A_SPECIES, 4))[0]
    st = ra.read(A_STATS, 24); P = ra.read(A_PARA, 132); L = ra.read(A_LEARNED, 16)
    lives = ra.read(A_LIVES, 1)[0]; clk = ra.read(A_CLOCK, 4); day = i16(ra.read(A_DAY, 2), 0)
    ptr = struct.unpack("<I", ra.read(A_FLAGPTR, 4))[0]
    recruited, raised = [], []
    if 0x80000000 <= ptr < 0x80200000:
        F = ra.read(ptr + 245, 80)          # 旗標 0～639
        bit = lambda n: bool(F[n >> 3] & (1 << (n & 7)))
        recruited = [i for i in range(1, 66) if bit(200 + i)]
        raised = [i for i in range(1, 66) if bit(512 + i)]
    learned = [i for i in range(58) if L[i >> 3] & (1 << (i & 7))]
    B = ra.read(A_BAG, 91)
    bag = [[B[i], B[30 + i]] for i in range(30) if B[30 + i] > 0]
    W = ra.read(A_STORE, 0x40)
    storage = [[W[0x20 + i], W[i]] for i in range(30) if W[i] > 0]
    return {
        "ok": True, "mode": ra.mode, "t": time.time(), "cur": sp,
        "stats": {"atk": i16(st, 0), "def": i16(st, 2), "spd": i16(st, 4), "int": i16(st, 6),
                  "hp": i16(st, 16), "mp": i16(st, 18)},
        "hpNow": i16(st, 20), "mpNow": i16(st, 22),
        "fat": i16(P, 34), "dis": i16(P, 40), "hap": i16(P, 42), "weight": i16(P, 66),
        "life": i16(P, 72), "days": i16(P, 74), "mis": i16(P, 82), "win": i16(P, 84),
        "age": i16(P, 86), "poop": i16(P, 30), "lives": lives,
        "hh": i16(clk, 0), "mm": i16(clk, 2), "day": day,
        "learned": learned, "recruitedIds": recruited, "raisedIds": raised, "bag": bag, "bagCap": B[90], "storage": storage,
        "para": list(struct.unpack("<66h", P)),   # 原始數值，用來找其他欄位
    }

class Handler(BaseHTTPRequestHandler):
    ra = None; cache = {"t": 0, "data": None}; here = os.path.dirname(os.path.abspath(__file__))
    def log_message(self, *a): pass
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        if self.path.startswith("/state"):
            now = time.time(); c = Handler.cache
            if now - c["t"] > 0.3:
                try:
                    c["data"] = snapshot(Handler.ra)
                except Exception as e:
                    c["data"] = {"ok": False, "error": str(e)}
                c["t"] = now
            body = json.dumps(c["data"], ensure_ascii=False).encode()
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8"); self.end_headers(); self.wfile.write(body); return
        if self.path in ("/", "/index.html") or self.path.startswith("/?"):
            f = os.path.join(Handler.here, "index.html")
            if os.path.exists(f):
                body = open(f, "rb").read(); self.send_response(200); self._cors()
                self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(body); return
            body = "DW1 bridge 運行中。/state 取得數值。（同一資料夾放 index.html 就會在這裏顯示網頁）".encode()
            self.send_response(200); self.send_header("Content-Type", "text/plain; charset=utf-8"); self.end_headers(); self.wfile.write(body); return
        self.send_response(404); self.end_headers()

def lan_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); ips.append(s.getsockname()[0]); s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."): ips.append(ip)
    except Exception:
        pass
    return [ip for ip in ips if not ip.startswith("127.")]

def main():
    ap = argparse.ArgumentParser(description="DW1 暴龍機 RetroArch 實時連線")
    ap.add_argument("--ra-host", default="127.0.0.1"); ap.add_argument("--ra-port", type=int, default=55355)
    ap.add_argument("--port", type=int, default=55356, help="網頁連線用的連接埠")
    ap.add_argument("--test", action="store_true", help="只讀一次並顯示結果")
    ap.add_argument("--lan", action="store_true", help="容許同一個 Wi-Fi 的其他裝置（iPad、手機）開啟網頁")
    a = ap.parse_args()
    Handler.ra = RA(a.ra_host, a.ra_port)
    try:
        s = snapshot(Handler.ra)
        print(f"已連接 RetroArch（讀取方式 {s['mode']}）：種類 {s['cur']}，攻 {s['stats']['atk']}，"
              f"年齡 {s['days']} 歲，時間 {s['hh']:02d}:{s['mm']:02d}")
    except Exception as e:
        print("暫時讀不到遊戲：", e, "\n（小程式會繼續運行，遊戲開始後網頁會自動連上）")
    if a.test: return
    try:
        srv = ThreadingHTTPServer(("0.0.0.0" if a.lan else "127.0.0.1", a.port), Handler)
    except OSError as e:
        print(f"連接埠 {a.port} 已被使用（可能小程式已經在運行）：{e}"); return
    print(f"這部電腦：請用瀏覽器開 http://127.0.0.1:{a.port}/")
    if a.lan:
        ips = lan_ips()
        if ips:
            for ip in ips: print(f"iPad／手機（同一個 Wi-Fi）：用 Safari 開  http://{ip}:{a.port}/")
        else:
            print("找不到這部電腦的區域網絡位址：請到「系統設定 → Wi-Fi → 詳細資料」查看 IP 位址，在 iPad 開 http://該位址:%d/" % a.port)
        print("（如果 Mac 詢問是否允許 Python 接受連入的網絡連線，請按「允許」）")
    print("按 Ctrl+C 結束。")
    try: srv.serve_forever()
    except KeyboardInterrupt: print("\n已結束。")

if __name__ == "__main__":
    main()
