import json
import unittest
from pathlib import Path
import tempfile

from tools.binding_discovery.analyze_capture import analyze_capture, mask_secret
from tools.binding_discovery.capture_utils import should_capture_url, should_block_url, sanitize_record


class BindingDiscoveryTests(unittest.TestCase):
    def test_mask_secret_preserves_shape_without_exposing_value(self):
        self.assertEqual(mask_secret("abcdef123456"), "abc***456")
        self.assertEqual(mask_secret("abcd"), "***")
        self.assertEqual(mask_secret(""), "")

    def test_capture_filters_relevant_domains_and_blocks_booking(self):
        self.assertTrue(should_capture_url("https://leosys.cn/cczukaoyan/rest/auth?username=a"))
        self.assertTrue(should_capture_url("http://202.195.100.14/rest/ssoAuth?token=x"))
        self.assertTrue(should_capture_url("http://sso.cczu.edu.cn/sso/login"))
        self.assertFalse(should_capture_url("https://example.com/anything"))
        self.assertTrue(should_block_url("https://leosys.cn/cczukaoyan/rest/v2/freeBook"))
        self.assertFalse(should_block_url("https://leosys.cn/cczukaoyan/rest/auth"))

    def test_sanitize_record_masks_sensitive_headers_query_and_body(self):
        record = {
            "url": "https://leosys.cn/cczukaoyan/rest/auth?username=2300&password=secret-token",
            "request": {
                "headers": {"token": "abcdef123456", "Content-Type": "application/json"},
                "post_data": "password=secret-token&safe=1",
            },
            "response": {
                "body": '{"data":{"token":"abcdef123456","password":"secret-token"}}',
            },
        }

        sanitized = sanitize_record(record)
        text = json.dumps(sanitized, ensure_ascii=False)

        self.assertNotIn("secret-token", text)
        self.assertNotIn("abcdef123456", text)
        self.assertIn("abc***456", text)
        self.assertIn("password=***", sanitized["url"])

    def test_analyze_capture_extracts_key_findings_without_secrets(self):
        records = [
            {
                "url": "https://leosys.cn/cczukaoyan/rest/auth?username=2300&password=***",
                "method": "GET",
                "response": {"status": 200, "body": '{"status":"success","data":{"token":"abc***456"}}'},
            },
            {
                "url": "https://leosys.cn/static/interface/cg/operate/actCodeBind",
                "method": "POST",
                "response": {"status": 200, "body": '{"status":"success"}'},
            },
        ]

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "capture.json"
            path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
            report = analyze_capture(path)

        self.assertTrue(report["auth_request_found"])
        self.assertTrue(report["act_code_bind_found"])
        self.assertEqual(report["free_book_requests"], 0)
        self.assertNotIn("secret", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
