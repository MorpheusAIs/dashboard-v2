[Connecting Your Data](https://docs.copilotkit.ai/guides/connect-your-data)

# Frontend Data

Learn how to connect your data to CopilotKit.

For your copilot to best answer your users' needs, you will want to provide it with **context-specific**, **user-specific**, and oftentimes **realtime** data. CopilotKit makes it easy to do so.

### [Add the data to the Copilot](https://docs.copilotkit.ai/guides/connect-your-data/frontend\#add-the-data-to-the-copilot)

The [`useCopilotReadable` hook](https://docs.copilotkit.ai/reference/hooks/useCopilotReadable) is used to add data as context to the Copilot.

YourComponent.tsx

```
"use client" // only necessary if you are using Next.js with the App Router.
import { useCopilotReadable } from "@copilotkit/react-core";
import { useState } from 'react';

export function YourComponent() {
  // Create colleagues state with some sample data
  const [colleagues, setColleagues] = useState([\
    { id: 1, name: "John Doe", role: "Developer" },\
    { id: 2, name: "Jane Smith", role: "Designer" },\
    { id: 3, name: "Bob Wilson", role: "Product Manager" }\
  ]);

  // Define Copilot readable state

  useCopilotReadable({
    description: "The current user's colleagues",
    value: colleagues,
  });
  return (
    // Your custom UI component
    <>...</>
  );
}
```

### [Specify `"use client"` (Next.js App Router)](https://docs.copilotkit.ai/guides/connect-your-data/frontend\#specify-use-client-nextjs-app-router)

This is only necessary if you are using Next.js with the App Router.

YourComponent.tsx

```
"use client"
```

Like other React hooks such as `useState` and `useEffect`, this is a **client-side** hook.
If you're using Next.js with the App Router, you'll need to add the `"use client"` directive at the top of any file using this hook.

### [Test it out!](https://docs.copilotkit.ai/guides/connect-your-data/frontend\#test-it-out)

The data you provided is now available to the Copilot.
Test it out by passing some data in the hook and asking the copilot questions about it.

![Example of connecting data to Copilot](https://docs.copilotkit.ai/images/connect-your-data-example.gif)

[Previous\\
\\
Connecting Your Data](https://docs.copilotkit.ai/guides/connect-your-data) [Next\\
\\
Backend Data](https://docs.copilotkit.ai/guides/connect-your-data/backend)

### On this page

[Add the data to the Copilot](https://docs.copilotkit.ai/guides/connect-your-data/frontend#add-the-data-to-the-copilot) [Test it out!](https://docs.copilotkit.ai/guides/connect-your-data/frontend#test-it-out)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/connect-your-data/frontend.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)