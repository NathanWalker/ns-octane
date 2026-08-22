import type { FlameState } from './flame.worker';

/**
 * Main-realm side of the flame worker: one subscription surface for
 * components, and the hot-update choreography for the worker itself.
 *
 * A Worker script never evaluates in this realm, so nothing here can be
 * "re-imported" when it changes. Instead this module accepts the worker's
 * path: the outgoing worker hands its state over, is terminated, and a fresh
 * worker — loading the fresh script — resumes from that state.
 */

type Listener = (intensity: number) => void;

const listeners = new Set<Listener>();
let worker: Worker | null = null;
let latest = 1;
let frames = 0;

function spawn(resume?: FlameState): Worker {
	const next = new Worker(new URL('./flame.worker', import.meta.url));
	next.onmessage = (event: MessageEvent) => {
		const message = event.data;
		if (message?.type === 'frame') {
			latest = message.intensity;
			frames = message.frames;
			for (const listener of listeners) listener(latest);
		}
	};
	next.postMessage({ type: 'start', state: resume });
	return next;
}

function handoff(outgoing: Worker): Promise<FlameState | undefined> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => resolve(undefined), 500);
		outgoing.onmessage = (event: MessageEvent) => {
			if (event.data?.type === 'state') {
				clearTimeout(timeout);
				resolve(event.data.state);
			}
		};
		outgoing.postMessage({ type: 'handoff' });
	});
}

async function respawn(): Promise<void> {
	const outgoing = worker;
	worker = null;
	const state = outgoing ? await handoff(outgoing) : undefined;
	outgoing?.terminate();
	worker = spawn(state);
	console.log(`[flame] worker respawned from frame ${state?.frames ?? 0}`);
}

export function subscribeFlame(listener: Listener): () => void {
	listeners.add(listener);
	if (worker === null) worker = spawn();
	listener(latest);
	return () => {
		listeners.delete(listener);
	};
}

export function flameFrames(): number {
	return frames;
}

if (import.meta.hot) {
	import.meta.hot.accept('./flame.worker', () => void respawn());
	import.meta.hot.dispose(() => {
		worker?.terminate();
		worker = null;
	});
}
