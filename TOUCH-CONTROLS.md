# Shared touch joystick controls

Movement modes load `touch-joystick.css` and `touch-joystick.js` before their browser controller. No game-engine physics or desktop key bindings are replaced. Pixel Blocks intentionally does not load this adapter.

Touch capability uses `navigator.maxTouchPoints` and `any-pointer: coarse`, covering phones, tablets and hybrid touch computers. Controls overlay the visible canvas at its lower left and lower right corners, in both normal view and fullscreen. They hide while setup or pause overlays are open. Safe-area insets, orientation changes, pointer capture, cancellation, visibility changes and pause overlays reset the stick.

Pads scale to the actual canvas area: 68 px on small canvases, 88 px on compact canvases, 120 px normally, and 144 px on large tablet canvases. Action buttons remain translucent and adapt with the pad. Action buttons retain independent pointers so movement and attacks can be held together. Horizontal modes keep Jump and Guard separate. Grid/four-direction modes snap to their existing permitted axes. Badminton reads continuous normalized axes with a 25% radial dead zone for 360 degree input.

## Adding future modes

1. Load both shared files. Use an existing `.touch` container, or `data-joystick="horizontal"`, `data-joystick="four"`, or `data-joystick="free"` on the control container.
2. Keep movement buttons with `data-key` codes (W/A/S/D) and dedicated action buttons. The adapter hides the replaced movement buttons and Adventure touch Run button and groups action buttons on the right. Existing Adventure uses arrow codes; Badminton uses `data-bd-key`; Island uses `data-code`.
3. Bind joystick direction transitions inside the browser controller through `ArcadeJoystick.bind(press, release)`, feeding that controller's existing input state. For free movement, consume `ArcadeJoystick.axes` (`x`, `y`, `active`) directly, falling back to keyboard input when inactive. The radius is clamped and axes are continuous.
4. Add mobile and tablet real-pointer movement, release, multitouch, cancellation and fullscreen tests. Run `npm run check-touch` for the current integration coverage.

This controls 1P; local 2P retains its existing keyboard controls. Validation uses Chromium touch-device emulation, not physical iOS/Android hardware.

Touch controls disable selection, callouts, touch scrolling and double-tap/context-menu gestures within the control region; the rest of the page keeps normal browser zoom behavior. Desktop Shift running remains unchanged.
