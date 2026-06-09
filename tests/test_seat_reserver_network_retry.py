import unittest
from pathlib import Path
from unittest import mock
from urllib import error

import seat_reserver


class FakeResponse:
    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self._body = body.encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class SeatReserverNetworkRetryTests(unittest.TestCase):
    def make_config(self) -> seat_reserver.Config:
        return seat_reserver.Config(
            api_url="https://example.com/freeBook",
            auth_url="https://example.com/auth",
            user_url="https://example.com/user",
            token="token",
            username="user",
            password="pass",
            auto_refresh_token=True,
            persist_refreshed_token=False,
            candidates=[seat_reserver.BookingCandidate(seat_id="197", start_time=840, end_time=1320)],
            max_attempts=1,
            attempt_delay_seconds=1.2,
            request_timeout_seconds=8.0,
            network_retry_attempts=3,
            network_retry_delay_seconds=0.1,
            hmac_request_key="",
            user_agent="ua",
            referer="ref",
            env_path=Path(".env"),
        )

    def test_get_json_retries_transient_urlerror_then_succeeds(self):
        config = self.make_config()
        responses = [
            error.URLError("[Errno -3] Temporary failure in name resolution"),
            FakeResponse(200, '{"status":"success","code":"0","data":{}}'),
        ]

        def fake_urlopen(req, timeout):
            result = responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with mock.patch("seat_reserver.request.urlopen", side_effect=fake_urlopen) as urlopen_mock:
            with mock.patch("seat_reserver.time.sleep") as sleep_mock:
                status_code, payload, raw = seat_reserver.get_json(config, config.user_url)

        self.assertEqual(status_code, 200)
        self.assertTrue(seat_reserver.is_success(payload))
        self.assertEqual(urlopen_mock.call_count, 2)
        sleep_mock.assert_called_once()
        self.assertEqual(raw, '{"status":"success","code":"0","data":{}}')

    def test_book_once_retries_transient_urlerror_then_succeeds(self):
        config = self.make_config()
        candidate = config.candidates[0]
        responses = [
            error.URLError("[Errno -3] Temporary failure in name resolution"),
            FakeResponse(
                200,
                '{"status":"success","code":"0","data":{"receipt":"r1","onDate":"2026年06月09日","begin":"14:00","end":"22:00","location":"seat"}}',
            ),
        ]

        def fake_urlopen(req, timeout):
            result = responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with mock.patch("seat_reserver.request.urlopen", side_effect=fake_urlopen) as urlopen_mock:
            with mock.patch("seat_reserver.time.sleep") as sleep_mock:
                status_code, payload, _raw = seat_reserver.book_once(config, "2026-06-09", candidate)

        self.assertEqual(status_code, 200)
        self.assertTrue(seat_reserver.is_success(payload))
        self.assertEqual(urlopen_mock.call_count, 2)
        sleep_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
