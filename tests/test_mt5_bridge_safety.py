import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.fernet import Fernet

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mt5-bridge"))

from mt5_adapter import (  # noqa: E402
    MT5AdapterError,
    _validate_tradeable_symbol,
    _validate_volume,
)
from src.api.mt5_credentials import (  # noqa: E402
    MT5CredentialError,
    decrypt_mt5_password,
    encrypt_mt5_password,
)


class Mt5SafetyTests(unittest.TestCase):
    def test_credentials_are_encrypted_and_plaintext_records_are_rejected(self):
        key = Fernet.generate_key().decode()
        with patch.dict(os.environ, {"MT5_CREDENTIAL_ENCRYPTION_KEY": key}):
            ciphertext = encrypt_mt5_password("not-a-real-password")
            self.assertNotEqual(ciphertext, "not-a-real-password")
            self.assertEqual(
                decrypt_mt5_password(
                    {"api_secret": ciphertext, "api_secret_encrypted": True}
                ),
                "not-a-real-password",
            )
            with self.assertRaises(MT5CredentialError):
                decrypt_mt5_password(
                    {"api_secret": "legacy-plaintext", "api_secret_encrypted": False}
                )

    def test_volume_must_follow_broker_lot_rules(self):
        symbol = SimpleNamespace(volume_min=0.01, volume_max=1.0, volume_step=0.01)
        self.assertEqual(_validate_volume(symbol, 0.03), 0.03)
        with self.assertRaises(MT5AdapterError):
            _validate_volume(symbol, 0.035)
        with self.assertRaises(MT5AdapterError):
            _validate_volume(symbol, 1.01)

    def test_closed_or_disabled_symbols_are_rejected_before_order_send(self):
        mt5 = SimpleNamespace(SYMBOL_TRADE_MODE_DISABLED=0)
        symbol = SimpleNamespace(trade_mode=0)
        tick = SimpleNamespace(bid=100.0, ask=100.1)
        with self.assertRaises(MT5AdapterError):
            _validate_tradeable_symbol(mt5, symbol, tick)

        symbol.trade_mode = 1
        with self.assertRaises(MT5AdapterError):
            _validate_tradeable_symbol(
                mt5, symbol, SimpleNamespace(bid=0.0, ask=0.0)
            )


if __name__ == "__main__":
    unittest.main()