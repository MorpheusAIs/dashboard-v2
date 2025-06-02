[Backend Actions & Agents](https://docs.copilotkit.ai/guides/backend-actions)

# TypeScript (Node.js)

Implement native backend actions using TypeScript or Node.js in CopilotKit.

### Find your CopilotRuntime

The starting point for this section is the `CopilotRuntime` you set up during quickstart (the CopilotKit backend endpoint).
For a refresher, see [Self-Hosting](https://docs.copilotkit.ai/guides/self-hosting) (or alternatively, revisit the [quickstart](https://docs.copilotkit.ai/quickstart)).

**First, find your `CopilotRuntime` instance in your code.** You can simply search your codebase for `CopilotRuntime`.

If you followed the quickstart, it'll be where you set up the `/api/copilotkit` endpoint.

### [Modify CopilotRuntime to include TypeScript/Node.js actions](https://docs.copilotkit.ai/guides/backend-actions/typescript-backend-actions\#modify-copilotruntime-to-include-typescriptnodejs-actions)

Once you've located your `CopilotRuntime`, you can add TypeScript/Node.js actions by modifying its configuration. Here's how to implement native backend actions:

**Note** that `actions` is not merely an array of actions, but an array **generator**.
This generator takes `properties` and `url` as input.

This means you can **customize which backend actions are made available** according to the current frontend URL, as well as custom properties you can pass from the frontend.

/api/copilotkit/route.ts

```
const runtime = new CopilotRuntime({
  // ... existing configuration
  actions: ({properties, url}) => {
    // Note that actions returns not an array, but an array **generator**.
    // You can use the input parameters to the actions generator to expose different backend actions to the Copilot at different times:
    // `url` is the current URL on the frontend application.
    // `properties` contains custom properties you can pass from the frontend application.

    return [\
      {\
        name: "fetchNameForUserId",\
        description: "Fetches user name from the database for a given ID.",\
        parameters: [\
          {\
            name: "userId",\
            type: "string",\
            description: "The ID of the user to fetch data for.",\
            required: true,\
          },\
        ],\
        handler: async ({userId}: {userId: string}) => {\
          // do something with the userId\
          // return the user data\
          return {\
            name: "Darth Doe",\
          };\
        },\
      },\
    ]
  }
});

// ... rest of your route definition
```

### [Test your implementation](https://docs.copilotkit.ai/guides/backend-actions/typescript-backend-actions\#test-your-implementation)

After adding the action, test it by asking the copilot to perform the task. Observe how it selects the correct task, executes it, and streams back relevant responses.

## [Key Points](https://docs.copilotkit.ai/guides/backend-actions/typescript-backend-actions\#key-points)

- Each action is defined with a name, description, parameters, and a handler function.
- The handler function implements the actual logic of the action and can interact with your backend systems.

By using this method, you can create powerful, context-aware backend actions that integrate seamlessly with your CopilotKit application.

[Previous\\
\\
Backend Actions & Agents](https://docs.copilotkit.ai/guides/backend-actions) [Next\\
\\
LangChain.js](https://docs.copilotkit.ai/guides/backend-actions/langchain-js-backend-actions)

### On this page

[Modify CopilotRuntime to include TypeScript/Node.js actions](https://docs.copilotkit.ai/guides/backend-actions/typescript-backend-actions#modify-copilotruntime-to-include-typescriptnodejs-actions) [Test your implementation](https://docs.copilotkit.ai/guides/backend-actions/typescript-backend-actions#test-your-implementation) [Key Points](https://docs.copilotkit.ai/guides/backend-actions/typescript-backend-actions#key-points)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/backend-actions/typescript-backend-actions.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)