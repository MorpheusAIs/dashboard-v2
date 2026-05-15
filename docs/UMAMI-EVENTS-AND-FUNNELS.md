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
