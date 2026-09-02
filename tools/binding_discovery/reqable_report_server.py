from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from tools.binding_discovery.capture_utils import sanitize_record, should_block_url


DEFAULT_OUTPUT_DIR = Path('tools/binding_discovery/captures')


def har_to_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        entries = payload.get('log', {}).get('entries', [])
    else:
        entries = payload
    if not isinstance(entries, list):
        raise ValueError('Reqable report must be a HAR object or an entries array')

    records: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        request = entry.get('request') or {}
        response = entry.get('response') or {}
        if not isinstance(request, dict) or not isinstance(response, dict):
            continue
        url = str(request.get('url', ''))
        if not url:
            continue
        records.append(
            sanitize_record(
                {
                    'ts': int(time.time() * 1000),
                    'method': request.get('method', 'GET'),
                    'url': url,
                    'request': {
                        'headers': headers_to_dict(request.get('headers')),
                        'post_data': request_body(request.get('postData')),
                    },
                    'response': {
                        'status': response.get('status', 0),
                        'headers': headers_to_dict(response.get('headers')),
                        'body': response_body(response.get('content')),
                    },
                    'free_book_detected': should_block_url(url),
                }
            )
        )
    return records


def headers_to_dict(headers: Any) -> dict[str, str]:
    if isinstance(headers, dict):
        return {str(key): str(value) for key, value in headers.items()}
    if not isinstance(headers, list):
        return {}
    result: dict[str, str] = {}
    for item in headers:
        if isinstance(item, dict) and 'name' in item:
            result[str(item['name'])] = str(item.get('value', ''))
    return result


def request_body(post_data: Any) -> str:
    if not isinstance(post_data, dict):
        return ''
    if isinstance(post_data.get('text'), str):
        return post_data['text']
    params = post_data.get('params')
    return json.dumps(params, ensure_ascii=False) if params else ''


def response_body(content: Any) -> str:
    if not isinstance(content, dict):
        return ''
    text = content.get('text', '')
    return text if isinstance(text, str) else ''


class ReportHandler(BaseHTTPRequestHandler):
    output_dir: Path
    expected_path: str
    stop_after_report: bool

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split('?', 1)[0] != self.expected_path:
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('content-length', '0'))
            if length <= 0 or length > 50 * 1024 * 1024:
                raise ValueError('invalid report size')
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            records = har_to_records(payload)
            self.output_dir.mkdir(parents=True, exist_ok=True)
            output = self.output_dir / f'reqable-{time.strftime("%Y%m%d-%H%M%S")}.json'
            output.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
            blocked = sum(1 for record in records if record.get('free_book_detected'))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'records': len(records), 'blocked': blocked}).encode())
            print(f'已保存脱敏 Reqable 报告：{output}')
            if blocked:
                print('警告：报告中出现 freeBook；该报告只能用于检查，不能作为绑定捕获结果。')
            if self.stop_after_report:
                self.server.shutdown()
        except (ValueError, json.JSONDecodeError) as error:
            self.send_error(400, str(error))

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> int:
    parser = argparse.ArgumentParser(description='Receive and sanitize Reqable HAR reports.')
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8788)
    parser.add_argument('--path', default='/reqable/report')
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument('--once', action='store_true', help='Exit after receiving one report.')
    args = parser.parse_args()

    handler = type('ConfiguredReportHandler', (ReportHandler,), {})
    handler.output_dir = args.output_dir
    handler.expected_path = args.path
    handler.stop_after_report = args.once
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f'Reqable 报告接收器已启动：http://{args.bind}:{args.port}{args.path}')
    print('请在 Reqable Report Server 中填入此地址；只进行登录/绑定，不要提交预约。')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
