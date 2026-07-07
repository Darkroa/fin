- [FINAI.md](FINAI.md) — full project-level architecture, tech stack, bot params, UI layout, API endpoints. Update here after any major feature change.

- [AI hub keymodel](FINAI.md) — `src/utils/keymodel.py` is the single source for all 8 AI providers; `llm.py` is a shim; all modules must import from keymodel.

- [BotsPage trade log split](FINAI.md) — FinBot trades filtered by excluding `'fineventai'` in reason field; FinEvent trades shown in separate FinEventAI Trade Log card at bottom.

- [TradeLog DB columns](FINAI.md) — Added `is_event_bot` BOOLEAN, `take_profit` FLOAT, `stop_loss` FLOAT via startup migrations in main.py.

- [FinBot num_trades behavior](FINAI.md) — Bot does NOT stop when trade limit is reached; it blocks new opens (via `at_trade_limit` flag) but stays running. Use `completed_trades >= num_trades` to check. `execution_cooldown` seconds must elapse after each close before re-entering. Same pattern used in FinEvent.

- [FinBot execution_cooldown](FINAI.md) — `execution_cooldown` (seconds) gates re-entry after each trade close via `last_close_time`. Passed from frontend handleStart → routes.py StartBot model → UserBotManager.start_bot → TradingBotInstance. Default 40s.

- [FinEvent price chart](FINAI.md) — `_price_history` dict in FinEventBot tracks prices per ticker in `_loop` every 30s. Exposed as `price_chart` + `entry_markers` + `exit_markers` inside each `open_positions[ticker]` dict in `get_status`. Frontend uses BotPriceChart component with a fake bot object.

- [FinEvent opened_trades](FINAI.md) — `opened_trades` counts position opens (not closes); `completed_trades` counts closes. Trade limit gate checks `opened_trades >= num_trades`. Both exposed in `get_status` along with `trade_limit_reached`.

- [Tailwind CSS layer rule](FINAI.md) — All CSS resets must live inside `@layer base`; never write bare resets outside a layer or they silently override Tailwind utilities.
