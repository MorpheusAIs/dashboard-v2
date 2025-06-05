# Prebuilt Copilot UI

First, import the default styles in your root component (typically `layout.tsx`) :

```
import "@copilotkit/react-ui/styles.css";
```

Copilot UI ships with a number of built-in UI patterns, choose whichever one you like.

CopilotPopupCopilotSidebarCopilotChatHeadless UI

`CopilotPopup` is a convenience wrapper for `CopilotChat` that lives at the same level as your main content in the view hierarchy. It provides **a floating chat interface** that can be toggled on and off.

![Popup Example](https://docs.copilotkit.ai/images/popup-example.gif)

```
import { CopilotPopup } from "@copilotkit/react-ui";

export function YourApp() {
  return (
    <>
      <YourMainContent />
      <CopilotPopup
        instructions={"You are assisting the user as best as you can. Answer in the best way possible given the data you have."}
        labels={{
          title: "Popup Assistant",
          initial: "Need any help?",
        }}
      />
    </>
  );
}
```

[Previous\\
\\
Customize UI](https://docs.copilotkit.ai/guides/custom-look-and-feel) [Next\\
\\
Styling Copilot UI](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components)

### On this page

No Headings

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/custom-look-and-feel/built-in-ui-components.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)