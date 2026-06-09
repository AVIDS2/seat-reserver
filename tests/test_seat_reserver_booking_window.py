import tempfile
import unittest
from pathlib import Path
from unittest import mock

import seat_reserver


class SeatReserverBookingWindowTests(unittest.TestCase):
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
            candidates=[
                seat_reserver.BookingCandidate(seat_id="197", start_time=840, end_time=1320),
                seat_reserver.BookingCandidate(seat_id="211", start_time=840, end_time=1320),
            ],
            max_attempts=4,
            attempt_delay_seconds=0.1,
            request_timeout_seconds=8.0,
            network_retry_attempts=3,
            network_retry_delay_seconds=0.1,
            token_refreshed_at_epoch=0,
            assume_fresh_token_seconds=180,
            booking_window_seconds=20.0,
            booking_request_timeout_seconds=3.0,
            hmac_request_key="",
            user_agent="ua",
            referer="ref",
            env_path=Path(tempfile.gettempdir()) / ".env",
        )

    def test_run_cycles_candidates_until_success(self):
        config = self.make_config()
        attempted = []
        outcomes = [
            (200, {"status": "fail", "code": "1", "message": "busy"}, '{"status":"fail"}'),
            (200, {"status": "fail", "code": "1", "message": "busy"}, '{"status":"fail"}'),
            (
                200,
                {"status": "success", "code": "0", "data": {"receipt": "ok", "begin": "14:00", "end": "22:00", "location": "seat"}},
                '{"status":"success","code":"0"}',
            ),
        ]

        def fake_book_once(config, date_value, candidate, timeout_seconds=None):
            attempted.append(candidate.seat_id)
            return outcomes.pop(0)

        with mock.patch("seat_reserver.ensure_token", return_value=True):
            with mock.patch("seat_reserver.book_once", side_effect=fake_book_once):
                with mock.patch("seat_reserver.print_result"):
                    with mock.patch("seat_reserver.time.sleep"):
                        result = seat_reserver.run(config, "2026-06-09")

        self.assertEqual(result, 0)
        self.assertEqual(attempted, ["197", "211", "197"])

    def test_run_stops_when_booking_window_is_exceeded(self):
        config = self.make_config()
        config.booking_window_seconds = 1.0
        attempted = []

        def fake_book_once(config, date_value, candidate, timeout_seconds=None):
            attempted.append((candidate.seat_id, timeout_seconds))
            return 0, None, "timeout"

        monotonic_values = iter([0.0, 0.0, 0.1, 0.95, 1.1])

        with mock.patch("seat_reserver.ensure_token", return_value=True):
            with mock.patch("seat_reserver.book_once", side_effect=fake_book_once):
                with mock.patch("seat_reserver.print_result"):
                    with mock.patch("seat_reserver.time.sleep"):
                        with mock.patch("seat_reserver.time.monotonic", side_effect=lambda: next(monotonic_values)):
                            result = seat_reserver.run(config, "2026-06-09")

        self.assertEqual(result, 1)
        self.assertEqual(len(attempted), 1)
        self.assertLessEqual(attempted[0][1], 1.0)


if __name__ == "__main__":
    unittest.main()
