---
name: ns-top-nav
description: Use when adding a screen header, back button, or top-bar actions, or when a page's header looks non-native, misaligned, or shows a phantom app-name toolbar on Android — decide between the native ActionBar and a synthetic layout-built header, then implement it with the NavigationButton/ActionItem platform asymmetries handled (iOS tap never fires; Android font:// icons rasterize at CSS font-size).
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Top navigation strategy: native ActionBar vs synthetic header

A screen's top bar is either the **native ActionBar** (`UINavigationBar` on iOS, `Toolbar` on Android) or a **synthetic header** — ordinary Labels/Buttons in the first row of the page layout. Default to native for any page you *navigate to*; reserve synthetic for branded tab-root headers that aren't navigation chrome at all.

## 1. Decision framework

| Screen shape | Use | Why |
|---|---|---|
| **Pushed page** — has a back affordance (detail views, viewers, sub-flows) | Native `<ActionBar>` | Back button, edge-swipe pop, title truncation, safe-area math, dark mode, and current-OS styling (translucency, Liquid Glass on iOS 26) all come from the system for free. A synthetic "‹ Back" row gets none of these and always reads as slightly off. |
| **Tab root with branded header** — big title + subtitle + custom controls that scroll like content | Synthetic header, `actionBarHidden = true` | This is a *content* header (iOS large-title spirit), not nav chrome. ActionBar can't express subtitle + arbitrary controls without fighting `titleView` sizing quirks on both platforms. |
| **Chrome-free page** — TabView shell, full-bleed media, onboarding | No bar: `actionBarHidden = true` | Nothing to show; just make the hide *explicit* (pitfall 1). |
| **Native bar, custom middle** — native back + actions but bespoke title (logo, segmented control) | `<ActionBar>` with `titleView` | Keeps every native behavior; only the middle is custom. Prefer this over going fully synthetic. |

Native wins whenever navigation is involved: iOS gives the chevron, previous-page label, interactive edge-swipe pop, and long-press history; the OS restyles the bar for dark mode/dynamic type/future redesigns; VoiceOver/TalkBack announce native bars correctly; status-bar/notch insets and truncation are handled. When synthetic is genuinely better, accept the cost — you own safe areas, dark mode, and a11y yourself — and don't imitate a system nav bar (fake "‹ Back" rows sit in the uncanny valley).

## 2. Architecture: each page decides

In Angular apps, give every `page-router-outlet` `actionBarVisibility="auto"` — never `never` app-wide (it forbids native bars for every page in that Frame). Pages that want the bar declare `<ActionBar>` as a **top-level template sibling** of the root layout (it attaches to the Page, not the layout); pages without one must hide it explicitly:

```html
<ActionBar title="Tonight's Brief">
  <NavigationButton text="Back" [icon]="androidBackIcon" class="fa nav-back" (tap)="back()"></NavigationButton>
  <ActionItem ios.position="right" android.position="actionBar" text="✨" (tap)="sparkle()"></ActionItem>
</ActionBar>

<GridLayout rows="*, auto" class="app-background">
  <Label row="0" text="content"></Label>
</GridLayout>
```

```ts
import { ActionBarComponent, ActionItemDirective, NavigationButtonDirective, RouterExtensions } from '@nativescript/angular';

@Component({ imports: [ActionBarComponent, ActionItemDirective, NavigationButtonDirective] })
export class BriefComponent {
  router = inject(RouterExtensions);
  // Android draws no back affordance by default; iOS must keep its system chevron (icon null)
  androidBackIcon = __ANDROID__ ? 'font://' + String.fromCharCode(0xf053) : null;
  back() { this.router.back(); }
}
```

Core XML: the same `<ActionBar>`/`<NavigationButton>`/`<ActionItem>` elements as the Page's first child; hide with `page.actionBarHidden = true` in the page's `loaded`/`navigatingTo` handler (Angular: `inject(Page)` and set it in the constructor).

## 3. Platform behavior you must know

**NavigationButton is asymmetric:**

* **iOS**: `text` sets the back label (core writes it to the *previous* controller's `backBarButtonItem`). The system performs the pop — `tap` does **not** fire. (The Angular router observes native back, including edge-swipe, and stays in sync automatically.)
* **Android**: no default rendering or behavior — you must set an icon (`font://` glyph or `res://`) and handle `tap` yourself. A `font://` icon is rasterized into a bitmap **at the item's resolved CSS font-size** (`ImageSource.fromFontIconCodeSync`); with no font-size set it draws at the Android `Paint` default (~12px) and the glyph comes out minuscule. Always pair `font://` with an explicit font-size — 24 is Android's standard toolbar icon size.
* Bind the icon `null` on iOS: a shared `icon` would replace iOS's native chevron indicator.

**ActionItem text color on Android** comes from the theme (`actionMenuTextColor` in `styles.xml`), not CSS. For CSS-styled items, put a `Label` inside the ActionItem (custom view):

```html
<ActionItem ios.position="right" android.position="actionBar" (tap)="openOnGitHub()">
  <Label text="GitHub ↗" class="text-sm font-semibold"></Label>
</ActionItem>
```

**Dynamic titles** bind fine (`<ActionBar [title]="doc?.title || ''">`) — long titles truncate natively.

## 4. Styling

Leave iOS unstyled unless the design demands otherwise — setting `background-color` on iOS replaces the system material (blur/Liquid Glass) with a flat color and opts you out of automatic appearance updates. Theme Android to match the app canvas, and give `font://` icons a family:

```css
.ns-android ActionBar { background-color: #f7f7f9; color: #16181d; }
.ns-android.ns-dark ActionBar { background-color: #0e1117; color: #f3f4f6; }
.fa { font-family: 'fa-solid-900', 'Font Awesome 6 Free'; }
/* Android rasterizes font:// item icons at the item's font-size; unset, the
   Paint default (~12px) yields a minuscule glyph. 24 = standard toolbar size. */
.ns-android .nav-back { font-size: 24; }
```

Selector gotcha: only `ActionBar` registers a CSS type — `NavigationButton { }` or `ActionItem { }` type selectors **silently match nothing**. Style bar items through class selectors. Also available: `flat="true"` (drop border + iOS translucency), `iosShadow="false"` (keep translucency, drop border), `iosLargeTitle="true"`.

## 5. Pitfalls

1. **A page with no `<ActionBar>` and no explicit `actionBarHidden`** → Android shows a default toolbar with the app name; iOS may show an empty bar on pushed pages. Every ActionBar-less page must set `actionBarHidden = true`.
2. **Mixed visibility in one Frame is fine** — a hidden-bar tab root pushing a bar-showing detail animates correctly on both platforms; don't split routes to avoid it.
3. **`tap` on NavigationButton never fires on iOS** — don't put required logic there; do cleanup in the page/component teardown instead.
4. **ActionBar inside the layout tree** — keep it a top-level sibling of the root layout; it's Page chrome, not a layout child.
5. **Modal pages** get their own Frame; the outlet/Frame inside the modal needs the same per-page rules.

## 6. Verify

* iOS: back label matches `NavigationButton text`; edge-swipe pops; dark-mode toggle restyles the bar with no CSS involved; long titles truncate.
* Android: back glyph visible in both themes **and sized like a stock toolbar arrow (~24dp), not a tiny speck**; hardware/system back and toolbar back both pop; no phantom app-name toolbar on any ActionBar-less page.
* Both: pushing from a hidden-bar page animates the bar in cleanly; action items tappable and colored per theme.

Verified 2026-08: iOS 26 simulator + Android 15 emulator, @nativescript/core 9.1.0-alpha.11, @nativescript/angular 21.2.0-alpha.4, in a production app (all four decision-framework shapes in use).
