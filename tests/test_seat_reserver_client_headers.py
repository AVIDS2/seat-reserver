import tempfile
import unittest
from pathlib import Path

import seat_reserver


class SeatReserverClientHeadersTests(unittest.TestCase):
    def test_current_client_defaults_and_hmac_header(self):
        config = seat_reserver.Config(
            api_url="https://example.com/freeBook",
            auth_url="https://example.com/auth",
            user_url="https://example.com/user",
            token="token",
            username="user",
            password="pass",
            auto_refresh_token=True,
            persist_refreshed_token=False,
            candidates=[seat_reserver.BookingCandidate(seat_id="197", start_time=1080, end_time=1320)],
            max_attempts=1,
            attempt_delay_seconds=1.2,
            request_timeout_seconds=8.0,
            network_retry_attempts=3,
            network_retry_delay_seconds=0.8,
            token_refreshed_at_epoch=0,
            assume_fresh_token_seconds=180,
            booking_window_seconds=20.0,
            booking_request_timeout_seconds=3.0,
            hmac_request_key="current-key",
            user_agent=seat_reserver.DEFAULT_USER_AGENT,
            referer=seat_reserver.DEFAULT_REFERER,
            env_path=Path(tempfile.gettempdir()) / ".env",
        )

        headers = seat_reserver.request_headers(config)

        self.assertEqual(headers["X-hmac-request-key"], "current-key")
        self.assertIn("/59/page-frame.html", headers["Referer"])
        self.assertIn("UnifiedPCWindowsWechat(0xf2541b37)", headers["User-Agent"])
        self.assertIn("XWEB/20089", headers["User-Agent"])


if __name__ == "__main__":
    unittest.main()
