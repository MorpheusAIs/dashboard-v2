
# Self Hosting (Copilot Runtime)

Learn how to self-host the Copilot Runtime.

The Copilot Runtime is the back-end component of CopilotKit, handling the communication with LLM, message history, state and more.

You may choose to self-host the Copilot Runtime, or [use Copilot Cloud](https://cloud.copilotkit.ai/) (recommended).

## [Integration](https://docs.copilotkit.ai/guides/self-hosting\#integration)

### [Step 1: Create an Endpoint](https://docs.copilotkit.ai/guides/self-hosting\#step-1-create-an-endpoint)

##### Choose your provider:

![OpenAI logo](https://docs.copilotkit.ai/icons/openai.png)OpenAI

If you are planning to use a single LangGraph agent in [agent-lock mode](https://docs.copilotkit.ai/coagents/multi-agent-flows) as your agentic backend, your LLM adapter will only be used for peripherals such as suggestions, etc.

If you are not sure yet, simply ignore this note.

### [Add your API key](https://docs.copilotkit.ai/guides/self-hosting\#add-your-api-key)

Next, add your API key to your `.env` file in the root of your project (unless you prefer to provide it directly to the client):

.env

```
OPENAI_API_KEY=your_api_key_here
```

Please note that the code below uses GPT-4o, which requires a paid OpenAI API key. **If you are using a free OpenAI API key**, change the model to a different option such as `gpt-3.5-turbo`.

### [Setup the Runtime Endpoint](https://docs.copilotkit.ai/guides/self-hosting\#setup-the-runtime-endpoint)

### [Serverless Function Timeouts](https://docs.copilotkit.ai/guides/self-hosting\#serverless-function-timeouts)

When deploying to serverless platforms (Vercel, AWS Lambda, etc.), be aware that default function timeouts may be too short for CopilotKit's streaming responses:

- Vercel defaults: 10s (Hobby), 15s (Pro)
- AWS Lambda default: 3s

**Solution options:**

1. Increase function timeout:








```
// vercel.json
{
     "functions": {
       "api/copilotkit/**/*": {
         "maxDuration": 60
       }
     }
}
```

2. Use [Copilot Cloud](https://cloud.copilotkit.ai/) to avoid timeout issues entirely

Next.js App RouterNext.js Pages RouterNode.js ExpressNode.js HTTPNestJS

Create a new route to handle the `/api/copilotkit` endpoint.

app/api/copilotkit/route.ts

```
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';

import { NextRequest } from 'next/server';


const serviceAdapter = new OpenAIAdapter();
const runtime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
};
```

Your Copilot Runtime endpoint should be available at `http://localhost:3000/api/copilotkit`.

### [Step 2: Configure the `<CopilotKit>` Provider](https://docs.copilotkit.ai/guides/self-hosting\#step-2-configure-the-copilotkit-provider)

layout.tsx

```
import "./globals.css";
import { ReactNode } from "react";
import { CopilotKit } from "@copilotkit/react-core";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Make sure to use the URL you configured in the previous step  */}
        <CopilotKit runtimeUrl="/api/copilotkit">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
```

## [Next Steps](https://docs.copilotkit.ai/guides/self-hosting\#next-steps)

- [`CopilotRuntime` Reference](https://docs.copilotkit.ai/reference/classes/CopilotRuntime)
- [LLM Adapters](https://docs.copilotkit.ai/reference/classes/llm-adapters/OpenAIAdapter)

[Previous\\
\\
Copilot Textarea](https://docs.copilotkit.ai/guides/copilot-textarea) [Next\\
\\
Saving and restoring messages](https://docs.copilotkit.ai/guides/messages-localstorage)

### On this page

[Integration](https://docs.copilotkit.ai/guides/self-hosting#integration) [Step 1: Create an Endpoint](https://docs.copilotkit.ai/guides/self-hosting#step-1-create-an-endpoint) [Step 2: Configure the <CopilotKit> Provider](https://docs.copilotkit.ai/guides/self-hosting#step-2-configure-the-copilotkit-provider) [Next Steps](https://docs.copilotkit.ai/guides/self-hosting#next-steps)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/self-hosting.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)