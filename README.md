# BwB Progressive Discount (Remix + Shopify)

Internal app for configuring and running progressive (tiered) discounts via a Shopify Function, with storefront behaviour driven by a theme snippet and shop metafields.

## What this app does
- Stores progressive discount config in shop metafields (`bwb_progressive`).
- Creates app-based discount objects (code + optional automatic).
- Applies discounts via a Shopify Function using cart attributes.
- Shows a localized checkout banner via the Checkout UI extension.

## Key routes
- `/app`: Main UI (Step 1–4 flow)
  - Step 1: Theme snippet setup (link to `/app/theme-setup`)
  - Step 2: Configure tiers + mode
  - Step 3: Create discounts
  - Step 4: Activate the correct discount in Admin
- `/app/setup-guide`: Short setup guide for merchants
- `/app/theme-setup`: Manual snippet instructions with copyable code block

## Configuration & data flow
1. Merchant sets config in `/app` (metafields under `bwb_progressive`).
2. Theme snippet reads metafields and writes cart attributes.
3. Discount Function reads cart attributes and applies a percentage discount.
4. Checkout extension displays a localized message.

## Theme snippet (required)
Manual install into the storefront theme:
1. Create `snippets/progressive-discount.liquid`.
2. Paste the snippet from `.ai/progressive-discount-liquid-snippet.md`.
3. Add to `theme.liquid` (near the bottom):
   ```
   {% render 'progressive-discount' %}
   ```

## Localization
Checkout banner message uses `shopify.i18n` with locale files at:
`extensions/discount-watcher/locales/*.json` (key: `progressive.message`).

## Logging
Created discount IDs are appended to `discount-log.txt`.

## Local development
```bash
shopify app dev
```

## Notes
- `.ai/` and `.CODEX-SHOPIFY-POLICY.md` are local-only and not part of the shipped app.
- This README is for internal use; see `.ai/notes.md` for the most current implementation details.
