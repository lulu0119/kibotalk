---
module: playground
tags: [vite, sherpaw, speaker-diarization]
problem_type: integration-bug
---

# Keep Sherpaw's diarization worker loadable in Vite

## Symptom

The production build succeeds. Opening the speaker tracks in the dev server fails because `picomatch` has no default export.

## Cause

The diarization package creates a module worker using a URL relative to its own entry. Playground excludes that entry from prebundling so Vite can transform the worker URL. The exclusion leaves the CommonJS `picomatch` dependency of `@moeru/eventa` outside prebundling.

## Fix

Keep the diarization package excluded. In `apps/playground/vite.config.ts`, include the nested `@sherpaw/speaker-diarization > @moeru/eventa > picomatch` dependency in `optimizeDeps`.

## Evidence

Chrome loaded the worker and produced two speaker tracks from a two-voice WAV and an AAC MP4. Both files worked in the Vite dev server and the production preview.
