import { Haptics, HapticImpactType } from "@nativescript/haptics";

/** Light tap feedback — buttons, menu actions, send. */
export function tapHaptic(): void {
  Haptics.impact(HapticImpactType.LIGHT);
}

/** Selection tick — drawer snapping open/closed, picker-style changes. */
export function selectHaptic(): void {
  Haptics.selection();
}

/** A firmer thump for the drawer settling open or closed. */
export function drawerHaptic(): void {
  Haptics.impact(HapticImpactType.MEDIUM);
}
