
# Copilot Suggestions

Learn how to auto-generate suggestions in the chat window based on real time application state.

useCopilotChatSuggestions is experimental. The interface is not final and can
change without notice.

[`useCopilotChatSuggestions`](https://docs.copilotkit.ai/reference/hooks/useCopilotChatSuggestions) is a React hook that generates suggestions in the chat window based on real time application state.

![](https://docs.copilotkit.ai/images/use-copilot-chat-suggestions/use-copilot-chat-suggestions.gif)

### [Simple Usage](https://docs.copilotkit.ai/guides/copilot-suggestions\#simple-usage)

```
import { useCopilotChatSuggestions } from "@copilotkit/react-ui";

export function MyComponent() {

  useCopilotChatSuggestions(
    {
      instructions: "Suggest the most relevant next actions.",
      minSuggestions: 1,
      maxSuggestions: 2,
    },
    [relevantState],
  );
}
```

### [Dependency Management](https://docs.copilotkit.ai/guides/copilot-suggestions\#dependency-management)

```
import { useCopilotChatSuggestions } from "@copilotkit/react-ui";

export function MyComponent() {
  useCopilotChatSuggestions(
    {
      instructions: "Suggest the most relevant next actions.",
      minSuggestions: 1,
      maxSuggestions: 2,
    },
    [relevantState],
  );
}
```

In the example above, the suggestions are generated based on the given instructions.
The hook monitors `relevantState`, and updates suggestions accordingly whenever it changes.

### [Specify `"use client"` (Next.js App Router)](https://docs.copilotkit.ai/guides/copilot-suggestions\#specify-use-client-nextjs-app-router)

This is only necessary if you are using Next.js with the App Router.

YourComponent.tsx

```
"use client"
```

Like other React hooks such as `useState` and `useEffect`, this is a **client-side** hook.
If you're using Next.js with the App Router, you'll need to add the `"use client"` directive at the top of any file using this hook.

## [Next Steps](https://docs.copilotkit.ai/guides/copilot-suggestions\#next-steps)

- Check out the [useCopilotChatSuggestions reference](https://docs.copilotkit.ai/reference/hooks/useCopilotChatSuggestions) for more details.

[Previous\\
\\
Guardrails](https://docs.copilotkit.ai/guides/guardrails) [Next\\
\\
Bring Your Own LLM](https://docs.copilotkit.ai/guides/bring-your-own-llm)

### On this page

[Simple Usage](https://docs.copilotkit.ai/guides/copilot-suggestions#simple-usage) [Dependency Management](https://docs.copilotkit.ai/guides/copilot-suggestions#dependency-management) [Next Steps](https://docs.copilotkit.ai/guides/copilot-suggestions#next-steps)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/copilot-suggestions.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)