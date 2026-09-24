---
title: Build an AI Project Manager with Convex
description: Build a reactive task manager where an AI assistant creates, reads, and updates real application state through typed tools.
difficulty: intermediate
stack:
  - Next.js
  - TypeScript
  - Vercel AI SDK
  - OpenRouter
  - Convex
concepts:
  - tool-calling
  - multi-step-tools
  - mutations
  - reactive-data
estimatedTime: 75 minutes
order: 3
verifiedAt: 2026-09-23
prerequisites:
  - Node.js 22 or newer
  - pnpm 10 or newer
  - A code editor
  - An OpenRouter account
  - A GitHub account, used to sign in to Convex
whatYouBuild:
  - A task list stored in Convex that updates when the data changes
  - An assistant that creates and completes tasks by requesting typed tools
  - A request that looks up a task by its title, then updates that task
whatYouLearn:
  - Tool calling is a typed request, and your server performs the action
  - How an AI SDK tool calls a Convex query or mutation
  - Why the result of one tool can decide the next tool call
  - How a Convex query subscription rerenders the task list without a manual refresh
architecture:
  - User message
  - OpenRouter model
  - AI SDK tool call
  - Server executes the tool
  - Convex query or mutation
  - Database change
  - Reactive task list
  - Model answers
relatedTopics:
  - tool-calling
  - agents
  - agentic-loops
  - prompting-fundamentals
  - evals
relatedPrompts:
  - tool-selection-router
  - safe-tool-calling-system
---

## What we're building

You will build a small project manager and run it at http://localhost:3000.

The page has two parts that share one database. A task list shows title, priority, and a checkbox. An assistant accepts a sentence such as "Add a high-priority task to finish the landing page." The assistant does not edit the database itself. It asks your server to run a tool. The server writes to Convex. The task list is already subscribed to that data, so the new row appears without a refresh call from the chat route.

This is the third shape of AI feature in these guides. A structured-output app asks the model for an object. A RAG app retrieves text and then asks the model to write. This app asks the model to choose an action. Your code is the only thing that runs the action.

The boxes in the architecture diagram are that path: a person types a message, the model requests a tool, the Next.js route runs it against Convex, the task list updates, and the model reads the tool result before it answers.

Chat messages live in the browser for this page load. Tasks live in Convex. Refreshing the page clears the conversation and leaves the tasks.

## What you'll learn

The model does not call `ctx.db.insert`. It produces a structured request. The AI SDK checks that request against a Zod schema. The `execute` function is ordinary TypeScript in your route handler, and that function calls Convex.

A tool result can be the input to the next decision. "Mark the documentation task complete" cannot name a Convex document id. The model first lists tasks, reads the id from that result, then requests the update. [Tool calling](/learn/tool-calling) is the single request. [Agentic loops](/learn/agentic-loops) is the bounded sequence of requests. This guide uses a step limit so the loop cannot run forever.

`useQuery` is a subscription. When a mutation changes the tasks the query returns, Convex pushes the new list and React rerenders. The chat route does not tell the task list to reload.

The same Convex mutation can be called from a checkbox and from a tool. The human interface and the model are two clients of one backend function.

## Prerequisites

Install these before you create the app:

- [Node.js 22](https://nodejs.org) or newer. `@openrouter/ai-sdk-provider` v3 requires Node.js 22, and AI SDK 7 declares the same engine.
- [pnpm 10](https://pnpm.io/installation) or newer.
- A code editor.
- An [OpenRouter](https://openrouter.ai) account. You will create an API key and need a small credit balance.
- A GitHub account. The Convex CLI uses it the first time you start the dev deployment.

You do not need a local database, Docker, an OpenAI account, or an authentication library.

## Create an OpenRouter API key

OpenRouter sells access to many models through one key. This app calls one inexpensive model, `z-ai/glm-5.3-flash` (GLM 5.3 Flash). Its [model page](https://openrouter.ai/z-ai/glm-5.3-flash) accepts `tools` and `tool_choice`, which is the function-calling shape the AI SDK sends. The same model is used in the earlier guides, so one key and one id stay consistent. You can change the id later. Do not start with a flagship model. This tutorial is about the tool boundary, not model size.

1. Open [openrouter.ai](https://openrouter.ai) and create an account, or sign in.
2. Open [API keys](https://openrouter.ai/settings/keys).
3. Choose **Create**. Name the key `ai-project-manager`.
4. Copy the key immediately. OpenRouter shows the full secret once.
5. Open [Credits](https://openrouter.ai/settings/credits) and add a small balance if the account has none. A handful of task requests costs well under a dollar on this model. Requests fail when the balance is empty.

Keep the key. You will paste it into `.env.local` after Convex creates that file. Do not put it in source code, and do not prefix the variable with `NEXT_PUBLIC_`. That prefix would send the key to every browser that loads the page.

## Create the Next.js app

From an empty folder, create the app with the App Router, TypeScript, and Tailwind. The flags skip the prompts. There is no `src/` directory. Files in this guide live at the project root, next to `package.json`.

```bash
pnpm create next-app@latest ai-project-manager --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --turbopack
```

If the CLI still asks a question, answer it this way: TypeScript yes, ESLint yes, Tailwind yes, `src/` directory no, App Router yes, Turbopack yes, import alias `@/*`. Do not enable the React Compiler. Do not customize the alias.

Move into the project and start it:

```bash
cd ai-project-manager
pnpm dev
```

> **Checkpoint:** Open http://localhost:3000. You should see the default Next.js starter page. Stop this terminal with Ctrl+C before the next step. You will start it again after the environment file exists.

## Install dependencies

From `ai-project-manager`, install the packages this app uses:

```bash
pnpm add ai @ai-sdk/react @openrouter/ai-sdk-provider zod convex
```

Each package has one job:

- `ai` is the Vercel AI SDK. The route calls `streamText`, `tool`, and `isStepCount` from it.
- `@ai-sdk/react` provides `useChat`.
- `@openrouter/ai-sdk-provider` connects that SDK to OpenRouter. This v3 release targets AI SDK 7.
- `zod` validates tool arguments before `execute` runs.
- `convex` is the database client, the React hooks, and the backend functions.

Do not install an agent framework, LangChain, an ORM, or a second database. Convex is the backend. The AI SDK is the tool loop.

> **Note:** This guide was checked against `ai@7.0.113`, `@ai-sdk/react@4.0.116`, `@openrouter/ai-sdk-provider@3.1.0`, `zod@4.6.5`, and `convex@1.46.0`. On current AI SDK 7, a tool takes `inputSchema`, a loop stops with `stopWhen: isStepCount(...)`, and the model instructions field is `instructions`. Older posts use `parameters`, `maxSteps`, `stepCountIs`, and `system`. Do not start this app on those names.

## Set up Convex

Convex hosts the database and the query and mutation functions. The CLI creates a dev deployment, writes the generated types, and keeps them in sync while it runs.

Start it from the project root:

```bash
pnpm exec convex dev
```

That is the local package equivalent of `npx convex dev` in the [Convex Next.js quickstart](https://docs.convex.dev/quickstart/nextjs).

The first run is interactive:

1. A browser opens so you can log in with GitHub and approve the CLI.
2. Create a project when asked. Name it `ai-project-manager`. Choose the defaults for team and region.
3. Convex writes a `convex/` directory, generates `convex/_generated/`, and creates or updates `.env.local`.

Leave this terminal running. It uploads functions when you save files under `convex/`, and it regenerates the TypeScript API in `convex/_generated/`.

> **Checkpoint:** `.env.local` exists, and it contains `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`. The URL looks like `https://happy-animal-123.convex.cloud`, with your own deployment name. `convex/tsconfig.json` and `convex/_generated/api.d.ts` exist. Do not type those values yourself, and do not edit anything inside `convex/_generated/`.

> **Note:** The CLI may print "Convex AI files are not installed." Leave that alone. This app does not use Convex AI files or Convex Agent.

If Convex created a sample `convex/schema.ts` or other sample functions, you will replace the schema and add `convex/tasks.ts` in the next sections. Leave the generated folder alone.

You now need two terminals for the rest of the tutorial:

```text
Terminal 1    pnpm exec convex dev
Terminal 2    pnpm dev
```

Terminal 1 is the backend sync. Terminal 2 is the website. Stopping terminal 1 does not delete data, but new functions will not upload until you start it again.

## Environment variables

Open the `.env.local` Convex just wrote. Add your OpenRouter key as a new line. Leave the Convex lines exactly as the CLI wrote them.

```env .env.local
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site

OPENROUTER_API_KEY=your-key
```

The Convex lines are yours, not the placeholders above. Keep every line the CLI wrote. Current Convex also writes `NEXT_PUBLIC_CONVEX_SITE_URL` for HTTP actions. This app does not call that URL. Do not delete it.

`CONVEX_DEPLOYMENT` tells the CLI which dev deployment to sync. `NEXT_PUBLIC_CONVEX_URL` is the deployment URL. The React client and the server helpers `fetchQuery` and `fetchMutation` both read it. The `NEXT_PUBLIC_` prefix is required for the browser client. The URL identifies your deployment. It is not the OpenRouter secret.

`OPENROUTER_API_KEY` has no public prefix. Only the route handler reads it.

> **Checkpoint:** In terminal 2, start `pnpm dev` again. Next.js reads `.env.local` at startup. Saving the file while that server is already running does not update `process.env`.

## Project structure

You will add a handful of files. This is the whole app when you are done:

```text
app/
  api/
    chat/
      route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  assistant.tsx
  convex-client-provider.tsx
  task-list.tsx
convex/
  schema.ts
  tasks.ts
  _generated/
lib/
  ai.ts
.env.local
```

`convex/_generated/` is produced by `pnpm exec convex dev`. There is no repository layer. A tool's `execute` function calls a Convex function by its generated API reference.

## Define the task schema

Replace `convex/schema.ts` with the task table.

Convex documents already include `_id` and `_creationTime`. You do not add a `createdAt` field. A task is a title, a priority, and a completed flag. Priorities are the three strings `low`, `medium`, and `high`.

```ts convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    completed: v.boolean(),
  }),
});
```

There is no index. The only read is "the current tasks, newest first, at most 50." A table scan of a tutorial list is the honest query. Add an index later if you filter by user or by status.

> **Checkpoint:** The terminal running `pnpm exec convex dev` reports that it pushed the schema. If it reports a syntax error, the process is still running. Fix the file and save again.

## Build Convex functions

Create `convex/tasks.ts`.

`list` reads. `create` inserts a task that starts incomplete. `setCompleted` patches one task. Each function validates its arguments and returns a plain object. A tool that receives `undefined` cannot tell the model what happened.

`list` orders by `_creationTime` descending, so the newest task is first, and stops at 50 rows. The returned `id` is the document `_id`. Tools and the checkbox both use that id.

`create` trims the title and rejects an empty one. `setCompleted` loads the document with `ctx.db.get("tasks", id)` before patching it. Current Convex database calls take the table name first. If the document is already gone, the function returns `{ ok: false }` instead of pretending the write worked.

```ts convex/tasks.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

const taskResult = v.object({
  id: v.id("tasks"),
  title: v.string(),
  priority,
  completed: v.boolean(),
});

export const list = query({
  args: {},
  returns: v.array(taskResult),
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").order("desc").take(50);
    return tasks.map(function present(task) {
      return {
        id: task._id,
        title: task.title,
        priority: task.priority,
        completed: task.completed,
      };
    });
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    priority,
  },
  returns: taskResult,
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (title.length === 0) {
      throw new Error("Task title is required.");
    }

    const id = await ctx.db.insert("tasks", {
      title,
      priority: args.priority,
      completed: false,
    });

    return {
      id,
      title,
      priority: args.priority,
      completed: false,
    };
  },
});

export const setCompleted = mutation({
  args: {
    taskId: v.id("tasks"),
    completed: v.boolean(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      id: v.id("tasks"),
      title: v.string(),
      priority,
      completed: v.boolean(),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId);
    if (!task) {
      return {
        ok: false as const,
        error: "Task not found.",
      };
    }

    await ctx.db.patch("tasks", args.taskId, {
      completed: args.completed,
    });

    return {
      ok: true as const,
      id: task._id,
      title: task.title,
      priority: task.priority,
      completed: args.completed,
    };
  },
});
```

> **Checkpoint:** `pnpm exec convex dev` finishes a push without an error. In the [Convex dashboard](https://dashboard.convex.dev), open the dev deployment, then the `tasks` table. It exists and is empty. You will not insert rows by hand. The assistant and the checkbox do that.

This deployment has no authentication. Anyone who can load your dev URL can read and write tasks. That is acceptable for a tutorial on your own machine. It is not acceptable for a shared app. Authentication is listed under next improvements and is out of scope here.

## Add Convex to React

Create `components/convex-client-provider.tsx`.

`useQuery` and `useMutation` read the client from React context. `ConvexProvider` puts a `ConvexReactClient` there. The client connects to `NEXT_PUBLIC_CONVEX_URL`. This tutorial does not preload data on the server. The task list subscribes in the browser, which is the update path you want to see.

```tsx components/convex-client-provider.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is missing. Run pnpm exec convex dev, then restart pnpm dev.",
  );
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

Open `app/layout.tsx`. Keep the font and metadata `create-next-app` generated. Import the provider and wrap `{children}`:

```tsx app/layout.tsx
import { ConvexClientProvider } from "@/components/convex-client-provider";
```

```tsx app/layout.tsx
<ConvexClientProvider>{children}</ConvexClientProvider>
```

The first snippet is the import, placed with the other imports. The second replaces the bare `{children}` inside `<body>`.

## Build the reactive task list

Create `components/task-list.tsx`.

`useQuery(api.tasks.list)` stays subscribed. While the first result is in flight, the hook returns `undefined`. An empty list is `[]`, which is a real result. After a mutation, Convex sends the new list and this component rerenders. Nothing on the page calls the query again by hand.

The checkbox calls `setCompleted` through `useMutation`. The assistant will call that same mutation through a tool. Two callers, one function.

```tsx components/task-list.tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function TaskList() {
  const tasks = useQuery(api.tasks.list);
  const setCompleted = useMutation(api.tasks.setCompleted);

  return (
    <section className="space-y-4" aria-labelledby="task-list">
      <h2 id="task-list" className="text-lg font-medium">
        Tasks
      </h2>
      {tasks === undefined ? (
        <p className="text-neutral-500">Loading tasks.</p>
      ) : null}
      {tasks !== undefined && tasks.length === 0 ? (
        <p className="text-neutral-500">
          No tasks yet. Ask the assistant to add one.
        </p>
      ) : null}
      {tasks !== undefined && tasks.length > 0 ? (
        <ul className="space-y-2">
          {tasks.map(function renderTask(task) {
            return (
              <li key={task.id}>
                <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    aria-label={
                      task.completed
                        ? `Mark ${task.title} incomplete`
                        : `Mark ${task.title} complete`
                    }
                    onChange={function handleToggle(event) {
                      void setCompleted({
                        taskId: task.id,
                        completed: event.currentTarget.checked,
                      });
                    }}
                  />
                  <span
                    className={
                      task.completed ? "text-neutral-400 line-through" : ""
                    }
                  >
                    {task.title}
                  </span>
                  <span className="ml-auto text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {task.priority}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
```

The assistant creates tasks. This list does not have an "add task" form. The point of the page is that a sentence can become a mutation, and that the list hears about it through the subscription.

## Configure OpenRouter

Create `lib/ai.ts`. Import it only from the route handler.

`createOpenRouter({ apiKey })` builds a provider. `.chat(PROJECT_MANAGER_MODEL)` selects the chat model. The id is an OpenRouter id, `provider/model`.

```ts lib/ai.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const PROJECT_MANAGER_MODEL = "z-ai/glm-5.3-flash";

export function projectManagerModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }

  const openrouter = createOpenRouter({ apiKey });
  return openrouter.chat(PROJECT_MANAGER_MODEL);
}
```

GLM 5.3 Flash is the tool-calling model for this app because the OpenRouter model page lists tool calling, the provider already targets AI SDK 7, and the price stays low enough for a tutorial. This model keeps reasoning enabled. The first reply can pause for a moment before a tool status line appears. That pause is the model deciding, not a broken subscription.

## How tool calling works

The model fills in a request. Your server decides what the request is allowed to do.

For "Add a high-priority task to finish the landing page," a successful model turn contains a tool call shaped like this:

```json
{
  "toolName": "createTask",
  "input": {
    "title": "Finish the landing page",
    "priority": "high"
  }
}
```

The AI SDK validates `input` with the tool's Zod schema. Then it calls `execute` with the parsed object. `execute` calls `fetchMutation`, which runs the Convex mutation on your deployment. Convex returns `{ id, title, priority, completed }`. The SDK gives that object back to the model as the tool result. The model then writes the sentence the person sees.

If the model says "I added the task" and no tool result says the insert happened, the sentence is a guess. The instructions below forbid that guess. The database is still the thing you look at.

The model learns when to call a tool from the tool name, the description, the input schema, and the conversation. A vague description makes the model guess. These three descriptions tell it when the id is missing and when a write is allowed:

- `listTasks` reads the current tasks. Use it before an update when the person names a title and not an id.
- `createTask` creates one task after the person asks to add or create one.
- `setTaskCompleted` marks one existing task complete or incomplete. It needs the id from `listTasks`.

[Tool selection](/prompts/tool-selection-router) is the same idea as a prompt: pick one action, or none. [Safe tool calling](/prompts/safe-tool-calling-system) is the rule this route's instructions repeat in short form: do not invent a tool, and do not claim a write succeeded unless the tool result says so.

## Build the AI route

Create `app/api/chat/route.ts`.

The route reads UI messages, converts them with `convertToModelMessages`, and calls `streamText`. The tools run on the server inside `execute`. `fetchQuery` and `fetchMutation` come from `convex/nextjs`. They call your deployment with `NEXT_PUBLIC_CONVEX_URL` and the generated `api` object. You do not add an HTTP action, and you do not construct a Convex client in the browser from this file.

`stopWhen: isStepCount(5)` ends the loop after five model steps. One step can be a tool call. The next step sees that tool's result. Five steps is enough for "list, then update, then answer," including a retry. It is a bound, not an open-ended agent.

`taskId` arrives as a string because that is what the model can emit. The cast to `Id<"tasks">` satisfies TypeScript. Convex still validates the id with `v.id("tasks")`. A bad id or a deleted task becomes `{ ok: false, error }` so the model can say the update did not happen.

```ts app/api/chat/route.ts
import { fetchMutation, fetchQuery } from "convex/nextjs";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { projectManagerModel } from "@/lib/ai";

const prioritySchema = z.enum(["low", "medium", "high"]);

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response("Request body must be JSON.", { status: 400 });
  }

  const messages = (json as { messages?: UIMessage[] }).messages;
  if (!Array.isArray(messages)) {
    return new Response("Expected a messages array.", { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY || !process.env.NEXT_PUBLIC_CONVEX_URL) {
    return new Response(
      "OPENROUTER_API_KEY and NEXT_PUBLIC_CONVEX_URL must be set in .env.local. Restart pnpm dev after saving them.",
      { status: 500 },
    );
  }

  try {
    const result = streamText({
      model: projectManagerModel(),
      instructions: [
        "You help manage a task list stored in Convex.",
        "Use tools for every read and write. Do not claim a task was created or updated unless the tool result says so.",
        "When the user names a task by title, call listTasks before you update it, and use the returned id.",
        "If more than one task could match the title, ask which one. Do not pick.",
        "Create a task only when the user asks to add or create one.",
        "Keep the final reply to one or two sentences.",
      ].join("\n"),
      messages: await convertToModelMessages(messages),
      stopWhen: isStepCount(5),
      tools: {
        listTasks: tool({
          description:
            "Read the current task list. Use this before updating a task when the user refers to it by title instead of task id.",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = await fetchQuery(api.tasks.list, {});
            return { tasks };
          },
        }),
        createTask: tool({
          description:
            "Create a new project task after the user explicitly asks to add or create one.",
          inputSchema: z.object({
            title: z.string().trim().min(1).describe("The task title."),
            priority: prioritySchema.describe("low, medium, or high."),
          }),
          execute: async ({ title, priority }) => {
            return await fetchMutation(api.tasks.create, { title, priority });
          },
        }),
        setTaskCompleted: tool({
          description:
            "Mark an existing task complete or incomplete. Requires an exact task id, so call listTasks first when the user names a title.",
          inputSchema: z.object({
            taskId: z
              .string()
              .min(1)
              .describe("Task id returned by listTasks."),
            completed: z.boolean().describe("True when the task is done."),
          }),
          execute: async ({ taskId, completed }) => {
            try {
              return await fetchMutation(api.tasks.setCompleted, {
                taskId: taskId as Id<"tasks">,
                completed,
              });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Update failed.";
              return { ok: false as const, error: message };
            }
          },
        }),
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed.";
    console.error(error);
    return new Response(`Could not run the assistant. ${detail}`, {
      status: 500,
    });
  }
}
```

`toUIMessageStream({ stream: result.stream })` is how AI SDK 7 turns the model stream into the stream `useChat` reads. Do not call `result.toUIMessageStreamResponse()`. That older helper is not the one this route uses.

`listTasks` returns `{ tasks }` even when the list is empty. `createTask` returns the inserted id, title, priority, and `completed: false`. `setTaskCompleted` returns `ok: true` and the new completed flag, or `ok: false` and an error string.

## Multi-step tool use

One tool call is not enough when the model does not know the id.

```text
User: Mark the documentation task complete.

Step 1. The model calls listTasks.
Step 2. The tool result includes the matching task and its id.
Step 3. The model calls setTaskCompleted with that id and completed: true.
Step 4. The tool result says ok: true.
Step 5. The model answers: I marked Ship documentation complete.
```

The loop is iterative. The second call is allowed to use the first result. `isStepCount(5)` is the control that stops the loop if the model keeps calling tools. This is a bounded tool loop. It is not a framework that plans overnight work, stores memory, or runs after you close the page.

A single user message can also create two tasks. The model may call `createTask` twice, in one step or in sequence. Either way, each call is one insert. The lesson does not depend on the calls happening in parallel.

While those mutations run, the task list is still subscribed. The path is:

```text
tool execute
  -> Convex mutation
  -> document changes
  -> useQuery subscription
  -> TaskList rerenders
```

The route's JSON response is the assistant's text. It is not a signal that tells React to refetch tasks.

## Build the assistant UI

Create `components/assistant.tsx`.

`useChat` keeps messages in memory. `DefaultChatTransport` posts them to `/api/chat`. Create the transport once. `sendMessage({ text })` is the current call. `status` is `submitted` while the request is in flight and `streaming` while tokens arrive.

Tool parts use types such as `tool-createTask`. Render a short status line from the part type. Leave the raw arguments out of the page. The task list is the proof that a write happened.

```tsx components/assistant.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, type FormEvent } from "react";

function activityLabel(part: { type: string; state?: string }): string | null {
  const done = part.state === "output-available";
  const failed = part.state === "output-error";

  if (part.type === "tool-listTasks") {
    if (failed) {
      return "Could not read the task list";
    }
    return done ? "Read task list" : "Reading task list";
  }
  if (part.type === "tool-createTask") {
    if (failed) {
      return "Could not create the task";
    }
    return done ? "Created task" : "Creating task";
  }
  if (part.type === "tool-setTaskCompleted") {
    if (failed) {
      return "Could not update the task";
    }
    return done ? "Updated task" : "Updating task";
  }
  return null;
}

export function Assistant() {
  const [transport] = useState(function createTransport() {
    return new DefaultChatTransport({ api: "/api/chat" });
  });
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [draft, setDraft] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0 || isBusy) {
      return;
    }
    void sendMessage({ text });
    setDraft("");
  }

  return (
    <section className="space-y-4" aria-labelledby="assistant">
      <h2 id="assistant" className="text-lg font-medium">
        AI assistant
      </h2>
      <div className="space-y-4" aria-live="polite">
        {messages.map(function renderMessage(message) {
          return (
            <article key={message.id} className="space-y-1">
              <p className="text-sm font-medium text-neutral-500">
                {message.role === "user" ? "You" : "Assistant"}
              </p>
              {message.parts.map(function renderPart(part, index) {
                if (part.type === "text") {
                  return (
                    <p
                      key={`${message.id}-${index}`}
                      className="whitespace-pre-wrap leading-7"
                    >
                      {part.text}
                    </p>
                  );
                }
                const label = activityLabel(part);
                if (!label) {
                  return null;
                }
                return (
                  <p
                    key={`${message.id}-${index}`}
                    className="text-sm text-neutral-500"
                  >
                    {label}
                  </p>
                );
              })}
            </article>
          );
        })}
      </div>
      <form
        className="space-y-3"
        onSubmit={function onSubmit(event) {
          handleSubmit(event);
        }}
      >
        <label className="block space-y-2" htmlFor="message">
          <span className="text-sm font-medium">Message</span>
          <input
            id="message"
            name="message"
            value={draft}
            onChange={function handleDraft(event) {
              setDraft(event.target.value);
            }}
            disabled={isBusy}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-500"
            placeholder="Add a high-priority task to finish the landing page."
          />
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {isBusy ? "Sending..." : "Send"}
        </button>
      </form>
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          The request failed. Check the terminal running pnpm dev.
        </p>
      ) : null}
    </section>
  );
}
```

Replace `app/page.tsx` so the list and the assistant sit together. On a narrow screen they stack. From the `lg` breakpoint up, they sit in two columns.

```tsx app/page.tsx
"use client";

import { Assistant } from "@/components/assistant";
import { TaskList } from "@/components/task-list";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          AI Project Manager
        </h1>
        <p className="text-neutral-600">
          Tasks live in Convex. The assistant changes them by requesting tools.
        </p>
      </header>
      <div className="grid items-start gap-10 lg:grid-cols-2">
        <TaskList />
        <Assistant />
      </div>
    </main>
  );
}
```

The page is a client component because it renders two client components and nothing needs to be fetched on the server. The Convex provider in the layout is what makes `useQuery` legal here.

> **Checkpoint:** With both terminals running, open http://localhost:3000. You should see "AI Project Manager," an empty task list, and a message box. The list should say "No tasks yet" after a brief "Loading tasks." If the page throws before that, the provider did not get `NEXT_PUBLIC_CONVEX_URL`. Restart terminal 2.

## Try the app

Use these messages in order. Watch the task list, not only the assistant text. The list is the database.

### Create one task

Send:

```text
Add a high-priority task to finish the landing page.
```

The assistant should show "Creating task," then "Created task," then a short confirmation. The list should gain "Finish the landing page" with priority `high` and an empty checkbox. You did not refresh, and the route did not return the task list to the page.

### Create two tasks

Send:

```text
Add a medium-priority task called Write documentation and a low-priority task called Clean up CSS.
```

Both rows should appear. The model may call `createTask` twice in one step or in two steps. Either result is the same two inserts.

### Look up a task, then update it

Send:

```text
Mark the documentation task complete.
```

This is the important one. The model does not know the Convex id. It should read the task list, choose "Write documentation," call `setTaskCompleted`, and then confirm. The checkbox becomes checked through the subscription.

The terminal running `pnpm dev` is not where you see the tool names. They appear as the status lines in the assistant. If you want the raw call, the Convex dashboard logs show `tasks:list` and then `tasks:setCompleted`.

### Ask what is left

Send:

```text
What tasks are still incomplete?
```

The assistant should call `listTasks` and name the tasks that are not complete. It should not invent a task that is absent from the list.

### Ambiguous titles

Add a second documentation-like task, for example "Document the API." Then send "Mark the documentation task complete" again. Two titles can match. The assistant should ask which one you mean. It should not flip an arbitrary checkbox. The instruction and the tool description are the whole disambiguation strategy in this tutorial.

You can also click a checkbox. That calls `setCompleted` directly. The row updates, and the assistant is not involved.

## Common errors

**Missing `OPENROUTER_API_KEY`.** The route returns 500 and names the variable. Add it to `.env.local` without removing the Convex lines. Restart terminal 2.

**`NEXT_PUBLIC_CONVEX_URL` is missing.** The provider throws, or `fetchQuery` throws, because `pnpm exec convex dev` has not written `.env.local` or terminal 2 was started before that file existed. Run the Convex command, then restart `pnpm dev`.

**`convex/_generated/api` cannot be imported.** `pnpm exec convex dev` has not generated it yet. Start that command and wait until the first push succeeds. Do not hand-write the generated folder.

**Only one terminal is running.** `pnpm dev` alone serves the page and cannot upload new Convex functions. `pnpm exec convex dev` alone syncs the backend and does not serve http://localhost:3000. You want both.

**The task list stays on "Loading tasks."** The Convex dev process is stopped, or the URL in `.env.local` does not match the deployment that process is syncing. Start terminal 1 and confirm the URL.

**The model replies in prose and the list does not change.** The model described a write instead of calling a tool. Check that the route passes `tools` and `stopWhen: isStepCount(5)`, and that the model id is `z-ai/glm-5.3-flash`. A model page that does not list `tools` will not drive this app.

**OpenRouter returns 402 or an authentication error.** The key is wrong, or the credit balance is empty. Create a new key or add credits, then restart terminal 2.

**Invalid task id or "Task not found."** `listTasks` returned an id, and the document was removed before the update. The tool result is `{ ok: false }`. The assistant should admit that. It should not say the checkbox changed.

**Zod rejects the tool input.** The model omitted `priority` or sent a priority outside `low`, `medium`, and `high`. The SDK does not call `execute`. The status line reports a failure. Say the priority in the next message.

**`useQuery` is undefined forever, or a hook error mentions ConvexProvider.** The provider is not wrapped around the page in `app/layout.tsx`.

## What you learned

Tool calling is structured model output that names an action and its arguments. Application code owns the action. Zod checks the arguments at the AI boundary. Convex checks them again at the database boundary.

A read tool and a write tool match a query and a mutation. When the model lacks an id, it can read first and write second, inside a step limit. `useQuery` is a live subscription, so the task list can change without the chat stream telling it to. A tool result should say what happened, and the assistant should not claim a write that the result does not confirm.

[Prompting fundamentals](/learn/prompting-fundamentals) still apply to the short instructions and to the tool descriptions. [Evals](/learn/evals) are how you would later check that "mark the documentation task complete" still lists, then updates, after you change a description.

## Next improvements

Add `setTaskPriority` only when you want "Make the documentation task high priority." It is the same shape as `setTaskCompleted`: list first when you have a title, then patch one field. A fourth tool is optional. It does not teach a new idea.

Add Convex authentication when someone other than you can open the deployment. Until then, treat the dev URL as private.

Save the chat transcript only if you need it after a refresh. This page keeps messages in `useChat` memory on purpose, so you can see that chat state and task state are different stores.

A fixed workflow is a different design. You would call `list` and then `setCompleted` in code you wrote, and the model would only extract a title. Reach for that when the path never changes. This guide lets the model choose the path because the id is unknown until the list comes back.

Convex Agent, background jobs, scheduled functions, and push notifications are separate products. They hide the tool loop this tutorial is trying to show.

## Related PromptMarket content

[Tool calling](/learn/tool-calling) is the request the model emits. [Agents and actions](/learn/agents) is the rule that your code carries the request out. [Agentic loops](/learn/agentic-loops) is the bounded sequence of list, then update, then answer. [Prompting fundamentals](/learn/prompting-fundamentals) is the shape of the instructions and the tool descriptions. [Evals](/learn/evals) is how you would lock the multi-step behavior in place.
