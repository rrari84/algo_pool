# Project README

This repo has two parts:

* **Backend contracts** written in Python/TEAL
* **Frontend React app**

---

## Backend — Algorand Contracts

### Files

* `create_asas.py` — creates two test tokens (ASAs)
* `hook_approval.teal` — TEAL program for the Hook logic (v4-style extension)
* `pool_approval.teal` — TEAL program for the Concentrated Liquidity Pool (v3-style AMM)
* `testnet_run.py` — runs the full flow: deploy apps, seed liquidity, test swaps

### Quick Start

```bash
# Setup environment
python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -U pip py-algorand-sdk python-dotenv pyteal

# 1. Create test assets
python create_asas.py

# 2. Update tokens onto testnet_run.py

# 4. Run full demo
python testnet_run.py
```

### Notes

* Add Algorand node endpoints and account mnemonics in a `.env` file.
* Fund your accounts with TestNet ALGO before running.
* Scripts will output IDs (ASA IDs, Hook ID, Pool ID, Pool address).

---

## Frontend — React App

This project uses [Create React App](https://github.com/facebook/create-react-app).

### Scripts

* `npm start` → runs dev server at [http://localhost:3000](http://localhost:3000)
* `npm test` → launches the test runner
* `npm run build` → builds for production in `build` folder
* `npm run eject` → copies configs locally for full customization (irreversible)

### Learn More

* [React Docs](https://reactjs.org/)
* [CRA Guide](https://facebook.github.io/create-react-app/docs/getting-started)
