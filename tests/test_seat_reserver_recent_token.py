import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import seat_reserver


class SeatReserverRecentTokenTests(unittest.TestCase):
    def make_config(self, env_path: Path, refreshed_at: int, assume_window: int) -> seat_reserver.Config:
        return seat_reserver.Config(
            api_url="https://example.com/freeBook",
            auth_url="https://example.com/auth",
            user_url="https://example.com/user",
            token="token",
            username="user",
            password="pass",
            auto_refresh_token=True,
            persist_refreshed_token=True,
            candidates=[seat_reserver.BookingCandidate(seat_id="197", start_time=840, end_time=1320)],
            max_attempts=1,
            attempt_delay_seconds=1.2,
            request_timeout_seconds=8.0,
            network_retry_attempts=3,
            network_retry_delay_seconds=0.1,
            token_refreshed_at_epoch=refreshed_at,
            assume_fresh_token_seconds=assume_window,
            booking_window_seconds=20.0,
            booking_request_timeout_seconds=3.0,
            hmac_request_key="",
            user_agent="ua",
            referer="ref",
            env_path=env_path,
        )

    def test_ensure_token_skips_validation_when_recently_refreshed(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / ".env"
            config = self.make_config(
                env_path=env_path,
                refreshed_at=int(time.time()) - 30,
                assume_window=180,
            )

            with mock.patch("seat_reserver.token_is_valid", side_effect=AssertionError("should not validate")):
                result = seat_reserver.ensure_token(config)

        self.assertTrue(result)

    def test_refresh_token_persists_new_timestamp(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / ".env"
            env_path.write_text("BOOK_TOKEN=old\n", encoding="utf-8")
            config = self.make_config(env_path=env_path, refreshed_at=0, assume_window=180)

            with mock.patch(
                "seat_reserver.get_json",
                return_value=(200, {"status": "success", "code": "0", "data": {"token": "new-token"}}, ""),
            ):
                with mock.patch("seat_reserver.time.time", return_value=1700000000):
                    result = seat_reserver.refresh_token(config)

            self.assertTrue(result)
            saved = env_path.read_text(encoding="utf-8")
            self.assertIn("BOOK_TOKEN=new-token", saved)
            self.assertIn("BOOK_TOKEN_REFRESHED_AT=1700000000", saved)
            self.assertEqual(config.token_refreshed_at_epoch, 1700000000)


if __name__ == "__main__":
    unittest.main()
