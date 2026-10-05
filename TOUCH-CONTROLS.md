# Shared touch joystick controls

Movement modes load `touch-joystick.css` and `touch-joystick.js` before their browser controller. No game-engine physics or desktop key bindings are replaced. Pixel Blocks intentionally does not load this adapter.

Touch capability uses `navigator.maxTouchPoints` and `any-pointer: coarse`, covering phones, tablets and hybrid touch computers. Controls are outside the game canvas; fullscreen reserves a separate bottom control area. Safe-area insets, orientation changes, pointer capture, cancellation, visibility changes and pause overlays reset the stick.

Phones use a 112 px pad (88 px in short landscape); tablets use 144 px pads and larger action buttons. Action buttons retain independent pointers so movement and attacks can be held together. Horizontal modes keep Jump and Guard separate. Grid/four-direction modes snap to their existing permitted axes. Badminton reads continuous normalized axes with a 25% radial dead zone for 360 degree input.

## Adding future modes

1. Load both shared files. Use an existing `.touch` container, or `data-joystick="horizontal"`, `data-joystick="four"`, or `data-joystick="free"` on the control container.
2. Keep movement buttons with `data-key` codes (W/A/S/D) and dedicated action buttons. The adapter hides only the replaced movement buttons and groups action buttons on the right. Existing Adventure uses arrow codes; Badminton uses `data-bd-key`; Island uses `data-code`.
3. Bind joystick direction transitions inside the browser controller through `ArcadeJoystick.bind(press, release)`, feeding that controller's existing input state. For free movement, consume `ArcadeJoystick.axes` (`x`, `y`, `active`) directly, falling back to keyboard input when inactive. The radius is clamped and axes are continuous.
4. Add mobile and tablet real-pointer movement, release, multitouch, cancellation and fullscreen tests. Run `npm run check-touch` for the current integration coverage.

This controls 1P; local 2P retains its existing keyboard controls. Validation uses Chromium touch-device emulation, not physical iOS/Android hardware.
