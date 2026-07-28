/**
 * Compiler-facing ABI for the NativeScript renderer.
 *
 * Compiled `.tsx` modules import their host plans and hooks from this entry —
 * the compiler rewrites their `octane` imports to it — so it must re-export the
 * universal runtime. `octane/universal/native` is the host-neutral build: it
 * pulls in no DOM runtime, which is what makes it usable under the NativeScript
 * JS engines.
 */
export * from 'octane/universal/native';
export { createNativeScriptRoot, nativeScriptDriver, renderNativeScriptApp } from './driver';
export type { NativeScriptContainer } from './driver';
