import os
from hdwallet import BIP44HDWallet, BIP49HDWallet, BIP84HDWallet
from hdwallet.cryptocurrencies import BitcoinMainnet, EthereumMainnet, TronMainnet


class MultiAssetHDWallet:
    def __init__(self):
        mnemonic_phrase = os.getenv("MASTER_SEED")
        if not mnemonic_phrase:
            raise EnvironmentError("MASTER_SEED environment variable is missing!")
        self.mnemonic = mnemonic_phrase.strip()

    def ping(self) -> dict:
        """Simple health check"""
        try:
            # Test BTC
            w = BIP84HDWallet(cryptocurrency=BitcoinMainnet)
            w.from_mnemonic(mnemonic=self.mnemonic)
            w.clean_derivation()
            w.from_index(84, hardened=True)
            w.from_index(0, hardened=True)
            w.from_index(0, hardened=True)
            w.from_index(0)
            w.from_index(0)
            btc_addr = w.p2wpkh_address()

            # Test ETH
            w2 = BIP44HDWallet(cryptocurrency=EthereumMainnet)
            w2.from_mnemonic(mnemonic=self.mnemonic)
            w2.clean_derivation()
            w2.from_index(44, hardened=True)
            w2.from_index(60, hardened=True)
            w2.from_index(0, hardened=True)
            w2.from_index(0)
            w2.from_index(0)
            eth_addr = w2.address()

            # Test TRX (USDT-TRC20)
            w3 = BIP44HDWallet(cryptocurrency=TronMainnet)
            w3.from_mnemonic(mnemonic=self.mnemonic)
            w3.clean_derivation()
            w3.from_index(44, hardened=True)
            w3.from_index(195, hardened=True)
            w3.from_index(0, hardened=True)
            w3.from_index(0)
            w3.from_index(0)
            trx_addr = w3.address()

            return {
                "status": "OK",
                "message": "Wallet is ready",
                "btc_test": btc_addr[:20] + "...",
                "eth_test": eth_addr[:20] + "...",
                "trx_test": trx_addr[:20] + "..."
            }
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}

    def get_btc_account(self, index: int = 0, bip: int = 84) -> dict:
        if bip == 84:
            w = BIP84HDWallet(cryptocurrency=BitcoinMainnet)
            w.from_mnemonic(mnemonic=self.mnemonic)
            w.clean_derivation()
            w.from_index(84, hardened=True)
            w.from_index(0, hardened=True)
            w.from_index(0, hardened=True)
            w.from_index(0)
            w.from_index(index)
            addr = w.p2wpkh_address()
            sem = "BIP84 (bc1q...)"
        else:
            w = BIP49HDWallet(cryptocurrency=BitcoinMainnet)
            w.from_mnemonic(mnemonic=self.mnemonic)
            w.clean_derivation()
            w.from_index(49, hardened=True)
            w.from_index(0, hardened=True)
            w.from_index(0, hardened=True)
            w.from_index(0)
            w.from_index(index)
            addr = w.p2wpkh_in_p2sh_address()
            sem = "BIP49 (3...)"

        return {
            "asset": "BTC",
            "derivation": sem,
            "address": addr,
            "path": w.path()
        }

    def get_eth_account(self, index: int = 0) -> dict:
        w = BIP44HDWallet(cryptocurrency=EthereumMainnet)
        w.from_mnemonic(mnemonic=self.mnemonic)
        w.clean_derivation()
        w.from_index(44, hardened=True)
        w.from_index(60, hardened=True)
        w.from_index(0, hardened=True)
        w.from_index(0)
        w.from_index(index)

        return {
            "asset": "ETH & USDT (ERC-20)",
            "address": w.address(),
            "path": w.path()
        }

    def get_trx_account(self, index: int = 0) -> dict:
        """Derives a Tron address — use this for USDT-TRC20 deposits."""
        w = BIP44HDWallet(cryptocurrency=TronMainnet)
        w.from_mnemonic(mnemonic=self.mnemonic)
        w.clean_derivation()
        w.from_index(44, hardened=True)
        w.from_index(195, hardened=True)
        w.from_index(0, hardened=True)
        w.from_index(0)
        w.from_index(index)

        return {
            "asset": "USDT (TRC-20) / TRX",
            "address": w.address(),
            "path": w.path()
        }
