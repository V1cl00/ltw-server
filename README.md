# ltw-server

Authoritative 1v1 PvP server for the Line Tower Wars browser game (client: V1cl00/ltw).
Node.js + `ws`. The server runs the shared `game.js` simulation (20 Hz) and sends state snapshots to both clients at 10/s.
Clients send only inputs. The server validates every input (gold, cooldowns, unlocks, race, cell bounds, path not blocked, tower ownership) and rate-limits it.

## Deploy on Render (free web service)
- New → Web Service → connect `V1cl00/ltw-server`
- Runtime: Node · Branch: main · Root dir: (empty)
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/`
- Instance type: Free. Render sets `PORT` for you.

Optional env vars: `PICK_S` (race pick seconds, default 20), `RECONNECT_S` (default 30). `SIM_SPEED` is for tests only.

## Protocol (JSON over WebSocket)
C→S: `hello{token?,name}`, `queue`, `leaveQueue`, `create`, `join{code}`, `race{race}`, `cmd{seq,c:{op,...}}`, `rematch`, `leave`, `ping`
S→C: `welcome{token,resumed}`, `queued`, `room{code}`, `match{you,phase,pickLeft,code,opp}`, `phase`, `state{s,ev}`, `ack{seq,ok,err}`,
`oppDisconnected{left}`, `oppReconnected`, `oppLeft`, `rematchReq`, `over{result,reason}`, `error{msg}`

Command ops are the same as `command()` in game.js: build, buildMany, upgrade, sell, target, send, worker, mineUp, pickMaster, placeMaster, masterUp, heroMove, heroAbility, buyRune, dropRune, slotRune.
State is always sent from the receiving player's perspective: their own lane is index 0.

## Test
`npm test` starts a server and two headless WebSocket clients. They play a match and the test checks validation, rate limiting, reconnect, forfeit, rematch and quick match.

`game.js` and `net.js` are copied from the client. Keep them in sync.
