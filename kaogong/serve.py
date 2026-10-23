# -*- coding: utf-8 -*-
"""kaogong 本地静态服务器（8899）。

为什么要单独写这个文件而不是直接 `python -m http.server`：
- Windows 上我们用 pythonw.exe 启动（这样不弹黑窗口），但 pythonw 下
  sys.stdout / sys.stderr 是 None，而 http.server 每处理一个请求都要往
  stderr 写访问日志 -> 抛异常 -> 连接被强制关闭。
  结果：进程看着活着，其实每个请求都失败，浏览器只好拿 Service Worker
  的离线缓存兜底，页面就"停"在好几天前。
- 这里把 log_message / log_error 覆盖成空实现，pythonw 下也能正常服务。

用法：pythonw.exe serve.py   (或双击 serve.bat)
"""
import os
import sys
import traceback
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('KAOGONG_PORT', '8899'))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # pythonw 下 sys.stderr 为 None，默认实现会崩，这里全部吞掉
    def log_message(self, *args):
        pass

    def log_error(self, *args):
        pass


def main():
    httpd = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    httpd.serve_forever()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # 无控制台时把崩溃原因落盘，方便排查
        try:
            with open(os.path.join(ROOT, 'serve.err.log'), 'a', encoding='utf-8') as f:
                f.write(traceback.format_exc() + '\n')
        except Exception:
            pass
        raise
