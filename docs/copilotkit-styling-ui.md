[Customize UI](https://docs.copilotkit.ai/guides/custom-look-and-feel)

# Styling Copilot UI

CopilotKit has a variety of ways to customize colors and structures of the Copilot UI components.

- [CSS Variables](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#css-variables-easiest)
- [Custom CSS](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-css)
- [Custom Icons](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-icons)
- [Custom Labels](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-labels)

If you want to customize the style as well as the functionality of the Copilot UI, you can also try the following:

- [Custom Sub-Components](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components)
- [Fully Headless UI](https://docs.copilotkit.ai/guides/custom-look-and-feel/headless-ui)

## [CSS Variables (Easiest)](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#css-variables-easiest)

The easiest way to change the colors using in the Copilot UI components is to override CopilotKit CSS variables.

Hover over the interactive UI elements below to see the available CSS variables.

Close CopilotKit

CopilotKit

Hi you! 👋 I can help you create a presentation on any topic.

Hello CopilotKit!

Powered by CopilotKit

Once you've found the right variable, you can import `CopilotKitCSSProperties` and simply wrap CopilotKit in a div and override the CSS variables.

```
import { CopilotKitCSSProperties } from "@copilotkit/react-ui";

<div

  style={
    {
      "--copilot-kit-primary-color": "#222222",
    } as CopilotKitCSSProperties
  }
>
  <CopilotSidebar .../>
</div>
```

### [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#reference)

| CSS Variable | Description |
| --- | --- |
| `--copilot-kit-primary-color` | Main brand/action color - used for buttons, interactive elements |
| `--copilot-kit-contrast-color` | Color that contrasts with primary - used for text on primary elements |
| `--copilot-kit-background-color` | Main page/container background color |
| `--copilot-kit-secondary-color` | Secondary background - used for cards, panels, elevated surfaces |
| `--copilot-kit-secondary-contrast-color` | Primary text color for main content |
| `--copilot-kit-separator-color` | Border color for dividers and containers |
| `--copilot-kit-muted-color` | Muted color for disabled/inactive states |

## [Custom CSS](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#custom-css)

In addition to customizing the colors, the CopilotKit CSS is structured to easily allow customization via CSS classes.

globals.css

```
.copilotKitButton {
  border-radius: 0;
}

.copilotKitMessages {
  padding: 2rem;
}

.copilotKitUserMessage {
  background: #007AFF;
}
```

### [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#reference-1)

For a full list of styles and classes used in CopilotKit, click [here](https://github.com/CopilotKit/CopilotKit/blob/main/CopilotKit/packages/react-ui/src/css/).

| CSS Class | Description |
| --- | --- |
| `.copilotKitMessages` | Main container for all chat messages with scroll behavior and spacing |
| `.copilotKitInput` | Text input container with typing area and send button |
| `.copilotKitUserMessage` | Styling for user messages including background, text color and bubble shape |
| `.copilotKitAssistantMessage` | Styling for AI responses including background, text color and bubble shape |
| `.copilotKitHeader` | Top bar of chat window containing title and controls |
| `.copilotKitButton` | Primary chat toggle button with hover and active states |
| `.copilotKitWindow` | Root container defining overall chat window dimensions and position |
| `.copilotKitMarkdown` | Styles for rendered markdown content including lists, links and quotes |
| `.copilotKitCodeBlock` | Code snippet container with syntax highlighting and copy button |
| `.copilotKitChat` | Base chat layout container handling positioning and dimensions |
| `.copilotKitSidebar` | Styles for sidebar chat mode including width and animations |
| `.copilotKitPopup` | Styles for popup chat mode including position and animations |
| `.copilotKitButtonIcon` | Icon styling within the main chat toggle button |
| `.copilotKitButtonIconOpen` `.copilotKitButtonIconClose` | Icon states for when chat is open/closed |
| `.copilotKitCodeBlockToolbar` | Top bar of code blocks with language and copy controls |
| `.copilotKitCodeBlockToolbarLanguage` | Language label styling in code block toolbar |
| `.copilotKitCodeBlockToolbarButtons` | Container for code block action buttons |
| `.copilotKitCodeBlockToolbarButton` | Individual button styling in code block toolbar |
| `.copilotKitSidebarContentWrapper` | Inner container for sidebar mode content |
| `.copilotKitInputControls` | Container for input area buttons and controls |
| `.copilotKitActivityDot1` `.copilotKitActivityDot2` `.copilotKitActivityDot3` | Animated typing indicator dots |
| `.copilotKitDevConsole` | Development debugging console container |
| `.copilotKitDevConsoleWarnOutdated` | Warning styles for outdated dev console |
| `.copilotKitVersionInfo` | Version information display styles |
| `.copilotKitDebugMenuButton` | Debug menu toggle button styling |
| `.copilotKitDebugMenu` | Debug options menu container |
| `.copilotKitDebugMenuItem` | Individual debug menu option styling |

## [Custom Fonts](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#custom-fonts)

You can customize the fonts by updating the `fontFamily` property in the various CSS classes that are used in the CopilotKit.

globals.css

```
.copilotKitMessages {
  font-family: "Arial, sans-serif";
}

.copilotKitInput {
  font-family: "Arial, sans-serif";
}
```

### [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#reference-2)

You can update the main content classes to change the font family for the various components.

| CSS Class | Description |
| --- | --- |
| `.copilotKitMessages` | Main container for all messages |
| `.copilotKitInput` | The input field |
| `.copilotKitMessage` | Base styling for all chat messages |
| `.copilotKitUserMessage` | User messages |
| `.copilotKitAssistantMessage` | AI responses |

## [Custom Icons](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#custom-icons)

You can customize the icons by passing the `icons` property to the `CopilotSidebar`, `CopilotPopup` or `CopilotChat` component.

```
<CopilotChat
  icons={{
    // Use your own icons here – any React nodes
    openIcon: <YourOpenIconComponent />,
    closeIcon: <YourCloseIconComponent />,
  }}
/>
```

### [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#reference-3)

| Icon | Description |
| --- | --- |
| `openIcon` | The icon to use for the open chat button |
| `closeIcon` | The icon to use for the close chat button |
| `headerCloseIcon` | The icon to use for the close chat button in the header |
| `sendIcon` | The icon to use for the send button |
| `activityIcon` | The icon to use for the activity indicator |
| `spinnerIcon` | The icon to use for the spinner |
| `stopIcon` | The icon to use for the stop button |
| `regenerateIcon` | The icon to use for the regenerate button |
| `pushToTalkIcon` | The icon to use for push to talk |

## [Custom Labels](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#custom-labels)

To customize labels, pass the `labels` property to the `CopilotSidebar`, `CopilotPopup` or `CopilotChat` component.

```
<CopilotChat
  labels={{
    initial: "Hello! How can I help you today?",
    title: "My Copilot",
    placeholder: "Ask me anything!",
    stopGenerating: "Stop",
    regenerateResponse: "Regenerate",
  }}
/>
```

### [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components\#reference-4)

| Label | Description |
| --- | --- |
| `initial` | The initial message(s) to display in the chat window |
| `title` | The title to display in the header |
| `placeholder` | The placeholder to display in the input |
| `stopGenerating` | The label to display on the stop button |
| `regenerateResponse` | The label to display on the regenerate button |

[Previous\\
\\
Prebuilt Copilot UI](https://docs.copilotkit.ai/guides/custom-look-and-feel/built-in-ui-components) [Next\\
\\
Custom Sub-Components](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components)

### On this page

[CSS Variables (Easiest)](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#css-variables-easiest) [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#reference) [Custom CSS](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-css) [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#reference-1) [Custom Fonts](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-fonts) [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#reference-2) [Custom Icons](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-icons) [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#reference-3) [Custom Labels](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#custom-labels) [Reference](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components#reference-4)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/custom-look-and-feel/customize-built-in-ui-components.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)