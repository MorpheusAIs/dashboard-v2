# Frontend Actions

Learn how to enable your Copilot to take actions in the frontend.

# [Let the Copilot Take Action](https://docs.copilotkit.ai/guides/frontend-actions\#let-the-copilot-take-action)

### [`useCopilotAction`](https://docs.copilotkit.ai/guides/frontend-actions\#usecopilotaction)

In addition to understanding state, you can empower the copilot to take actions. Use the [`useCopilotAction`](https://docs.copilotkit.ai/reference/hooks/useCopilotAction) hook to define specific tasks that the copilot can perform based on user input.

YourComponent.tsx

```
"use client" // only necessary if you are using Next.js with the App Router.
import { useCopilotAction } from "@copilotkit/react-core";

export function MyComponent() {
  const [todos, setTodos] = useState<string[]>([]);

  // Define Copilot action
  useCopilotAction({
    name: "addTodoItem",
    description: "Add a new todo item to the list",
    parameters: [\
      {\
        name: "todoText",\
        type: "string",\
        description: "The text of the todo item to add",\
        required: true,\
      },\
    ],
    handler: async ({ todoText }) => {
      setTodos([...todos, todoText]);
    },
  });

  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>{todo}</li>
      ))}
    </ul>
  );
}
```

### Changing where/when the action is executed

### [Specify `"use client"` (Next.js App Router)](https://docs.copilotkit.ai/guides/frontend-actions\#specify-use-client-nextjs-app-router)

This is only necessary if you are using Next.js with the App Router.

YourComponent.tsx

```
"use client"
```

Like other React hooks such as `useState` and `useEffect`, this is a **client-side** hook.
If you're using Next.js with the App Router, you'll need to add the `"use client"` directive at the top of any file using this hook.

### [Test it out!](https://docs.copilotkit.ai/guides/frontend-actions\#test-it-out)

After defining the action, ask the copilot to perform the task. For example, you can now ask the copilot to "select an employee" by specifying the `employeeId`.

![Example of Copilot action](https://docs.copilotkit.ai/images/copilot-action-example.gif)

## [Next Steps](https://docs.copilotkit.ai/guides/frontend-actions\#next-steps)

[**useCopilotAction Reference** \\
Refer to the documentation for the useCopilotAction hook.](https://docs.copilotkit.ai/reference/hooks/useCopilotAction) [**Actions + Generative UI** \\
Learn how to render custom UI components alongside your actions, directly in the CopilotKit chat window.](https://docs.copilotkit.ai/guides/generative-ui) [**Backend Actions** \\
Enable backend services to trigger actions via copilot backend hooks.](https://docs.copilotkit.ai/guides/backend-actions)

[Previous\\
\\
Generative UI](https://docs.copilotkit.ai/guides/generative-ui) [Next\\
\\
Backend Actions & Agents](https://docs.copilotkit.ai/guides/backend-actions)

### On this page

[Let the Copilot Take Action](https://docs.copilotkit.ai/guides/frontend-actions#let-the-copilot-take-action) [useCopilotAction](https://docs.copilotkit.ai/guides/frontend-actions#usecopilotaction) [Test it out!](https://docs.copilotkit.ai/guides/frontend-actions#test-it-out) [Next Steps](https://docs.copilotkit.ai/guides/frontend-actions#next-steps)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/frontend-actions.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)