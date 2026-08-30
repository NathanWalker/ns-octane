---
name: ns-angular-zoneless-native-choreography
description: Use when building a NativeScript Angular (zoneless, signals) screen that drives native views and needs polished motion — signal effects into custom views, (loaded) view refs, view.animate() intros/dims/crossfades, SegmentedBar binding, capped ScrollView heights.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Zoneless Angular + NativeScript views: patterns that hold up

Verified with Angular 20 (`provideZonelessChangeDetection()`), @nativescript/angular 20, core 9.0.

## Store: signals + a command bus
```ts
@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly now = signal(new Date());
  readonly minute = computed(() => Math.floor(this.now().getTime() / 60_000)); // coarse clock for expensive derivations
  readonly mode = signal<'a' | 'b'>('a');
  readonly commands = new Subject<{ type: 'flyTo'; target: LatLon }>();          // panel → view owner
  start() { setInterval(() => this.now.set(new Date()), 1000); }
}
```
Signals set from timers/callbacks re-render fine without zones; keep heavy `computed`s keyed on `minute()` rather than `now()`.

## Pushing signals into a native view
```ts
constructor() {
  effect(() => this.globe?.setSun(this.store.sun()));   // effect() in constructor = injection context
}
onGlobeLoaded(args: EventData) {                        // <Globe (loaded)="onGlobeLoaded($event)">
  this.globe = args.object as GlobeView;
  this.globe.setSun(this.store.sun());                  // effects that ran before the view existed did nothing — seed once
  this.globe.on('globeTap', (e) => …);
}
```

## Choreography with view.animate()
```ts
onPanelLoaded(a: EventData) { this.panel = a.object as View; this.panel.opacity = 0; this.panel.translateY = 28; }
// intro, timed against the 3D fly-in:
setTimeout(() => void this.chrome?.animate({ opacity: 1, duration: 900 }), 350);
setTimeout(() => void this.panel?.animate({ opacity: 1, translate: { x: 0, y: 0 }, duration: 800, curve: 'easeOut' }), 2300);
// dim while the user handles the content behind the panel:
this.globe.on('interaction', (e) => void this.panel?.animate({ opacity: e.active ? 0.3 : 1, duration: e.active ? 180 : 320 }));
// crossfade a bound label: fade out → change signal → fade in
void view.animate({ opacity: 0, duration: 260 }).then(() => { this.index.update((i) => i + 1); return view.animate({ opacity: 1, duration: 420 }); });
```
`[opacity]` bindings snap; use `animate()` for anything the eye should follow.

## Templates
* Control flow works: `@if (x(); as v) {…} @switch (store.mode()) { @case ('a') {…} } @for (u of items(); track $index) {…}`.
* `[class.active]="cond"` toggles CSS classes on NS views.
* SF Symbols: `<Image src="sys://location.fill" class="row-icon">` with `tint-color` in CSS (iOS only — bind `[src]="isIOS ? 'sys://…' : 'res://…'"` with an Android vector drawable).
* Native segmented control:
  ```html
  <SegmentedBar [selectedIndex]="modeIndex()" (selectedIndexChanged)="onModeChanged($event)">
    <SegmentedBarItem title="Earth"></SegmentedBarItem><SegmentedBarItem title="Look up"></SegmentedBarItem>
  </SegmentedBar>
  ```
  `args.newIndex` in the handler; CSS `selected-background-color`, `background-color`, `color`, `font-size` (rgba strings). Android renders titles uppercase.
* Component needs `schemas: [NO_ERRORS_SCHEMA]` and `imports: [ChildComponent]` for standalone children.
* Full-bleed page: `<GridLayout rows="*" iosOverflowSafeArea="true">`, overlays with `iosOverflowSafeArea="false"`; set `page.actionBarHidden = true; page.statusBarStyle = 'light'` in the constructor via `inject(Page)`.

## "Wrap content, but never more than half the screen" — and animate between sizes
Measure the body explicitly and animate the ScrollView `height` (works on both platforms); do not rely on `(layoutChanged)` for shrinking on Android. Full recipe: `ns-animated-panel-height`.

## Native segmented control on iOS, custom animated tabs on Android
`SegmentedBar` is great on iOS 26 (glass, sliding selection for free) but its Android TabHost look is dated. Keep it under `@if (isIOS)` and build a small pill tab bar for Android:
```html
<GridLayout rows="auto" class="tabbar" (layoutChanged)="onBarLayout($event)">
  <GridLayout row="0" horizontalAlignment="left" [width]="pillWidth()" class="pill" (loaded)="onPillLoaded($event)"></GridLayout>
  <GridLayout row="0" columns="*,*,*">
    @for (m of modes; track m.id) {
      <Label [col]="$index" [text]="m.label" class="tab" [class.active]="store.mode() === m.id" (tap)="select($index)"></Label>
    }
  </GridLayout>
</GridLayout>
```
```ts
onBarLayout(a: EventData) { const bar = a.object as View; this.pillWidth.set((Utils.layout.toDeviceIndependentPixels(bar.getMeasuredWidth()) - 6) / this.modes.length); }
select(i: number) { void this.pill?.animate({ translate: { x: i * this.pillWidth(), y: 0 }, duration: 260, curve: 'easeInOut' }); /* then set the mode signal */ }
```
CSS tokens that read as native: bar `rgba(255,255,255,0.10)`, radius 16, padding 3; pill `rgba(255,255,255,0.24)`, radius 13, height 34.

## Misc
* Custom NS views: `registerElement('Globe', () => GlobeView)` in `main.ts` before bootstrap.
* Timers started in `ngOnInit` must be cleared in `ngOnDestroy`; a livesync/HMR reload recreates components.
* `inject(Page)` gives the hosting Page in routed components.
