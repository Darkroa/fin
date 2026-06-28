import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env file
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=env_path)

from hd_wallet import MultiAssetHDWallet


def run_wallet_test():
    print("--- Multi-Asset HD Wallet Test ---")

    try:
        wallet_manager = MultiAssetHDWallet()

        # === PING / Health Check ===
        print("Running health check...")
        ping_result = wallet_manager.ping()

        print(f"Ping Status: {ping_result['status']}")

        if ping_result['status'] == "OK":
            print(f"Message: {ping_result['message']}")
            print(f"BTC test address: {ping_result['btc_test']}")
            print(f"ETH test address: {ping_result['eth_test']}")
            print(f"TRX test address: {ping_result['trx_test']}")
            print("Test addresses generated successfully ✓")
        else:
            print(f"Error: {ping_result['message']}")
            return

        print("-" * 55)

        # Generate real addresses
        btc = wallet_manager.get_btc_account(index=0, bip=84)
        eth = wallet_manager.get_eth_account(index=0)
        trx = wallet_manager.get_trx_account(index=0)

        print(f"BTC BIP84 Address: {btc['address']}")
        print(f"Path: {btc['path']}\n")

        print(f"ETH Address: {eth['address']}")
        print(f"Path: {eth['path']}\n")

        print(f"TRX / USDT-TRC20 Address: {trx['address']}")
        print(f"Path: {trx['path']}")

    except Exception as e:
        print(f"Execution Error: {e}")


if __name__ == "__main__":
    run_wallet_test()
