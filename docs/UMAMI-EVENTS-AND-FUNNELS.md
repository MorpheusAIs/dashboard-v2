# Umami events and funnels

This dashboard uses the root `UmamiInteractionTracker` to capture clicks and submits without storing form values or user-entered text.

## Events

- `link-click-internal`: internal dashboard navigation clicks.
- `link-click-external`: outbound link clicks.
- `button-click`: buttons, role-buttons, and annotated actions.
- `form-submit`: form submissions.

Shared properties: `current_path`, `page_title`, `page_section`, and `element_area`. Link events also include `link_text`, `destination`, and `link_domain`. Button events include `button_text` and `action_name`.

## Recommended reports

- Capital funnel: path `/capital` → deposit/withdraw/claim button clicks → modal form submit or wallet action click.
- Builder funnel: path `/builders` → builder detail internal link clicks → stake/edit/new subnet actions.
- Compute funnel: path `/compute` → subnet detail navigation → staking or provider action clicks.
- Bridge funnel: path `/bridge-mor` → bridge form button clicks → external wallet/widget destinations.

## Saved Umami reports

- Funnel `DeFi Dashboard: capital action funnel`: `b9f15ba8-7050-4a82-b7d2-526d7f360add` (`type: funnel`, steps: path `/capital` → event `button-click` → event `form-submit`, 30-minute window).
- Journey `DeFi Dashboard: capital and builders journey`: `4e913e6f-345e-4de8-9418-4d58c25633a8`.
- Breakdown `DeFi Dashboard: interaction breakdown`: `e4b0ad68-fdb9-4635-be85-097e38d98d80`.
- Goal `DeFi Dashboard: form submit goal`: `9ac63e08-e0ca-4438-81ae-815a5605c77b`.
- UTM `DeFi Dashboard: UTM acquisition report`: `d9af4e35-2787-4981-b172-003a52f6daa0`.

## Coverage notes

- Source inventory found 171 link/button/action/form patterns across 42 TSX files.
- Root tracking covers all `a[href]`, `button`, `[role='button']`, `[data-umami-action]`, `[data-analytics-action]`, and form submits.
- Dashboard actions use native buttons, button-like components, or explicit `data-analytics-action` metadata. The known non-native wrappers for CSV upload and multi-select focus are annotated so the root handler captures those actions too.

## Session replay verification

- API check confirmed replay is enabled for website `93926d2b-ff86-4c74-8897-dbe12ea33be5` with `sampleRate: 0.15`, `maskLevel: moderate`, and `maxDuration: 300000`.
- Forced sampled browser QA on `http://localhost:3303/` loaded `script.js` and `recorder.js`, obtained an Umami session cache, and received `200 {"ok":true}` from `/api/record`.
- Replay list verification returned replay `7691a26e-eaa3-575d-85d3-99f2f242ba84` with session `1d008e38-2515-5d3d-9cad-4f34eaa03834`, `847` events, `9` chunks, and replay detail endpoint returned `847` playback events.

## Wallet-gated-flow QA notes

- Dashboard routes are publicly renderable, while contract-writing actions are wallet-gated by Wagmi/Reown rather than username/password credentials.
- No wallet seed or browser wallet session was available, so transaction submission flows were not executed.
- No-wallet QA opened `/builders/newsubnet`, verified actionable controls render, and confirmed Umami sends `link-click-internal` for the `Cancel` action with `destination: /builders` and `element_area: main`.

## Manual event QA

- Production-server browser QA on `http://localhost:3403/` loaded both `script.js` and `recorder.js` for website id `93926d2b-ff86-4c74-8897-dbe12ea33be5`.
- `/builders` table QA confirmed Umami `/api/send` POST payloads for sortable headers and clickable rows: `button-click` with `action_name: table-sort`, `button_text: Sort by MOR Staked`, `destination: /builders?sort=totalStaked-asc`, plus `button-click` with `action_name: table-row-open`, `button_text: Open Mor.org-BASE`, and destination `/builders/mororg-base?subnet_id=0xdccb9a7800ec49cd48db4d631f37c63a730ac8e8124901e59dd087ffcfc29564&network=Base`.
- `/compute` table QA confirmed Umami `/api/send` POST payloads for sortable headers: `button-click` with `action_name: table-sort`, `button_text: Sort by Subnet Fee`, and `destination: /compute?sort=fee-asc`.
- Focused toast-action QA on `http://localhost:3403/capital` could not submit real wallet transactions without a wallet seed/session, so it paired code-level verification of `createTrackedExternalToastAction(...)` wiring with browser payload proof using the same emitted payload shape. Umami `/api/send` received `button-click` payloads with `element_area: notification`, `action_name: open-safe-wallet`, `button_text: Open Safe Wallet`, `destination: https://app.safe.global/transactions/queue?safe=eth:0x0000000000000000000000000000000000000001`, `link_domain: app.safe.global`, and `action_name: view-transaction`, `button_text: View Transaction`, `destination: https://etherscan.io/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`, `link_domain: etherscan.io`.
- Final source scan for non-native click wrappers identified the CSV upload wrapper and multi-selector focus wrapper; both now carry explicit `data-analytics-action` and `data-analytics-destination` metadata for root-tracker coverage.
- Final verification reran `pnpm run build` after the wallet-toast and wrapper annotation fixes; it completed successfully with the same pre-existing external Dune/subgraph warnings seen before these analytics changes.
