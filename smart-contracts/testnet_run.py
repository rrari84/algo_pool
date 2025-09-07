from algosdk.v2client import algod
from algosdk import mnemonic, account
from algosdk.transaction import *
from algosdk.logic import get_application_address
import base64, pathlib, json, math, random

ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""
HEADERS = {}

# === Your mnemonics ===
# It's just faster to test this way
ADMIN_MN = "x"
TRADER_MN = "x"

# === Assets ===
ASSET_A_ID = 0
ASSET_B_ID = 0
REWARD_ASSET_ID = 0  # optional/unused by core AMM

# === Demo swap params (kept for compatibility) ===
SWAP_IN_ASSET = ASSET_A_ID
SWAP_IN_AMT = 50

# === Bell-curve config ===
# Fast way to create random ticks and spreads
BELL_ENABLE = True          # True = mint across a Gaussian distribution
BELL_CENTER = 0             # signed center tick
BELL_RADIUS = 3             # ticks from center (e.g., -3..+3)
BELL_STDDEV = 1.0           # bell width
BELL_PEAK_A = 1000          # peak A at center before randomness
BELL_PEAK_B = 500           # peak B at center before randomness
BELL_JITTER = 0.35          # ±35% randomness around curve

# === Slot encoding (map signed ticks to uint64 ids for boxes/app args) ===
SLOT_BASE = 10_000  # keeps all encoded slots >= 0

METHOD_OPTIN = b"opt_in_assets"

def wait_for_confirmation(client, txid, timeout_rounds=60):
    last_round = client.status().get("last-round")
    for _ in range(timeout_rounds):
        try:
            pt = client.pending_transaction_info(txid)
            if pt.get("confirmed-round", 0) > 0:
                return pt
            pe = pt.get("pool-error")
            if pe:
                raise Exception(f"Pool error: {pe}")
        except Exception:
            pass
        client.status_after_block(last_round + 1)
        last_round += 1
    raise TimeoutError(f"tx {txid} not confirmed after {timeout_rounds} rounds")

def acct_from_mn(mn):
    sk = mnemonic.to_private_key(mn)
    addr = account.address_from_private_key(sk)
    return addr, sk

def teal(path):
    return pathlib.Path(path).read_text()

def compile_teal(client, src: str):
    r = client.compile(src)
    return base64.b64decode(r["result"])

def ensure_asset_optin(c, addr, sk, asset_id):
    acct = c.account_info(addr)
    if any(a["asset-id"] == asset_id for a in acct.get("assets", [])):
        return
    sp = c.suggested_params(); sp.flat_fee = True; sp.fee = 2000
    txn = AssetTransferTxn(addr, sp, addr, 0, asset_id)
    stx = txn.sign(sk)
    txid = c.send_transaction(stx)
    wait_for_confirmation(c, txid)

def ensure_min_balance(c, funder_addr, funder_sk, target_addr, target_min_micro):
    info = c.account_info(target_addr)
    bal = info["amount"]
    if bal >= target_min_micro:
        return
    need = (target_min_micro - bal) + 300_000
    sp = c.suggested_params(); sp.flat_fee = True; sp.fee = 2000
    pay = PaymentTxn(funder_addr, sp, target_addr, need)
    stx = pay.sign(funder_sk)
    txid = c.send_transaction(stx)
    wait_for_confirmation(c, txid)

def encode_slot(slot_signed: int) -> int:
    """Map signed slot (-N..+N) -> uint64 id used on-chain."""
    return SLOT_BASE + slot_signed

def slot_box_name_from_signed(slot_signed: int) -> bytes:
    slot_u64 = encode_slot(slot_signed)
    return b"slot:" + slot_u64.to_bytes(8, "big")

def gaussian_weight(slot_signed, center_signed, stddev):
    d = abs(slot_signed - center_signed)
    return math.exp(- (d*d) / (2.0 * stddev * stddev))

def mint_into_signed_slot(client, trader_addr, trader_sk, pool_app_id, pool_addr, slot_signed, amt_a, amt_b):
    if amt_a <= 0 and amt_b <= 0:
        return None
    slot_u64 = encode_slot(slot_signed)
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 4000
    app_call = ApplicationNoOpTxn(
        trader_addr, sp, pool_app_id,
        app_args=[b"mint", slot_u64.to_bytes(8,"big")],
        foreign_assets=[ASSET_A_ID, ASSET_B_ID],
        boxes=[(pool_app_id, slot_box_name_from_signed(slot_signed))]
    )
    axfer_a = AssetTransferTxn(trader_addr, sp, pool_addr, int(amt_a), ASSET_A_ID)
    axfer_b = AssetTransferTxn(trader_addr, sp, pool_addr, int(amt_b), ASSET_B_ID)
    gid = calculate_group_id([app_call, axfer_a, axfer_b])
    for t in (app_call, axfer_a, axfer_b):
        t.group = gid
    stx = app_call.sign(trader_sk)
    stx_a = axfer_a.sign(trader_sk)
    stx_b = axfer_b.sign(trader_sk)
    txid = client.send_transactions([stx, stx_a, stx_b])
    return wait_for_confirmation(client, txid)

def main():
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS, headers=HEADERS)
    admin_addr, admin_sk = acct_from_mn(ADMIN_MN)
    trader_addr, trader_sk = acct_from_mn(TRADER_MN)

    print("Admin:", admin_addr)
    print("Trader:", trader_addr)

    # Compile TEAL (expects these files in the current working dir)
    hook_approval = compile_teal(client, teal("hook_approval.teal"))
    hook_clear    = compile_teal(client, teal("hook_clear.teal"))
    pool_approval = compile_teal(client, teal("pool_approval_v3.teal"))
    pool_clear    = compile_teal(client, teal("pool_clear.teal"))

    # 1) Create HOOK app
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 2000
    global_schema = StateSchema(num_uints=8, num_byte_slices=8)
    local_schema  = StateSchema(num_uints=0, num_byte_slices=0)
    txn = ApplicationCreateTxn(
        sender=admin_addr, sp=sp, on_complete=OnComplete.NoOpOC.real,
        approval_program=hook_approval, clear_program=hook_clear,
        global_schema=global_schema, local_schema=local_schema
    )
    stx = txn.sign(admin_sk)
    txid = client.send_transaction(stx)
    print("HOOK create txid:", txid)
    res = wait_for_confirmation(client, txid)
    hook_app_id = res["application-index"]
    print("Hook App ID:", hook_app_id)

    # 2) Create POOL app (v3-lite)
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 2000
    foreign_assets = [a for a in (ASSET_A_ID, ASSET_B_ID, REWARD_ASSET_ID) if a]
    txn = ApplicationCreateTxn(
        sender=admin_addr, sp=sp, on_complete=OnComplete.NoOpOC.real,
        approval_program=pool_approval, clear_program=pool_clear,
        global_schema=global_schema, local_schema=local_schema,
        foreign_assets=foreign_assets, foreign_apps=[hook_app_id]
    )
    stx = txn.sign(admin_sk)
    txid = client.send_transaction(stx)
    print("POOL create txid:", txid)
    res = wait_for_confirmation(client, txid)
    pool_app_id = res["application-index"]
    pool_addr = get_application_address(pool_app_id)
    print("Pool App ID:", pool_app_id)
    print("Pool Addr:", pool_addr)

    # 3) FUND pool address for boxes (bump for multiple slots)
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 2000
    fund_amt = 3_000_000  # 3 ALGO to handle multiple new boxes
    pay = PaymentTxn(sender=admin_addr, sp=sp, receiver=pool_addr, amt=fund_amt)
    stx = pay.sign(admin_sk)
    txid = client.send_transaction(stx)
    print("POOL fund txid:", txid)
    wait_for_confirmation(client, txid)
    print("Funded pool address with 3.0 ALGO")

    # 4) Pool opt-in to A/B via admin method
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 6000
    args = [METHOD_OPTIN, ASSET_A_ID.to_bytes(8, "big"), ASSET_B_ID.to_bytes(8, "big")]
    txn = ApplicationNoOpTxn(
        sender=admin_addr, sp=sp, index=pool_app_id,
        app_args=args, foreign_assets=[ASSET_A_ID, ASSET_B_ID]
    )
    stx = txn.sign(admin_sk)
    txid = client.send_transaction(stx)
    print("POOL opt_in_assets txid:", txid)
    wait_for_confirmation(client, txid)
    print("Pool app address opted-in to ASSET_A and ASSET_B.")

    # 5) Link hook (enable post_swap; protocol fee = 0 bp)
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 2000
    HOOK_MASK   = 2
    P_FEE_BP    = 0
    args = [b"set_hooks",
            hook_app_id.to_bytes(8,"big"),
            HOOK_MASK.to_bytes(8,"big"),
            P_FEE_BP.to_bytes(8,"big")]
    tx = ApplicationNoOpTxn(admin_addr, sp, pool_app_id, app_args=args, foreign_apps=[hook_app_id])
    stx = tx.sign(admin_sk)
    txid = client.send_transaction(stx)
    print("set_hooks txid:", txid)
    wait_for_confirmation(client, txid)
    print("Hook linked via set_hooks.")

    # 6) Ensure TRADER can receive assets
    for aid in (ASSET_A_ID, ASSET_B_ID):
        ensure_asset_optin(client, trader_addr, trader_sk, aid)

    # 7) Bell-curve mint across signed ticks
    if BELL_ENABLE:
        print(f"Minting bell-curve liquidity: center={BELL_CENTER}, radius={BELL_RADIUS}, stddev={BELL_STDDEV}")
        ensure_min_balance(client, admin_addr, admin_sk, pool_addr, target_min_micro=4_500_000)
        for slot_signed in range(BELL_CENTER - BELL_RADIUS, BELL_CENTER + BELL_RADIUS + 1):
            w = gaussian_weight(slot_signed, BELL_CENTER, BELL_STDDEV)
            rand = 1.0 + (random.random()*2*BELL_JITTER - BELL_JITTER)  # [1-J, 1+J]
            amtA = max(0, int(BELL_PEAK_A * w * rand))
            amtB = max(0, int(BELL_PEAK_B * w * rand))
            if amtA == 0 and amtB == 0:
                print(f"Skip slot {slot_signed} (tiny weight)")
                continue
            print(f"Mint slot {slot_signed}: {amtA} A / {amtB} B")
            res = mint_into_signed_slot(client, trader_addr, trader_sk, pool_app_id, pool_addr, slot_signed, amtA, amtB)
            print("  -> confirmed round", res.get("confirmed-round", "-"))
    else:
        # optional seed single slot 0 if you disable bell-curve
        print("Bell curve disabled; skipping multi-slot minting.")

    # 8) Demo swap in the center slot
    sp = client.suggested_params(); sp.flat_fee = True; sp.fee = 3000
    center_u64 = encode_slot(BELL_CENTER)
    box_ref = (pool_app_id, slot_box_name_from_signed(BELL_CENTER))
    swap_call = ApplicationNoOpTxn(
        trader_addr, sp, pool_app_id,
        app_args=[b"swap", center_u64.to_bytes(8, "big")],
        foreign_assets=[ASSET_A_ID, ASSET_B_ID],
        foreign_apps=[hook_app_id],
        boxes=[box_ref]
    )
    swap_in = AssetTransferTxn(trader_addr, sp, pool_addr, SWAP_IN_AMT, SWAP_IN_ASSET)
    gid = calculate_group_id([swap_call, swap_in])
    swap_call.group = gid; swap_in.group = gid
    stx1 = swap_call.sign(trader_sk); stx2 = swap_in.sign(trader_sk)
    txid = client.send_transactions([stx1, stx2])
    print("SWAP(group) txid:", txid)
    res = wait_for_confirmation(client, txid)
    print("Swap executed. Inspect inner txns in explorer:")
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
