/**
 * A plain module on purpose: it exports no component, so a hot update to it
 * has nothing to accept on its own and must reach the component that imports
 * it (`app.tsx`) through the reverse import graph.
 */
export const tagline = "with NativeScript 9.1 + Vite 8";
