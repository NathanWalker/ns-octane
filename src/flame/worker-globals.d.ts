/**
 * The NativeScript runtimes implement the web Worker surface this app uses,
 * but the project compiles against `lib: ["ESNext"]` only, so the relevant
 * globals are declared here rather than by pulling in the whole DOM lib.
 */
interface MessageEvent<T = any> {
	readonly data: T;
}

declare class Worker {
	constructor(scriptURL: string | URL);
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((error: unknown) => void) | null;
	postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
	terminate(): void;
}

/** Worker scope. */
declare function postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
declare var onmessage: ((event: MessageEvent) => void) | null;
