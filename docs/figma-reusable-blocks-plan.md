# Platinum Horizon reusable block implementation plan

## Scope and method

This plan is based on one-by-one analysis of these Figma nodes:

1. `2001:14264` (home/search baseline)
2. `2077:7257` (home/search + open AI panel)
3. `2028:7261` (search results + AI panel + content lists)
4. `2042:7762` (cart page)
5. `2077:7520` (home/search signed-out variant)

Repository constraints considered:

- Edge Delivery Services + authored content model
- Vanilla JS blocks in `/blocks/*`
- Existing shared blocks: `header`, `footer`, `hero`, `cards`, `columns`, `fragment`

---

## Key cross-screen patterns (findings)

### 1) Repeating shell

- Same visual hero canvas (lavender background + blend image) appears across multiple views.
- Top navigation and footer are consistent, with signed-in/signed-out state differences.
- Floating AI action button appears in multiple pages.

### 2) Search interaction family

- Shared search input style appears in:
  - hero (default prompt)
  - hero (prefilled query)
  - search results page search-on-page
- One core component with variant content/state is sufficient.

### 3) Promotional content cards

- Three promo cards with eyebrow/title/body/link repeat in multiple hero states.
- Dot pagination/indicator appears with the promo row.
- This is structurally different from current `cards` block and should be a dedicated promo block.

### 4) AI panel and conversational state

- Right-side AI panel appears as overlay/docked panel with chat transcript and composer.
- Same screen can exist with AI panel closed/open.
- Panel should be optional and toggled by a simple state class or authored flag.

### 5) Results and commerce layouts

- Search results view introduces:
  - tabs
  - result list cards
  - study resources list
  - shop product list
- Cart view introduces:
  - cart line items
  - summary panel with totals/actions
  - service-benefit strip (3-column info)

---

## Proposed reusable block architecture

## A. Keep and extend existing blocks

### `header`

- Extend with nav state variants via metadata/classes:
  - signed-out (Sign In button)
  - signed-in (avatar + menu)
- Keep fragment-driven loading model.

### `footer`

- Extend with optional compact/full variants to support pages that need simplified vs expanded footer.
- Keep fragment-driven loading model.

### `columns`

- Reuse for simple 3-column informational strip on cart page (shipping / returns / help), with lightweight variant class.

## B. New blocks to add

### 1) `hero-search`

Purpose:
- Render hero heading/subheading + reusable search input bar.

Authoring contract (initial):
- Row 1: eyebrow (optional), title, subtitle
- Row 2: placeholder text or prefilled query text
- Row 3: optional background image reference
- Row 4: mode (`default` | `prefilled`)

Notes:
- Must support both node `2001:14264` and `2077:7520` style.

### 2) `promo-cards`

Purpose:
- Render horizontal set of promo cards with eyebrow/title/body/link + optional dots.

Authoring contract:
- One row per card:
  - label
  - title
  - description
  - CTA text + URL
- Block options row:
  - showDots (true/false)
  - maxVisible (desktop/tablet/mobile behavior controlled in CSS)

### 3) `ai-assistant-panel`

Purpose:
- Optional right-side chat panel and floating launcher.

Authoring contract:
- Panel title
- conversation items (role, message, timestamp)
- composer placeholder
- state (`open`/`closed`)

Notes:
- Keep behavior minimal in phase 1 (static transcript + visual states).

### 4) `search-results`

Purpose:
- Compose results area with tabs + tab panels.

Authoring contract:
- tab labels row
- content groups for each tab
- active tab default

Implementation detail:
- Use progressive enhancement (works with no JS, JS adds tab switching).

### 5) `resource-list`

Purpose:
- Vertical list for study resources.

Authoring contract:
- item rows with:
  - image
  - tag
  - title
  - metadata/authors
  - snippet
  - date

### 6) `product-list`

Purpose:
- Vertical shop list card(s) with title, edition/authors, options count, price.

Authoring contract:
- item rows with:
  - product image
  - title
  - metadata lines
  - options text
  - price text

### 7) `cart`

Purpose:
- Cart line item list + right summary panel.

Authoring contract:
- line items (image, title, variant, isbn, qty, item price)
- per-item actions (remove/save for later)
- summary rows (subtotal, tax, promo, total)
- checkout CTA

---

## Block-to-screen mapping

- `2001:14264`: `header` + `hero-search` + `promo-cards` + `ai-assistant-panel` (launcher only) + `footer`
- `2077:7257`: same as above + `ai-assistant-panel` open state
- `2028:7261`: `header` + `search-results` + `resource-list` + `product-list` + `ai-assistant-panel` open + `footer`
- `2042:7762`: `header` + `cart` + `columns` (benefits strip variant) + `ai-assistant-panel` launcher + `footer`
- `2077:7520`: `header` signed-out + `hero-search` + `promo-cards` + launcher + `footer`

---

## Phased implementation sequence

## Phase 1 (foundation and highest reuse)

1. Extend `header` and `footer` state handling.
2. Build `hero-search`.
3. Build `promo-cards`.
4. Build `ai-assistant-panel` (static open/closed).

Deliverable:
- Home screen parity for `2001:14264`, `2077:7257`, `2077:7520`.

## Phase 2 (results experience)

5. Build `search-results` tabs scaffold.
6. Build `resource-list`.
7. Build `product-list`.

Deliverable:
- Search results screen parity for `2028:7261`.

## Phase 3 (commerce/cart)

8. Build `cart` block.
9. Add `columns` variant for bottom benefits strip.

Deliverable:
- Cart screen parity for `2042:7762`.

---

## Authoring and maintainability rules

- Keep each block resilient to missing optional fields.
- Prefer semantic authored HTML transformed by block JS.
- Keep CSS strictly block-scoped (`.block-name ...`).
- Reuse global button conventions already in `styles/styles.css`.
- Avoid baking app state into block code; use simple class/option flags first.

---

## Validation checklist per block

- Works with no runtime errors when optional columns/rows are missing.
- Renders acceptably at mobile, tablet (`>=600`), desktop (`>=900`, `>=1200`) breakpoints.
- Keyboard focus/aria states for interactive controls (tabs, panel toggle, links).
- Lint clean (`npm run lint`).
- Verified via at least one draft page per new block.

---

## Suggested first implementation slice

Implement this first vertical slice before full build-out:

1. `hero-search` + `promo-cards`
2. `ai-assistant-panel` launcher only
3. header signed-out/signed-in variant switch

This gives the highest visible progress with maximum reuse across 3 of 5 analyzed screens.