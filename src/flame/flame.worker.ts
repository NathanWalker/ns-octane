/**
 * Drives the logo's `intensity` from its own isolate: a slow breath plus a
 * little flicker, ~30 frames a second. Nothing here touches the UI — the main
 * realm receives `{ type: 'frame', intensity }` and feeds the shader.
 *
 * The worker is disposable. On `handoff` it replies with everything needed to
 * continue the curve from the same point, so a respawned worker (a hot update
 * to this file) picks up mid-breath instead of restarting at zero.
 */

import '@nativescript/core/globals';

export interface FlameState {
	phase: number;
	frames: number;
}

const FRAME_MS = 33;

let state: FlameState = { phase: 0, frames: 0 };
let timer: ReturnType<typeof setInterval> | null = null;

function intensityAt({ phase, frames }: FlameState): number {
	const breath = 1.2 + 0.8 * Math.sin(phase);
	const flicker = 0.25 * Math.sin(frames * 1.7) * Math.sin(frames * 0.31);
	return breath + flicker;
}

function tick(): void {
	state = { phase: state.phase + 0.05, frames: state.frames + 1 };
	globalThis.postMessage({ type: 'frame', intensity: intensityAt(state), frames: state.frames });
}

globalThis.onmessage = (event: MessageEvent) => {
	const message = event.data;
	switch (message?.type) {
		case 'start':
			if (message.state) state = message.state;
			if (timer === null) timer = setInterval(tick, FRAME_MS);
			return;
		case 'handoff':
			if (timer !== null) clearInterval(timer);
			timer = null;
			globalThis.postMessage({ type: 'state', state });
			return;
	}
};
