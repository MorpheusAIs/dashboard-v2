# Custom Sub-Components

You can swap out any of the sub-components of any Copilot UI to build up a completely custom look and feel. All components are fully typed with TypeScript for better development experience.

| Component | Description |
| --- | --- |
| [UserMessage](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#usermessage) | Message component for user messages |
| [AssistantMessage](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#assistantmessage) | Message component for assistant messages |
| [Window](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#window) | Contains the chat |
| [Button](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#button) | Button that opens/closes the chat |
| [Header](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#header) | The header of the chat |
| [Messages](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#messages) | The chat messages area |
| [Input](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#input) | The chat input |
| [Actions](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#actions) | Customize how actions (tools) are displayed |
| [Agent State](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#agent-state) | Customize how agent state messages are displayed |

## [UserMessage](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#usermessage)

The user message is what displays when the user sends a message to the chat. In this example, we change the color and add an avatar.

PreviewCode

The main thing to be aware of here is the `message` prop, which is the message text from the user.

```
import { UserMessageProps } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

const CustomUserMessage = (props: UserMessageProps) => {
  const wrapperStyles = "flex items-center gap-2 justify-end mb-4";
  const messageStyles = "bg-blue-500 text-white py-2 px-4 rounded-xl break-words flex-shrink-0 max-w-[80%]";
  const avatarStyles = "bg-blue-500 shadow-sm min-h-10 min-w-10 rounded-full text-white flex items-center justify-center";

  return (
    <div className={wrapperStyles}>
      <div className={messageStyles}>{props.message}</div>
      <div className={avatarStyles}>TS</div>
    </div>
  );
};

<CopilotKit>
  <CopilotSidebar UserMessage={CustomUserMessage} />
</CopilotKit>
```

## [AssistantMessage](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#assistantmessage)

The assistant message is what displays when the LLM responds to a user message. In this example, we remove the background color and add an avatar.

PreviewCode

```
import { AssistantMessageProps } from "@copilotkit/react-ui";
import { useChatContext } from "@copilotkit/react-ui";
import { Markdown } from "@copilotkit/react-ui";
import { SparklesIcon } from "@heroicons/react/24/outline";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

const CustomAssistantMessage = (props: AssistantMessageProps) => {
  const { icons } = useChatContext();
  const { message, isLoading, subComponent } = props;

  const avatarStyles = "bg-zinc-400 border-zinc-500 shadow-lg min-h-10 min-w-10 rounded-full text-white flex items-center justify-center";
  const messageStyles = "px-4 rounded-xl pt-2";

  const avatar = <div className={avatarStyles}><SparklesIcon className="h-6 w-6" /></div>


  return (
    <div className="py-2">
      <div className="flex items-start">
        {!subComponent && avatar}
        <div className={messageStyles}>
          {message && <Markdown content={message || ""} /> }
          {isLoading && icons.spinnerIcon}
        </div>
      </div>
      <div className="my-2">{subComponent}</div>
    </div>
  );
};

<CopilotKit>
  <CopilotSidebar AssistantMessage={CustomAssistantMessage} />
</CopilotKit>
```

**Key concepts**

- `subComponent` \- This is where any generative UI will be rendered.
- `message` \- This is the message text from the LLM, typically in markdown format.
- `isLoading` \- This is a boolean that indicates if the message is still loading.

## [Window](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#window)

The window is the main container for the chat. In this example, we turn it into a more traditional modal.

PreviewCode

```
import { WindowProps, useChatContext, CopilotSidebar } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
function Window({ children }: WindowProps) {
  const { open, setOpen } = useChatContext();

  if (!open) return null;


  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

<CopilotKit>
  <CopilotSidebar Window={Window} />
</CopilotKit>
```

## [Button](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#button)

The `CopilotSidebar` and `CopilotPopup` components allow you to customize their trigger button by passing in a custom Button component.

PreviewCode

```
import { ButtonProps, useChatContext, CopilotSidebar } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
function Button({}: ButtonProps) {
  const { open, setOpen } = useChatContext();

  const wrapperStyles = "w-24 bg-blue-500 text-white p-4 rounded-lg text-center cursor-pointer";


  return (
    <div onClick={() => setOpen(!open)} className={wrapperStyles}>
      <button
        className={`${open ? "open" : ""}`}
        aria-label={open ? "Close Chat" : "Open Chat"}
      >
        Ask AI
      </button>
    </div>
  );
};

<CopilotKit>
  <CopilotSidebar Button={Button} />
</CopilotKit>
```

The header component is the top of the chat window. In this example, we add a button to the left of the title
with a custom icon.

PreviewCode

```
import { HeaderProps, useChatContext, CopilotSidebar } from "@copilotkit/react-ui";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
function Header({}: HeaderProps) {
  const { setOpen, icons, labels } = useChatContext();


  return (
    <div className="flex justify-between items-center p-4 bg-blue-500 text-white">
      <div className="w-24">
        <a href="/">
          <BookOpenIcon className="w-6 h-6" />
        </a>
      </div>
      <div className="text-lg">{labels.title}</div>
      <div className="w-24 flex justify-end">
        <button onClick={() => setOpen(false)} aria-label="Close">
          {icons.headerCloseIcon}
        </button>
      </div>
    </div>
  );
};

<CopilotKit>
  <CopilotSidebar Header={Header} />
</CopilotKit>
```

## [Messages](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#messages)

The Messages component handles the display and organization of different message types in the chat interface. Its complexity comes from managing various message types (text, actions, results, and agent states) and maintaining proper scroll behavior.

PreviewCode

```
import { MessagesProps, CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotChat } from "@copilotkit/react-core";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
function CustomMessages({
  messages,
  inProgress,
  RenderTextMessage,
  RenderActionExecutionMessage,
  RenderResultMessage,
  RenderAgentStateMessage,
}: MessagesProps) {
  const wrapperStyles = "p-4 flex flex-col gap-2 h-full overflow-y-auto bg-indigo-300";

  /*
    Message types handled:
    - TextMessage: Regular chat messages
    - ActionExecutionMessage: When the LLM executes an action
    - ResultMessage: Results from actions
    - AgentStateMessage: Status updates from CoAgents
  */

  return (
    <div className={wrapperStyles}>
      {messages.map((message, index) => {
        if (message.isTextMessage()) {
          return <RenderTextMessage
            key={message.id}
            message={message}
            inProgress={inProgress}
            index={index}
            isCurrentMessage={index === messages.length - 1}
          />;
        } else if (message.isActionExecutionMessage()) {
          return <RenderActionExecutionMessage
            key={message.id}
            message={message}
            inProgress={inProgress}
            index={index}
            isCurrentMessage={index === messages.length - 1}
          />;
        } else if (message.isResultMessage()) {
          return <RenderResultMessage
            key={message.id}
            message={message}
            inProgress={inProgress}
            index={index}
            isCurrentMessage={index === messages.length - 1}
          />;
        } else if (message.isAgentStateMessage()) {
          return <RenderAgentStateMessage
              key={message.id}
              message={message}
              inProgress={inProgress}
              index={index}
              isCurrentMessage={index === messages.length - 1}
            />;
        }
      })}
    </div>
  );
}

<CopilotKit>
  <CopilotSidebar Messages={CustomMessages} />
</CopilotKit>
```

## [Input](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#input)

The input component that the user interacts with to send messages to the chat. In this example, we customize it
to have a custom "Ask" button and placeholder text.

PreviewCode

```
import { InputProps, CopilotSidebar } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
function CustomInput({ inProgress, onSend, isVisible }: InputProps) {
  const handleSubmit = (value: string) => {
    if (value.trim()) onSend(value);
  };

  const wrapperStyle = "flex gap-2 p-4 border-t";
  const inputStyle = "flex-1 p-2 rounded-md border border-gray-300 focus:outline-none focus:border-blue-500 disabled:bg-gray-100";
  const buttonStyle = "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed";


  return (
    <div className={wrapperStyle}>
      <input
        disabled={inProgress}
        type="text"
        placeholder="Ask your question here..."
        className={inputStyle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSubmit(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
      <button
        disabled={inProgress}
        className={buttonStyle}
        onClick={(e) => {
          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
          handleSubmit(input.value);
          input.value = '';
        }}
      >
        Ask
      </button>
    </div>
  );
}

<CopilotKit>
  <CopilotSidebar Input={CustomInput} />
</CopilotKit>
```

## [Actions](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#actions)

Actions allow the LLM to interact with your application's functionality. When an action is called by the LLM, you can provide custom components to visualize its execution and results. This example demonstrates a calendar meeting card implementation.

PreviewCode

```
"use client" // only necessary if you are using Next.js with the App Router.
import { useCopilotAction } from "@copilotkit/react-core";

export function YourComponent() {
  useCopilotAction({
    name: "showCalendarMeeting",
    description: "Displays calendar meeting information",
    parameters: [\
      {\
        name: "date",\
        type: "string",\
        description: "Meeting date (YYYY-MM-DD)",\
        required: true\
      },\
      {\
        name: "time",\
        type: "string",\
        description: "Meeting time (HH:mm)",\
        required: true\
      },\
      {\
        name: "meetingName",\
        type: "string",\
        description: "Name of the meeting",\
        required: false\
      }\
    ],
    render: ({ status, args }) => {
      const { date, time, meetingName } = args;

      if (status === 'inProgress') {
        return <LoadingView />; // Your own component for loading state
      } else {
        const meetingProps: CalendarMeetingCardProps = {
          date: date,
          time,
          meetingName
        };
        return <CalendarMeetingCardComponent {...meetingProps} />;
      }
    },
  });

  return (
    <>...</>
  );
}
```

## [Agent State](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code\#agent-state)

The Agent State component allows you to visualize the internal state and progress of your CoAgents. When working with CoAgents, you can provide a custom component to render the agent's state. This example demonstrates a progress bar that updates as the agent runs.

Not started with CoAgents yet?

If you haven't gotten started with CoAgents yet, you can get started in 10 minutes with the [quickstart guide](https://docs.copilotkit.ai/coagents/quickstart/langgraph).

PreviewCode

```
"use client"; // only necessary if you are using Next.js with the App Router.

import { useCoAgentStateRender } from "@copilotkit/react-core";
import { Progress } from "./progress";

type AgentState = {
  logs: string[];
}

useCoAgentStateRender<AgentState>({
  name: "basic_agent",
  render: ({ state, nodeName, status }) => {
    if (!state.logs || state.logs.length === 0) {
      return null;
    }

    // Progress is a component we are omitting from this example for brevity.
    return <Progress logs={state.logs} />;
  },
});
```

[Previous\\
\\
Styling Copilot UI](https://docs.copilotkit.ai/guides/custom-look-and-feel/customize-built-in-ui-components) [Next\\
\\
Fully Headless UI](https://docs.copilotkit.ai/guides/custom-look-and-feel/headless-ui)

### On this page

[UserMessage](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#usermessage) [AssistantMessage](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#assistantmessage) [Window](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#window) [Button](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#button) [Header](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#header) [Messages](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#messages) [Input](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#input) [Actions](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#actions) [Agent State](https://docs.copilotkit.ai/guides/custom-look-and-feel/bring-your-own-components?undefined=Code#agent-state)

[Edit on GitHub](https://github.com/CopilotKit/CopilotKit/blob/main/docs/content/docs/(root)/guides/custom-look-and-feel/bring-your-own-components.mdx)

![](https://static.scarf.sh/a.png?x-pxid=ffc9f65d-0186-4575-b065-61d62ea9d7d3)