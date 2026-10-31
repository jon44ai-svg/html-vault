# Patches

## `deepmerge@4.3.1`

GHSA-gcqx-w48m-w2h4 / CVE-2026-93753 — prototype poisoning via `__proto__` in `mergeObject`. No fixed npm release yet (`first_patched_version: null`).

Patch applies the issue #273 remediation: key denylist, `Object.defineProperty` writes, fail-closed `propertyIsOnObject`.

`pnpm audit` still matches the version range, so `pnpm-workspace.yaml` lists this GHSA under `auditConfig.ignoreGhsas` until an upstream release exists. Do not remove the ignore without removing the patch need.
