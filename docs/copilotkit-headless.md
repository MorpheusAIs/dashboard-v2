
[Customize UI](https://docs.copilotkit.ai/guides/custom-look-and-feel)

# Prebuilt Copilot UI

First, import the default styles in your root component (typically `layout.tsx`) :

```
import "@copilotkit/react-ui/styles.css";
```

Copilot UI ships with a number of built-in UI patterns, choose whichever one you like.

CopilotPopupCopilotSidebarCopilotChatHeadless UI

The built-in Copilot UI can be customized in many ways -- both through css and by passing in custom sub-components.

CopilotKit also offers **fully custom headless UI**, through the `useCopilotChat` hook. Everything built with the built-in UI (and more) can be implemented with the headless UI, providing deep customizability.

```
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";

export function CustomChatInterface() {
  const {
    visibleMessages,
    appendMessage,
    setMessages,
    deleteMessage,
    reloadMessages,
    stopGeneration,
    isLoading,
  } = useCopilotChat();

  const sendMessage = (content: string) => {
    appendMessage(new TextMessage({ content, role: Role.User }));
  };

  return (
    <div>
      {/* Implement your custom chat UI here */}
    </div>
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