---
name: cavecrew
description: >
  Decision guide for delegating to caveman-style subagents. Tells the main
  thread WHEN to spawn `cavecrew-investigator` (locate code), `cavecrew-builder`
  (1-2 file edit), or `cavecrew-reviewer` (diff review) instead of doing the
  work inline or using vanilla `Explore`. Subagent output is caveman-compressed
  so the tool-result injected back into main context is ~60% smaller — main
  context lasts longer across long sessions.
---

Cavecrew = three subagent presets that emit caveman output. Tool results get injected into main context verbatim. Subagent output is compressed so main context lasts longer across long sessions.

## Output contracts

**`cavecrew-investigator`**
```
<Header>:
- path:line — `symbol` — short note
totals: <counts>.
```

**`cavecrew-builder`**
```
<path:line-range> — <change ≤10 words>.
verified: <re-read OK | mismatch @ path:line>.
```

**`cavecrew-reviewer`**
```
path:line: <emoji> <severity>: <problem>. <fix>.
totals: N🔴 N🟡 N🔵 N❓
```
