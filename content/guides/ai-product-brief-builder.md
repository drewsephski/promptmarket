---
title: Build an AI Product Brief Generator
description: Turn a product idea into a validated brief and save it to Neon.
difficulty: beginner
stack:
  - Next.js
  - TypeScript
  - Vercel AI SDK
  - OpenRouter
  - Zod
  - Neon
  - Drizzle
concepts:
  - structured-outputs
  - openrouter
  - neon
  - drizzle
  - persistence
estimatedTime: 60 minutes
order: 1
verifiedAt: 2026-09-23
testedWith:
  next: "16"
  ai: "7"
  "@openrouter/ai-sdk-provider": "3"
  zod: "4"
  drizzle-orm: "0.45"
  "@neondatabase/serverless": "1"
prerequisites:
  - Node.js 22 or newer
  - pnpm 10 or newer
  - A code editor
  - An OpenRouter account
  - A Neon account
whatYouBuild:
  - A form that sends a product idea to an OpenRouter model
  - A validated TypeScript object rendered as normal React
  - A Neon table of briefs you have already generated
whatYouLearn:
  - How a Next.js route calls a model without becoming a chatbot
  - How the Vercel AI SDK keeps application code off a provider's raw HTTP API
  - How structured output and Zod turn a response into a typed object
  - How Drizzle stores that object in Neon Postgres
architecture:
  - User input
  - AI model
  - Structured output
  - Validated object
  - React UI
  - Postgres
relatedTopics:
  - structured-data
  - structured-outputs
  - prompting-fundamentals
  - evals
relatedPrompts:
  - structured-data-extractor
  - json-output-system
verification:
  - A product idea returns a brief that matches the schema
  - Invalid model output is rejected instead of saved
  - The OpenRouter key stays server-side
evidence:
  docs:
    - package: ai
      library: Vercel AI SDK
      reason: Plan uses structured output from a chat model
    - package: "@openrouter/ai-sdk-provider"
      library: OpenRouter AI SDK Provider
      reason: Plan calls an OpenRouter chat model
    - package: zod
      library: Zod
      reason: Plan validates model output before saving it
    - package: drizzle-orm
      library: Drizzle ORM
      reason: Plan stores the brief in Postgres
    - package: "@neondatabase/serverless"
      library: Neon
      reason: Plan persists briefs in Neon Postgres
  references:
    - type: github
      repo: vercel/ai
      reason: Official AI SDK examples for structured generation
---

## What we're building

You will build a small product-brief app and run it at http://localhost:3000.

The page has one job. You describe a product or feature, click Generate brief, and the app returns a brief with a summary, target users, features, risks, acceptance criteria, and implementation tasks. It then saves that brief and lists the ten most recent ones.

This is not a chatbot. The model is one step in a normal request. The shape of the result is decided by your schema, and React renders that object with ordinary components.

Asking a model to "reply in JSON" and then searching the text for `{` is a different, worse design. The model can add a preamble, drop a key, or return a string where you needed a list. Structured output asks for a specific object. Zod checks that object before your UI or database ever sees it. A bad response becomes an error you can show, not a half-parsed paragraph.

The boxes in the architecture diagram are the whole app: a person types an idea, a model drafts a brief, the SDK validates it, React renders it, and Postgres keeps it.

## What you'll learn

You already know enough React to follow this. The new pieces are how an AI feature sits inside a normal Next.js app.

Next.js is both the page and the server. The form is a client component. The route handler and the database client run only on the server, which is where the API key is allowed to exist.

Environment variables in `.env.local` are the API key and the database URL. Next.js loads that file when the dev server starts. A name that starts with `NEXT_PUBLIC_` is shipped to the browser. These two values must not use that prefix.

OpenRouter is the account that holds your key and routes a request to a model. The Vercel AI SDK is the library your route calls. Application code depends on the SDK, not on a handwritten `fetch` to a provider URL, so the model id can change without rewriting the route.

Structured output is the SDK feature that constrains the model to an object. Zod is the schema for that object and the validation step after the model returns. [Structured outputs](/learn/structured-outputs) is the concept. This guide is the app around it.

Neon is hosted Postgres. Drizzle is the TypeScript layer that defines a table and runs SQL. A migration is the SQL file that creates the table. You generate it from the schema, then apply it to Neon.

The last idea is persistence. Generate, show, and save happen in one request. Refreshing the page reads the rows back. The model call is the only probabilistic step. Everything after validation is ordinary full-stack code.

## Prerequisites

Install these before you create the app:

- [Node.js 22](https://nodejs.org) or newer. The OpenRouter provider used here (`@openrouter/ai-sdk-provider` v3) requires Node.js 22, and AI SDK 7, which that provider targets, declares the same engine. This is a requirement of that integration, not of every AI library.
- [pnpm 10](https://pnpm.io/installation) or newer.
- A code editor. Any editor that can open a folder is enough.
- An [OpenRouter](https://openrouter.ai) account. You will create an API key and need a small credit balance.
- A [Neon](https://console.neon.tech) account. The free project is enough.

You do not need a local Postgres install, Docker, or an OpenAI account.

## Create your OpenRouter API key

OpenRouter sells access to many models through one key. This app will call one inexpensive model, `z-ai/glm-5.3-flash` (GLM 5.3 Flash). You can change that id later.

1. Open [openrouter.ai](https://openrouter.ai) and create an account, or sign in.
2. Open [API keys](https://openrouter.ai/settings/keys).
3. Choose **Create**. Name the key `ai-product-brief`.
4. Copy the key immediately. OpenRouter shows the full secret once.
5. Open [Credits](https://openrouter.ai/settings/credits) and add a small balance if the account has none. A few brief generations cost well under a dollar on the model this guide uses. Requests fail when the balance is empty.

Treat the key like a password. You will paste it into `.env.local` in a moment. Do not put it in source code, and do not prefix the variable with `NEXT_PUBLIC_`. That prefix would send the key to every browser that loads the page.

## Create the Neon database

Neon hosts Postgres so this app can save briefs without a database running on your machine.

A connection string is the address of that database in one line: who you are, the password, which server to talk to, and which database name to open. It is also a secret, because anyone who has it can read and write your tables.

1. Open the [Neon console](https://console.neon.tech) and sign in.
2. Choose **New project**.
3. Name the project `ai-product-brief`. Leave the Postgres version and region on the defaults Neon offers, then create the project.
4. When the project opens, choose **Connect**.
5. Leave **Connection pooling** turned on. Neon copies a pooled URL by default. The hostname contains `-pooler`.
6. Copy the full connection string. It looks like this, with your own user, password, and host:

```text
postgresql://USER:PASSWORD@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Read it from left to right. `postgresql://` is the protocol. `USER` and `PASSWORD` authenticate you. The host ending in `neon.tech` is the server. `neondb` is the database name Neon created. `sslmode=require` means the connection must be encrypted. If the copied URL also includes `channel_binding=require`, keep it.

The `-pooler` host sends TCP clients through PgBouncer, which is what "connection pooling" means in the dialog. This app talks to Neon with the HTTP driver, and Drizzle Kit uses the same URL for migrations. Keep the pooled string Neon copied. If a later migration command fails because of the pooler, the common-errors section shows how to switch to the direct URL for that one command.

## Create the Next.js app

From an empty folder, create the app with the App Router, TypeScript, and Tailwind. The flags skip the prompts. There is no `src/` directory. Files in this guide live at the project root, next to `package.json`.

```bash
pnpm create next-app@latest ai-product-brief --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --turbopack
```

If the CLI still asks a question, answer it this way: TypeScript yes, ESLint yes, Tailwind yes, `src/` directory no, App Router yes, Turbopack yes, import alias `@/*`. Do not enable the React Compiler. Do not customize the alias.

Move into the project and start it:

```bash
cd ai-product-brief
pnpm dev
```

> **Checkpoint:** Open http://localhost:3000. You should see the default Next.js starter page. Leave this terminal running. Later, when you change `.env.local`, you will stop it with Ctrl+C and run `pnpm dev` again.

## Install dependencies

Stop here and install every package the app uses. Run this from `ai-product-brief`:

```bash
pnpm add ai @openrouter/ai-sdk-provider zod drizzle-orm @neondatabase/serverless && pnpm add -D drizzle-kit dotenv
```

Each package has one job:

- `ai` is the Vercel AI SDK. The route calls `generateText` from it.
- `@openrouter/ai-sdk-provider` connects that SDK to OpenRouter. This release targets AI SDK 7.
- `zod` describes and validates the brief.
- `drizzle-orm` defines the table and runs queries.
- `@neondatabase/serverless` is the HTTP driver Drizzle uses to reach Neon.
- `drizzle-kit` generates and applies the migration.
- `dotenv` loads `.env.local` for Drizzle Kit. Next.js loads that file on its own.

> **Note:** This guide was checked against `ai@7.0.113`, `@openrouter/ai-sdk-provider@3.1.0`, `zod@4.6.5`, `drizzle-orm@0.45.3`, `@neondatabase/serverless@1.1.0`, `drizzle-kit@0.31.11`, and `dotenv@18.0.3`.

## Environment variables

In the project root, create `.env.local`. `create-next-app` already gitignores `.env*`, so this file stays off GitHub.

Paste your real key and connection string after the equals signs. No quotes.

```env .env.local
OPENROUTER_API_KEY=
DATABASE_URL=
```

`OPENROUTER_API_KEY` is the secret you copied from OpenRouter. `DATABASE_URL` is the Neon connection string. Neither name starts with `NEXT_PUBLIC_`, so the browser bundle does not receive them. Only server code, the route handler and Drizzle, reads them.

> **Checkpoint:** Stop the dev server with Ctrl+C, then start it again with `pnpm dev`. Next.js reads `.env.local` at startup. Saving the file while the server is already running does not update `process.env`.

## Project structure

You will add a handful of files. This is the whole app when you are done:

```text
app/
  api/
    generate/
      route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  brief-form.tsx
  brief-list.tsx
  product-brief.tsx
db/
  index.ts
  schema.ts
lib/
  ai.ts
  brief.ts
drizzle.config.ts
.env.local
```

There is no repository layer and no extra service object. The route validates input, calls the model, and saves the row. The page reads recent rows and renders them.

## Configure OpenRouter

Create `lib/ai.ts`. This file is imported only from the route, which runs on the server.

The AI SDK is the interface the rest of the app sees: `generateText`, a model object, and a schema. OpenRouter is how that model object actually reaches GLM 5.3 Flash. Your route should not build an OpenRouter HTTP request by hand.

`createOpenRouter({ apiKey })` makes a provider with your key. `.chat(PRODUCT_BRIEF_MODEL)` picks a chat model. The id is an OpenRouter model id, `provider/model`, not a bare model name.

`z-ai/glm-5.3-flash` is inexpensive and supports structured output. To try another one later, change `PRODUCT_BRIEF_MODEL`. Look up the id on the [OpenRouter models page](https://openrouter.ai/models). `openai/gpt-4.1-mini` is another small model that works with the same code.

```ts lib/ai.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const PRODUCT_BRIEF_MODEL = "z-ai/glm-5.3-flash";

export function productBriefModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }

  const openrouter = createOpenRouter({ apiKey });
  return openrouter.chat(PRODUCT_BRIEF_MODEL);
}
```

The helper throws if the key is missing. The route catches that and returns JSON, so the page can show the message instead of a blank failure.

## Define the product brief

Create `lib/brief.ts`.

This schema is the contract between the model and the rest of the program. We are not asking the model to please return JSON and then parsing whatever comes back. We are defining the object the application expects. The SDK uses the schema twice: once to tell the model the shape, and again to validate the result. `.describe()` is the field's meaning, which the model needs because the key names alone are not instructions.

On current AI SDK 7, structured output is `generateText` with `output: Output.object({ schema })`. The validated value is `output`. Older posts show `generateObject` and a result named `object`. That function is the previous API. Do not start this app on it. The system-instruction option is `instructions`, not `system`.

```ts lib/brief.ts
import { z } from "zod";

export const productBriefSchema = z.object({
  summary: z
    .string()
    .describe("Two or three sentences on what the product is."),
  targetUsers: z.array(z.string()).describe("Who the product is for."),
  coreFeatures: z
    .array(z.string())
    .describe("The smallest set of features for a first version."),
  risks: z.array(z.string()).describe("Product or technical risks."),
  acceptanceCriteria: z
    .array(z.string())
    .describe("Observable checks that the first version works."),
  implementationTasks: z
    .array(z.string())
    .describe("Ordered engineering tasks to build the first version."),
});

export type ProductBrief = z.infer<typeof productBriefSchema>;
```

`ProductBrief` is inferred from the schema, so the React props and the database column use the same type. You will not maintain a second hand-written interface.

## Build the generation endpoint

Create `app/api/generate/route.ts`. This first version returns the brief and does not save it. You will replace the file after the database exists.

A request moves through six steps. The handler reads JSON. Zod rejects an empty or oversized idea. The handler refuses to call the model when the API key is missing. `generateText` sends the idea and the schema through OpenRouter. Zod validation inside the SDK either returns a `ProductBrief` or throws. The handler returns that object as JSON, or a useful error.

```ts app/api/generate/route.ts
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { productBriefModel } from "@/lib/ai";
import { productBriefSchema } from "@/lib/brief";

const generateRequestSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(1, "Describe a product idea first.")
    .max(2000, "Keep the idea under 2000 characters."),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid idea." },
      { status: 400 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      {
        error:
          "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  try {
    const { output } = await generateText({
      model: productBriefModel(),
      instructions: [
        "You turn a product or feature idea into a practical brief for a software team.",
        "Use only what the idea supports.",
        "When the idea is vague, state reasonable assumptions inside the summary instead of inventing fake research.",
        "Keep every list item short enough to scan.",
      ].join(" "),
      prompt: parsed.data.idea,
      output: Output.object({
        schema: productBriefSchema,
      }),
    });

    if (!output) {
      return NextResponse.json(
        { error: "The model did not return a product brief." },
        { status: 502 },
      );
    }

    return NextResponse.json({ brief: output });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json(
      {
        error:
          "Could not generate a brief. Check the API key, model name, and OpenRouter credits.",
        detail,
      },
      { status: 500 },
    );
  }
}
```

> **Checkpoint:** With `pnpm dev` running, send one idea from another terminal:

```bash
curl -s http://localhost:3000/api/generate -H "content-type: application/json" -d '{"idea":"A shared grocery list for roommates"}'
```

You should get JSON with a `brief` object. `summary` is a string. `targetUsers`, `coreFeatures`, `risks`, `acceptanceCriteria`, and `implementationTasks` are arrays of strings. You should not get a chat transcript.

Then send an empty idea:

```bash
curl -s -i http://localhost:3000/api/generate -H "content-type: application/json" -d '{"idea":"  "}'
```

The status is 400 and the body says to describe a product idea first.

## Build the UI

The page should render that object with React, not ask the model to invent markup. Components that expect `targetUsers` to be a list stay predictable when you change the prompt. Generated HTML would not.

Replace `app/globals.css` with:

```css app/globals.css
@import "tailwindcss";

:root {
  --background: #fafafa;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
}
```

In `app/layout.tsx`, replace only the `metadata` export. Leave the fonts and `LayoutProps` as `create-next-app` wrote them.

```ts
export const metadata: Metadata = {
  title: "AI Product Brief Builder",
  description: "Turn a product idea into a structured brief.",
};
```

Create `components/product-brief.tsx`:

```tsx components/product-brief.tsx
import type { ProductBrief } from "@/lib/brief";

interface ProductBriefViewProps {
  brief: ProductBrief;
}

function BriefListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-500">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map(function renderItem(item, index) {
          return <li key={`${title}-${index}`}>{item}</li>;
        })}
      </ul>
    </section>
  );
}

export function ProductBriefView({ brief }: ProductBriefViewProps) {
  return (
    <article className="space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
      <section>
        <h2 className="text-sm font-medium text-neutral-500">
          Product summary
        </h2>
        <p className="mt-2 text-base leading-7">{brief.summary}</p>
      </section>
      <BriefListSection title="Target users" items={brief.targetUsers} />
      <BriefListSection title="Core features" items={brief.coreFeatures} />
      <BriefListSection title="Risks" items={brief.risks} />
      <BriefListSection
        title="Acceptance criteria"
        items={brief.acceptanceCriteria}
      />
      <BriefListSection
        title="Implementation tasks"
        items={brief.implementationTasks}
      />
    </article>
  );
}
```

Create `components/brief-form.tsx`. It is a client component because it holds the textarea, the pending request, and the error. After a successful response it calls `router.refresh()`. That does nothing visible yet. When the page later reads from Neon, the same call reloads the history.

```tsx components/brief-form.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProductBrief } from "@/lib/brief";
import { ProductBriefView } from "./product-brief";

export function BriefForm() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [brief, setBrief] = useState<ProductBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const payload = (await response.json()) as {
        error?: string;
        detail?: string;
        brief?: ProductBrief;
      };

      if (!response.ok || !payload.brief) {
        setBrief(null);
        setError(
          payload.detail ?? payload.error ?? "Could not generate a brief.",
        );
        return;
      }

      setBrief(payload.brief);
      router.refresh();
    } catch {
      setBrief(null);
      setError("Could not reach the server.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        onSubmit={function onSubmit(event) {
          void handleSubmit(event);
        }}
      >
        <label className="block space-y-2" htmlFor="idea">
          <span className="text-sm font-medium">Describe your idea</span>
          <textarea
            id="idea"
            name="idea"
            value={idea}
            onChange={function handleChange(event) {
              setIdea(event.target.value);
            }}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-500"
            placeholder="Build an app for roommates to track utility bills..."
          />
        </label>
        <button
          type="submit"
          disabled={isGenerating}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {isGenerating ? "Generating..." : "Generate brief"}
        </button>
      </form>
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {brief ? <ProductBriefView brief={brief} /> : null}
    </div>
  );
}
```

Replace `app/page.tsx` with:

```tsx app/page.tsx
import { BriefForm } from "@/components/brief-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          AI Product Brief Builder
        </h1>
        <p className="text-neutral-600">
          Turn a product idea into a structured brief and save it to Postgres.
        </p>
      </header>
      <BriefForm />
    </main>
  );
}
```

> **Checkpoint:** Refresh http://localhost:3000. The starter page is gone. Paste `Build a web app that helps roommates track utility bills, split costs, and see who has paid.` and click Generate brief. The button reads Generating, then the page shows a summary and the five lists. Clear the textarea, submit again, and the page shows the empty-idea error. The previous brief disappears because nothing has been saved yet.

## Set up Neon and Drizzle

The brief is one object that the app always reads together. One `jsonb` column stores that object. Separate columns for every array would make the schema louder without making the queries more useful. `idea` and `summary` stay normal text columns so the history list can show them without opening the JSON. `summary` is duplicated on purpose: it is also inside `content`.

Create `db/schema.ts`:

```ts db/schema.ts
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ProductBrief } from "../lib/brief";

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  idea: text("idea").notNull(),
  summary: text("summary").notNull(),
  content: jsonb("content").$type<ProductBrief>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

Create `db/index.ts`. `drizzle(url)` is the Neon HTTP driver. Each call checks `DATABASE_URL` and opens a short-lived client. That fits a route handler better than a process-wide TCP pool.

```ts db/index.ts
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { ProductBrief } from "../lib/brief";
import { briefs } from "./schema";

export type StoredBrief = {
  id: string;
  idea: string;
  summary: string;
  content: ProductBrief;
  createdAt: string;
};

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local and restart the dev server.",
    );
  }

  return drizzle(url);
}

function toStored(row: {
  id: string;
  idea: string;
  summary: string;
  content: ProductBrief;
  createdAt: Date;
}): StoredBrief {
  return {
    id: row.id,
    idea: row.idea,
    summary: row.summary,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveBrief(input: {
  idea: string;
  brief: ProductBrief;
}): Promise<StoredBrief> {
  const rows = await database()
    .insert(briefs)
    .values({
      idea: input.idea,
      summary: input.brief.summary,
      content: input.brief,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("The database did not return the saved brief.");
  }

  return toStored(row);
}

export async function listBriefs(): Promise<StoredBrief[]> {
  const rows = await database()
    .select()
    .from(briefs)
    .orderBy(desc(briefs.createdAt))
    .limit(10);

  return rows.map(function mapRow(row) {
    return toStored(row);
  });
}
```

Create `drizzle.config.ts` in the project root. Drizzle Kit does not use Next.js to load environment files, so this config loads `.env.local` itself.

```ts drizzle.config.ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
```

Generate the migration, then apply it. Run both from the project root:

```bash
pnpm drizzle-kit generate
```

```bash
pnpm drizzle-kit migrate
```

> **Checkpoint:** `generate` writes `drizzle/0000_<words>.sql`. The words in the filename are random. Open that file. It should create a `briefs` table with `id`, `idea`, `summary`, `content` as `jsonb`, and `created_at`. `migrate` applies that SQL to the database in `DATABASE_URL`. If migrate prints a connection error, use the common-errors section before continuing. Keep the `drizzle` folder. It is the history of the schema.

## Save briefs after generation

Generating and saving in one request avoids a second "save" API. The brief on screen is the brief that was stored. If the model call fails, nothing is written. If the insert fails, the page shows the error and does not pretend the brief was kept.

Replace `app/api/generate/route.ts` with:

```ts app/api/generate/route.ts
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveBrief } from "@/db";
import { productBriefModel } from "@/lib/ai";
import { productBriefSchema } from "@/lib/brief";

const generateRequestSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(1, "Describe a product idea first.")
    .max(2000, "Keep the idea under 2000 characters."),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid idea." },
      { status: 400 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      {
        error:
          "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  try {
    const { output } = await generateText({
      model: productBriefModel(),
      instructions: [
        "You turn a product or feature idea into a practical brief for a software team.",
        "Use only what the idea supports.",
        "When the idea is vague, state reasonable assumptions inside the summary instead of inventing fake research.",
        "Keep every list item short enough to scan.",
      ].join(" "),
      prompt: parsed.data.idea,
      output: Output.object({
        schema: productBriefSchema,
      }),
    });

    if (!output) {
      return NextResponse.json(
        { error: "The model did not return a product brief." },
        { status: 502 },
      );
    }

    const saved = await saveBrief({
      idea: parsed.data.idea,
      brief: output,
    });

    return NextResponse.json({
      id: saved.id,
      idea: saved.idea,
      brief: saved.content,
      createdAt: saved.createdAt,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json(
      {
        error:
          "Could not generate a brief. Check the API key, model name, OpenRouter credits, and database connection.",
        detail,
      },
      { status: 500 },
    );
  }
}
```

The new steps after validation are `saveBrief`, then a JSON body that includes the saved `brief` plus `id` and `createdAt`. The form already reads `payload.brief`, so the UI does not need a new field.

> **Checkpoint:** Generate the roommate utility-bill idea again. The brief still renders. In the Neon console, open the SQL editor and run `select idea, summary, created_at from briefs order by created_at desc limit 5;`. The row you just created is there.

## Show previous briefs

Create `components/brief-list.tsx`. It renders the idea, the summary, and the time. There is no edit, delete, or pagination. Ten rows is enough to show that a read is just a query.

```tsx components/brief-list.tsx
import type { StoredBrief } from "@/db";

interface BriefListProps {
  briefs: StoredBrief[];
}

export function BriefList({ briefs }: BriefListProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Previous briefs</h2>
      {briefs.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Saved briefs will show up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {briefs.map(function renderBrief(brief) {
            return (
              <li
                key={brief.id}
                className="rounded-lg border border-neutral-200 bg-white p-4"
              >
                <p className="text-sm text-neutral-500">
                  {new Date(brief.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 font-medium">{brief.idea}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  {brief.summary}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

Replace `app/page.tsx` with the version that loads those rows on the server. `force-dynamic` keeps the page from being cached at build time, because the list depends on the database at request time.

```tsx app/page.tsx
import { BriefForm } from "@/components/brief-form";
import { BriefList } from "@/components/brief-list";
import { listBriefs } from "@/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const briefs = await listBriefs();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          AI Product Brief Builder
        </h1>
        <p className="text-neutral-600">
          Turn a product idea into a structured brief and save it to Postgres.
        </p>
      </header>
      <BriefForm />
      <BriefList briefs={briefs} />
    </main>
  );
}
```

The form's `router.refresh()` now re-renders this server component after each successful generation, so the new row shows up without a full browser reload.

> **Checkpoint:** Refresh http://localhost:3000. Previous briefs lists the row you saved. Generate a second idea. The new brief appears at the top of the list.

## Follow a request through the app

```text
Browser
  ↓ POST /api/generate
OpenRouter via the AI SDK
  ↓ validated product brief
Neon
  ↓ router.refresh()
React UI
```

The browser only sends the idea. It never sees the API key or the connection string.

`/api/generate` is the server boundary. It rejects bad input before spending a model call.

OpenRouter, through the AI SDK, is the model boundary. `instructions` and the Zod schema tell the model what a brief is. `output` is either a `ProductBrief` or a failure.

Neon is the persistence boundary. Drizzle inserts one row and, on the next page render, selects the latest ten.

React is the display boundary. `ProductBriefView` maps arrays to lists. It does not interpret a blob of model text.

## Test the app

Use these two ideas.

First:

> Build a web app that helps roommates track utility bills, split costs, and see who has paid.

You should see a summary about roommates and shared bills, users that include roommates, features about amounts and who has paid, at least one risk, and a short task list. Previous briefs gains a row.

Second, replace the textarea with:

> A browser extension that summarizes the terms of service on the page you are reading.

The new brief should be about reading a legal page, not about utility bills. Both rows remain after you refresh the browser.

Then clear the textarea and click Generate brief. The page shows "Describe a product idea first." The list does not gain an empty row.

## Common errors

**Missing `OPENROUTER_API_KEY`.** The page or curl body says the key is not set. Put the key in `.env.local`, with no `NEXT_PUBLIC_` prefix and no quotes, then restart `pnpm dev`.

**Invalid model.** `detail` mentions the model, "no endpoints", or a 404 from OpenRouter. `PRODUCT_BRIEF_MODEL` in `lib/ai.ts` must be a current id from the OpenRouter models list, including the provider prefix.

**No OpenRouter credits.** `detail` mentions credits, a 402, or an insufficient balance. Add credits in the OpenRouter dashboard and try again. The key can be valid and still have nothing to spend.

**Missing `DATABASE_URL`.** The error names `DATABASE_URL`. Paste the Neon string into `.env.local` and restart the dev server.

**Migration not applied.** Postgres says `relation "briefs" does not exist`. Run `pnpm drizzle-kit migrate` from the project root and look for the `drizzle/0000_*.sql` file from `generate`.

**Environment changes ignored.** You edited `.env.local` and the old error remains. Next.js keeps the environment of the running process. Ctrl+C, then `pnpm dev`.

**The route returns 500.** Read `detail` in the red box, and read the terminal that is running `pnpm dev`. The status means the handler caught a failure. The detail is the useful part.

**Schema mismatch.** You changed `productBriefSchema` after rows already exist. Old `jsonb` values can miss a new key. For this tutorial, change the schema before you care about old rows, or delete the old rows in the Neon SQL editor with `delete from briefs;`.

**Database connection errors.** `password authentication failed`, `ENOTFOUND`, or a fetch failure means the connection string is wrong or incomplete. Open Connect in Neon and copy it again. Do not wrap it in quotes. If `pnpm drizzle-kit migrate` fails on the pooled host, turn Connection pooling off, copy the direct URL (the hostname has no `-pooler`), put that in `DATABASE_URL`, run migrate, then put the pooled URL back and restart the dev server. If a driver rejects `channel_binding`, delete `&channel_binding=require` from the URL.

## What you learned

The AI SDK is the boundary between your route and a provider. OpenRouter can change models without a new HTTP client in the app.

Structured output lets the model participate in a typed flow. The lesson in [structured outputs](/learn/structured-outputs) is the same rule this route enforces: the result is data, or the call failed.

Zod is the check at that boundary. Provider-side structure is not a reason to skip your own schema. [Structured data](/learn/structured-data) is the same habit applied to text a person already wrote. The [structured data extractor](/prompts/structured-data-extractor) and [JSON output system](/prompts/json-output-system) prompts are the pattern without the app around them.

React rendered a typed object. The product did not need a chat transcript.

Neon is ordinary Postgres with a hosted connection string. Drizzle turns the table into a function call. The migration is the step that makes that table exist.

A full-stack AI app is still a full-stack app. One step is probabilistic. Validation is what lets every step after it stay ordinary. [Prompting fundamentals](/learn/prompting-fundamentals) still apply to the instructions you send. [Evals](/learn/evals) are how you would later check that a changed prompt still produces useful briefs.

## Next improvements

None of this is required to finish the guide.

Add authentication before the briefs are anything but a local demo. Right now anyone who can open the server can read every row.

Add editing when you want to revise a generated brief by hand.

Stream a partial object only if you move to `streamText` and accept that the value is incomplete until the stream ends. This tutorial waits for the full object so the page never renders a half-valid brief.

Widen the schema when the brief needs more fields, such as non-goals or open questions. Add the Zod field, then decide whether old rows still match.

Write a small eval set of ideas and expected headings when you start changing the instructions. Do that before you add tools or a second model call.

Deploy to Vercel when the local app is boring. Set the same two environment variables in the project settings, and run the migration against the Neon database you want production to use.

Switch `PRODUCT_BRIEF_MODEL` when you want to compare models. Keep the schema fixed so the UI does not change with the model.

Add prompt versioning when more than one person is editing the instructions and you need to know which wording produced a saved brief.
