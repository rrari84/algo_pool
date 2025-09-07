
from algosdk.v2client import algod
from algosdk import mnemonic, account
from algosdk.transaction import *
import time, json, sys

ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""
HEADERS = {}

ADMIN_MN = "x"  # <-- paste your ADMIN mnemonic here
TRADER_MN = "x" # <-- paste your TRADER mnemonic here

TOTAL = 10_000_000_000  # 10B units
DECIMALS = 0            # whole units for simplicity
MIN_BALANCE_REQUIRED = 2_000_000  # 2 Algos (microalgos) safety threshold

def wait_for_confirmation(client, txid, timeout_rounds=30):
    """
    Wait for transaction confirmation with detailed pool-error reporting.
    """
    last_round = client.status().get("last-round")
    current_round = last_round
    for _ in range(timeout_rounds):
        try:
            pending = client.pending_transaction_info(txid)
            # If transaction confirmed:
            if pending.get("confirmed-round", 0) > 0:
                return pending
            # If there is a pool error, surface it immediately:
            pe = pending.get("pool-error")
            if pe:
                raise Exception(f"Pool error: {pe}")
        except Exception as e:
            # Some nodes return 404 for a bit; brief sleep and continue
            time.sleep(1)
        # advance to next round
        client.status_after_block(current_round + 1)
        current_round += 1
    raise TimeoutError(f"Transaction {txid} not found or not confirmed after {timeout_rounds} rounds.")

def acct_from_mn(mn):
    sk = mnemonic.to_private_key(mn)
    addr = account.address_from_private_key(sk)
    return addr, sk

def microalgos(amount_algo):
    return int(amount_algo * 1_000_000)

def ensure_optin(c, addr, sk, asset_id):
    acct = c.account_info(addr)
    if any(a.get("asset-id") == asset_id for a in acct.get("assets", [])):
        return
    sp = c.suggested_params()
    txn = AssetTransferTxn(addr, sp, addr, 0, asset_id)
    stx = txn.sign(sk)
    txid = c.send_transaction(stx)
    wait_for_confirmation(c, txid)

def check_balance_or_exit(c, addr, label):
    info = c.account_info(addr)
    bal = info.get("amount", 0)
    print(f"{label} balance: {bal/1_000_000:.6f} ALGO")
    if bal < MIN_BALANCE_REQUIRED:
        print(f"Insufficient balance in {label}. Please fund at least {MIN_BALANCE_REQUIRED/1_000_000} ALGO from the TestNet faucet and retry.")
        sys.exit(1)

def create_asa(c, sender_addr, sender_sk, unit, name):
    sp = c.suggested_params()
    txn = AssetConfigTxn(
        sender=sender_addr,
        sp=sp,
        total=TOTAL,
        default_frozen=False,
        unit_name=unit,
        asset_name=name,
        manager=sender_addr,
        reserve=sender_addr,
        freeze=sender_addr,
        clawback=sender_addr,
        decimals=DECIMALS
    )
    stx = txn.sign(sender_sk)
    txid = c.send_transaction(stx)
    print(f"Submitted {name} create txid: {txid}")
    res = wait_for_confirmation(c, txid)
    asset_id = res.get("asset-index")
    if not asset_id:
        print("ERROR: no asset-index in pending info:", res, file=sys.stderr)
        sys.exit(1)
    print(f"Created {name} (unit {unit}) with ASA ID {asset_id}")
    return asset_id

def main():
    if not ADMIN_MN or not TRADER_MN:
        raise SystemExit("Fill ADMIN_MN and TRADER_MN first.")
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS, headers=HEADERS)
    admin_addr, admin_sk = acct_from_mn(ADMIN_MN)
    trader_addr, trader_sk = acct_from_mn(TRADER_MN)
    print("Admin:", admin_addr)
    print("Trader:", trader_addr)

    # Basic connectivity
    st = client.status()
    print(f"Connected. Last round: {st.get('last-round')}")

    # Check funding
    check_balance_or_exit(client, admin_addr, "ADMIN")
    check_balance_or_exit(client, trader_addr, "TRADER")

    # Create ASAs sequentially
    a_id = create_asa(client, admin_addr, admin_sk, "TOKA", "TokenA")
    b_id = create_asa(client, admin_addr, admin_sk, "TOKB", "TokenB")
    r_id = create_asa(client, admin_addr, admin_sk, "REWD", "Reward")

    # Opt trader in and fund
    for aid in (a_id, b_id, r_id):
        ensure_optin(client, trader_addr, trader_sk, aid)
        sp = client.suggested_params()
        pay = AssetTransferTxn(admin_addr, sp, trader_addr, 1_000_000, aid)
        stx = pay.sign(admin_sk)
        txid = client.send_transaction(stx)
        wait_for_confirmation(client, txid)
        print(f"Funded TRADER with 1,000,000 units of ASA {aid}")

    print("ASSET_A_ID:", a_id)
    print("ASSET_B_ID:", b_id)
    print("REWARD_ASSET_ID:", r_id)
    print(json.dumps({"ASSET_A_ID": a_id, "ASSET_B_ID": b_id, "REWARD_ASSET_ID": r_id}, indent=2))

if __name__ == "__main__":
    main()
