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

- Funnel `DeFi Dashboard: capital action funnel`: `b9f15ba8-7050-4a82-b7d2-526d7f360add`.
- Journey `DeFi Dashboard: capital and builders journey`: `4e913e6f-345e-4de8-9418-4d58c25633a8`.
- Breakdown `DeFi Dashboard: interaction breakdown`: `e4b0ad68-fdb9-4635-be85-097e38d98d80`.
- Goal `DeFi Dashboard: form submit goal`: `9ac63e08-e0ca-4438-81ae-815a5605c77b`.
- UTM `DeFi Dashboard: UTM acquisition report`: `d9af4e35-2787-4981-b172-003a52f6daa0`.

## Coverage notes

- Source inventory found 171 link/button/action/form patterns across 42 TSX files.
- Root tracking covers all `a[href]`, `button`, `[role='button']`, `[data-umami-action]`, `[data-analytics-action]`, and form submits.
- No non-native clickable `div`, `span`, `li`, or card wrappers were found in the source inventory; dashboard actions use native buttons or button-like components and are captured by the root handler.
