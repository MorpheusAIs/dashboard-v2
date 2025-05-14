
# Connect to MCP Servers

Integrate Model Context Protocol (MCP) servers into React applications

## [Introduction](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#introduction)

The Model Context Protocol is an open standard that enables developers to build secure, two-way connections between their data sources and AI-powered tools. With MCP, you can:

- Connect AI applications to your data sources
- Enable AI tools to access and utilize your data securely
- Build AI-powered features that have context about your application

For further reading, check out the [Model Context Protocol](https://modelcontextprotocol.io/introduction) website.

## [Quickstart with CopilotKit](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#quickstart-with-copilotkit)

### [Get an MCP Server](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#get-an-mcp-server)

First, we need to make sure we have an MCP server to connect to. You can use any MCP SSE endpoint you have configured.

### Get an MCP Server from Composio

Use the CopilotKit CLI

I have a Next.js application and want to get started quickly.

Code along

I want to deeply understand what's happening under the hood or don't have a Next.js application.

#### [Set up the CopilotKit Provider](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#set-up-the-copilotkit-provider)

Wrap your application with the `CopilotKit` provider:

```
"use client";

import { CopilotKit } from "@copilotkit/react-core";

export default function App() {
  return (
    <CopilotKit publicApiKey="<replace_with_your_own>">
      {/* Your app content */}
    </CopilotKit>
  );
}
```

#### [Connect to MCP Servers](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#connect-to-mcp-servers)

Create a component to manage MCP server connections:

```
"use client";

import { useCopilotChat } from "@copilotkit/react-core";
import { useEffect } from "react";

function McpServerManager() {
  const { setMcpServers } = useCopilotChat();

  useEffect(() => {
    setMcpServers([\
      {\
        // Try a sample MCP server at https://mcp.composio.dev/\
        endpoint: "your_mcp_sse_url",\
      },\
    ]);
  }, [setMcpServers]);

  return null;
}

export default McpServerManager;
```

#### [Add the Chat Interface](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#add-the-chat-interface)

Add the `CopilotChat` component to your page:

```
"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import McpServerManager from "./McpServerManager";

export default function ChatInterface() {
  return (
    <div className="flex h-screen p-4">
      <McpServerManager />
      <CopilotChat
        instructions="You are a helpful assistant with access to MCP servers."
        className="flex-grow rounded-lg w-full"
      />
    </div>
  );
}
```

#### [Visualize MCP Tool Calls (Optional)](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#visualize-mcp-tool-calls-optional)

Create a component to display MCP tool calls in your UI:

```
"use client";

import {
  useCopilotAction,
  CatchAllActionRenderProps,
} from "@copilotkit/react-core";
import McpToolCall from "./McpToolCall";

export function ToolRenderer() {
  useCopilotAction({
    /**
     * The asterisk (*) matches all tool calls
     */
    name: "*",
    render: ({ name, status, args, result }: CatchAllActionRenderProps<[]>) => (
      <McpToolCall status={status} name={name} args={args} result={result} />
    ),
  });
  return null;
}
```

#### [Complete Implementation](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#complete-implementation)

Combine all components together:

```
"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import McpServerManager from "./McpServerManager";
import { ToolRenderer } from "./ToolRenderer";

export default function Page() {
  return (
    <CopilotKit publicApiKey="<replace_with_your_own>">
      <div className="flex h-screen p-4">
        <McpServerManager />
        <CopilotChat
          instructions="You are a helpful assistant with access to MCP servers."
          className="flex-grow rounded-lg w-full"
        />
        <ToolRenderer />
      </div>
    </CopilotKit>
  );
}
```

## [Advanced Usage](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#advanced-usage)

### [Implementing the McpToolCall Component](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#implementing-the-mcptoolcall-component)

Click to see the McpToolCall component implementation

```
"use client";

import * as React from "react";

interface ToolCallProps {
  status: "complete" | "inProgress" | "executing";
  name?: string;
  args?: any;
  result?: any;
}

export default function MCPToolCall({
  status,
  name = "",
  args,
  result,
}: ToolCallProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Format content for display
  const format = (content: any): string => {
    if (!content) return "";
    const text =
      typeof content === "object"
        ? JSON.stringify(content, null, 2)
        : String(content);
    return text
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  };

  return (
    <div className="bg-[#1e2738] rounded-lg overflow-hidden w-full">
      <div
        className="p-3 flex items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-white text-sm overflow-hidden text-ellipsis">
          {name || "MCP Tool Call"}
        </span>
        <div className="ml-auto">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "complete"
                ? "bg-gray-300"
                : status === "inProgress" || status === "executing"
                ? "bg-gray-500 animate-pulse"
                : "bg-gray-700"
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 text-gray-300 font-mono text-xs">
          {args && (
            <div className="mb-4">
              <div className="text-gray-400 mb-2">Parameters:</div>
              <pre className="whitespace-pre-wrap max-h-[200px] overflow-auto">
                {format(args)}
              </pre>
            </div>
          )}

          {status === "complete" && result && (
            <div>
              <div className="text-gray-400 mb-2">Result:</div>
              <pre className="whitespace-pre-wrap max-h-[200px] overflow-auto">
                {format(result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### [Self-Hosting Option](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually\#self-hosting-option)

Click here to learn how to use MCP with self-hosted runtime

Self-Hosting vs Copilot Cloud

The Copilot Runtime handles communication with LLMs, message history, and
state. You can self-host it or use
[Copilot Cloud](https://go.copilotkit.ai/copilot-cloud-button-docs?ref=docs&session_id=0196906e-bcaa-7a82-bc91-0e5c69d2d9f1)
(recommended). Learn more in our [Self-Hosting Guide](https://docs.copilotkit.ai/guides/self-hosting).

To configure your self-hosted runtime with MCP servers, you'll need to implement the `createMCPClient` function that matches this interface:

```
type CreateMCPClientFunction = (
  config: MCPEndpointConfig
) => Promise<MCPClient>;
```

For detailed implementation guidance, refer to the [official MCP SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#writing-mcp-clients).

Here's a basic example of configuring the runtime:

```
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";

const serviceAdapter = new OpenAIAdapter();

const runtime = new CopilotRuntime({
  createMCPClient: async (config) => {
    // Implement your MCP client creation logic here
    // See the MCP SDK docs for implementation details
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
```

[Previous\\
\\
Remote Endpoint (LangGraph Platform)](https://docs.copilotkit.ai/guides/backend-actions/langgraph-platform-endpoint) [Next\\
\\
Customize Instructions](https://docs.copilotkit.ai/guides/custom-ai-assistant-behavior)

### On this page

[Introduction](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#introduction) [Quickstart with CopilotKit](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#quickstart-with-copilotkit) [Get an MCP Server](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#get-an-mcp-server) [Run the CLI](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#run-the-cli) [Set up the CopilotKit Provider](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#set-up-the-copilotkit-provider) [Connect to MCP Servers](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#connect-to-mcp-servers) [Add the Chat Interface](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#add-the-chat-interface) [Visualize MCP Tool Calls (Optional)](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#visualize-mcp-tool-calls-optional) [Complete Implementation](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#complete-implementation) [Advanced Usage](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#advanced-usage) [Implementing the McpToolCall Component](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#implementing-the-mcptoolcall-component) [Self-Hosting Option](https://docs.copilotkit.ai/guides/model-context-protocol?cli=do-it-manually#self-hosting-option)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/model-context-protocol.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)