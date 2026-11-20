# Native CSS animation freezes during parent exit

Minimal reproduction for a CSS-animated descendant freezing while its parent
runs an `exiting` layout animation. No Expensify code, dependency patches,
network requests, `entering` animation, shared values, or animation callbacks.

## Run

Use Node 22.13+, 24.3+, or 26+, then:

```sh
npm ci
npm run ios
```

Open in Expo Go for SDK 58 with system Reduce Motion disabled. Alternatively,
run `npx expo run:ios` to create a development build. Do not replace the pinned
Reanimated or Worklets versions when using Expo Go: its native modules must
match the JavaScript packages.

Both bars use the same infinite CSS animation, moving `left` between 0% and
75% with a 2-second duration and alternating direction. After 2.5 seconds,
the bottom bar unmounts. Its parent uses `FadeOut.duration(4000)`.

**Expected:** both indicators keep moving until the exiting parent disappears.

**Actual on iOS:** the bottom indicator freezes at its current horizontal
position throughout the parent's fade. The top control continues moving.
Press **Restart reproduction** to repeat.

The delayed unmount is automatic to make the recording reproducible.

## Verified environment

- iPhone 17e simulator, iOS 26.5, macOS
- Expo Go 58.0.7 / Expo SDK 58.0.26
- React Native 0.88.1, React 19.3.0
- Reanimated 4.7.1, Worklets 0.13.0
- Hermes, Fabric, debug app and development bundle
- No custom Reanimated feature flags or dependency patches

## Evidence

[iOS recording](evidence/ios-unpatched.mp4) shows one automatic cycle after a
Metro reload. The first second precedes the reload; the blank/loading frames
are development reload behavior.

Frames sampled at half-second intervals from the recording:

| Recording time | Control left edge | Exiting indicator left edge | Exiting indicator center RGB |
| --- | ---: | ---: | --- |
| 4.5 s | 493 px | 635 px | 22, 146, 83 |
| 5.0 s | 301 px | 635 px | 53, 160, 108 |
| 5.5 s | 109 px | 635 px | 86, 176, 130 |
| 6.0 s | 227 px | 635 px | 117, 191, 155 |
| 6.5 s | 419 px | 635 px | 151, 206, 177 |
| 7.0 s | 611 px | 635 px | 182, 220, 200 |

These are screenshot pixels in a 1170 × 2532 recording, not React Native
layout points. The fixed position and changing color show that only the
descendant's movement stops; the parent's opacity continues to animate.
