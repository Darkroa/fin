---
name: MetaApi provisioning tiers
description: MetaApi infrastructure tier behavior and how to interpret high-reliability credit errors.
---

The MetaApi provisioning request is independent of whether the broker account is
live or demo. `cloud-g2` does not offer regular reliability and defaults to
high reliability, so a “top up your account” response can refer to the MetaApi
workspace credit rather than the FBS trading account.

**Why:** FBS live and demo attempts returned the same high-reliability message
before any account-specific distinction could be useful.

**How to apply:** Keep `cloud-g2`/high as the production default. For a
supported test workspace, explicitly configure `cloud-g1` with
`METAAPI_RELIABILITY=regular`; never silently downgrade production
infrastructure or repeatedly retry an ineligible workspace.