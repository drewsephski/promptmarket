# PromptMarket organic search plan

Audit date: September 24, 2026. Target: https://promptmarket.sh. Initial market assumption: English-language searches, with US desktop and mobile rankings tracked separately. Implementation status: local changes, not deployed by this task. First-page rankings are an objective, not a deliverable that code changes can guarantee.

## Baseline and evidence

| Signal                                          | Observed baseline                                                                                                       | Interpretation                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Ahrefs Site Explorer, all locations, subdomains | DR 2.2; 1 live backlink from 1 referring domain; all-time totals 2 links / 2 domains                                    | Authority is early-stage. DR is an Ahrefs comparison metric, not a Google ranking factor.                                       |
| Ahrefs organic search                           | 0 detected keywords; 0 estimated monthly organic traffic                                                                | This is Ahrefs' coverage and estimate, not proof of zero Google impressions or visits.                                          |
| Ahrefs crawled pages                            | 56 pages, all reported 200                                                                                              | Discovery exists in Ahrefs; this does not establish Google indexing.                                                            |
| Google Search Console domain property           | Performance, indexing, and experience reports say “Processing data, please check again in a day or so”                  | Google baseline unavailable. Do not interpret missing reports as zero.                                                          |
| Ahrefs API                                      | Keyword overview, SERP overview, metrics, backlinks, project listing, and free DR endpoint returned “Insufficient plan” | No verified keyword volume, difficulty, or individual Google positions available. UI Site Explorer supplied the baseline above. |
| Live HTTP audit                                 | Home, prompts, filtered prompts, representative skill, lesson, and guide returned 200                                   | Pages are accessible without authentication.                                                                                    |
| Live metadata                                   | Home and skill detail lacked canonicals; `/prompts?q=rag` canonicalized to itself; sampled pages had no JSON-LD         | Fixed locally in this task.                                                                                                     |
| Live robots and sitemap                         | Both return content; robots allows crawling and references the sitemap                                                  | Preserve crawl access so Google can read canonicals and noindex rules.                                                          |
| PageSpeed Insights API                          | HTTP 429, public API quota exceeded                                                                                     | No measured Lighthouse score or field Core Web Vitals reported.                                                                 |

Sources observed in the signed-in browser: [Ahrefs project](https://app.ahrefs.com/site-explorer/overview?target=promptmarket.sh%2F&mode=subdomains&projectId=10429036), [Search Console property](https://search.google.com/search-console?resource_id=sc-domain%3Apromptmarket.sh). The browser connection ended before sitemap submission status could be read; no submission is claimed.

A public search sample surfaced template collections, individual system prompts, and writing tutorials, including [A8gent's template pack](https://a8gent.com/templates/ai-agent-prompt-pack), [Prompt Architects' template article](https://www.prompt-architects.com/blog/341-ai-agent-prompt-templates-autonomous-workflows), and [TGWise's writing guide](https://tgwise.com/guides/how-to-write-an-ai-agent-prompt/). This suggests that copyable examples plus instructions and failure handling fit the intent. It is not a localized Google rank report, and their product claims were not independently verified.

## Keyword ownership

Priorities reflect relevance, intent, and existing content—not measured search demand or difficulty. Keep one primary URL per intent. Start with specific, useful templates while building relevance for the broader head term.

| Priority | Primary query                     | Secondary terms                                                                        | Owning page                         | Work                                                                          |
| -------- | --------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| P1       | agent prompts                     | AI agent prompts; free agent prompts; agent prompt examples; AI agent prompt templates | `/prompts`                          | Expanded library introduction, selection help, and template links implemented |
| P1       | AI agent system prompt template   | agent system prompt; system prompt example for agents                                  | `/prompts/agent-system-prompt`      | New copyable template implemented                                             |
| P1       | how to write AI agent prompts     | agent prompting best practices; agent prompt structure                                 | `/learn/agent-prompts`              | New practical lesson implemented                                              |
| P1       | tool calling system prompt        | safe tool calling prompt; agent tool instructions                                      | `/prompts/safe-tool-calling-system` | Existing template; add reproducible denied-tool and failure cases next        |
| P1       | RAG prompt template               | grounded answer prompt; RAG system prompt example                                      | `/prompts/rag-grounded-answer`      | Existing template; expand evidence and adversarial examples next              |
| P1       | AI agent skills                   | coding agent skills; installable agent workflows                                       | `/recipes`                          | Title, description, and heading improved                                      |
| P2       | AI code review agent prompt       | pull request review skill; GitHub PR review agent                                      | `/recipes/github-pr-review`         | Canonical and sitemap discovery fixed; expand task-specific evidence          |
| P2       | customer support prompt template  | support agent prompt; grounded support reply                                           | `/prompts/customer-support-answer`  | Expand handoff and missing-policy cases                                       |
| P2       | JSON system prompt                | structured output prompt; JSON prompt template                                         | `/prompts/json-output-system`       | Expand schema validation and retry examples                                   |
| P2       | tool selection prompt             | agent routing prompt; tool router template                                             | `/prompts/tool-selection-router`    | Expand ambiguous intent / no-match cases                                      |
| P2       | prompt evaluation template        | prompt evaluator; compare prompts                                                      | `/prompts/prompt-evaluator`         | Add downloadable fixed evaluation cases with actual results                   |
| P2       | how to build a RAG knowledge base | Next.js RAG tutorial; pgvector knowledge base                                          | `/guides/rag-knowledge-base`        | Existing long guide; keep commands and evidence current                       |
| P2       | AI engineering roadmap            | learn AI engineering; AI engineering tutorials                                         | `/learn`                            | Descriptive title implemented                                                 |
| P2       | AI agent context engineering      | coding agent context; PromptMarket                                                     | `/`                                 | Descriptive title, description, canonical and library link implemented        |
| P3       | MCP prompt server                 | PromptMarket MCP; coding agent MCP setup                                               | `/docs/mcp`                         | Expand with a verified end-to-end installation example                        |
| P3       | Claude Code skills vs prompts     | agent skills vs system prompts; SKILL.md vs prompt                                     | proposed `/learn/prompts-vs-skills` | Publish only after hands-on compatibility checks; do not duplicate `/recipes` |

Keep existing readable URL slugs. Do not rename `/recipes` just to fit a keyword. If a future migration is justified, ship permanent redirects and update links and sitemap together. Do not create near-identical pages for “agent prompts,” “AI agent prompts,” and “best agent prompts.” A dedicated category URL should exist only when it can deliver distinct examples and editorial help.

## On-page implementation

The main library now has the title **AI Agent Prompts: Free Templates & Examples · PromptMarket**, one H1 **AI agent prompts and templates**, and a description explaining tools, RAG, extraction, variables, examples, and common mistakes. Visible H2 sections explain choosing a prompt, using templates, and the difference between prompts and skills. The library is reachable from the primary navigation and homepage.

The new lesson explains objective, context, tools, boundaries, completion, and output; includes a worked support scenario and explicit evaluation cases; and links to relevant templates. The new system template includes actual variables and illustrative input/output. Examples are not presented as measured model results. Reciprocal catalog links keep these documents available through the existing app, CLI, and content APIs.

Home, skills, learn, and guides have more descriptive metadata. Existing prompt, lesson, and guide detail pages retain individual titles/descriptions and now include breadcrumb schema. Home has WebSite schema; the library has CollectionPage/ItemList schema generated from displayed results. No fake reviews, ratings, authors, or test outcomes were added. Structured data must match visible content, and rich-result display is not guaranteed. [Google structured-data guidance](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

Next editorial improvements: include a named maintainer/reviewer when actually assigned; link to the exact source document and revision; record genuine review dates; show model/configuration and observed outcomes for tested templates. Use descriptive anchor text from relevant lessons, not repeated exact-match links on every page. Meta descriptions should answer the searcher's intent; avoid keyword stuffing and unsupported “best” or “production-ready” claims.

## Technical SEO

Implemented locally:

- Canonicals on home, skill details, create, and contribute. Historical skill versions point to the stable skill URL.
- Internal search and filter states on prompts, skills, and context use `noindex, follow` and a clean destination canonical. Invalid skill-version error pages are noindex. These are utility results intentionally excluded from Search; this is distinct from consolidating duplicate historical skill versions with canonicals alone.
- Sitemap includes all current skill detail URLs, editorial catalog documents, and public static destinations. No search queries, fragments, fabricated modification dates, or historical versions are included.
- API and MCP responses receive `X-Robots-Tag: noindex`; endpoints remain functional for clients.
- robots.txt remains open, including pages whose noindex directives must be crawled. Blocking a URL in robots.txt does not reliably remove it from results. [Google indexing controls](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share)
- Schema serialization escapes `<` to prevent content from terminating the JSON-LD script element.

After deployment, inspect `/`, `/prompts`, the two new pages, and a representative skill in Search Console. Confirm HTTP 200, crawl permission, rendered content, and Google's selected canonical. Submit `https://promptmarket.sh/sitemap.xml` if not already registered. Sitemap submission aids discovery but does not guarantee indexing. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

Live host checks found HTTP → HTTPS uses 308, while www → apex uses temporary 307. Change the www redirect to permanent 308 in Vercel domain settings once apex is confirmed as the long-term canonical host; this hosting setting was not changed by this task. Verify missing documents return 404 and do not redirect all unknown routes to the homepage. Check that preview deployment noindex headers are absent on production editorial pages.

Performance: pages use server-rendered content, static lesson/template output, local font delivery through Next.js, and optimized WebP roadmap images. Preserve these properties. Run mobile and desktop PageSpeed/Lighthouse on home, the library, a prompt, and a long guide after deployment. Use field data at the 75th percentile when available: LCP ≤2.5 seconds, INP ≤200 ms, CLS ≤0.1. Inspect the actual LCP element, unused client JS, font contention, and image sizes before changing the design. A local timing or one Lighthouse run is not field evidence. [Google Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals)

Mobile QA should cover the navigation menu, wrapped headings/chips, prompt copy controls, tables and code overflow, touch targets, and keyboard focus. New content reuses the existing responsive components and adds no client dependency.

## Content schedule and authority

| Window    | Deliverable                                           | Format and evidence                                                                                | Internal destination                |
| --------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Now       | Agent prompt library, system template, writing lesson | Copyable instructions, worked example, failure checklist; implemented locally                      | Link all three together             |
| Weeks 1–2 | Expand tool-calling template                          | Allowed/denied tool examples, timeout and retry trace, JSON validation fixture                     | Tool-calling lesson and skills      |
| Weeks 2–3 | Expand RAG template                                   | Supported answer, missing evidence, conflicting source, injected instruction; cite actual passages | RAG guide and evals                 |
| Weeks 3–4 | Publish prompt evaluation case pack                   | Versioned JSON/CSV fixtures plus executable runner; publish model, dates, cost and actual results  | Prompt evaluator and writing lesson |
| Month 2   | Prompts vs skills guide                               | Hands-on comparison with a real task and installation screenshots                                  | System template, skills, setup docs |
| Month 2   | Coding review walkthrough                             | Small public example PR, review prompt, caught/missed defects, measured checks                     | GitHub review skill                 |
| Month 3   | Expand pages already getting relevant impressions     | Answer observed query gaps and add original examples; merge duplicate intent if needed             | Existing ranking URLs               |

For an early-stage site, useful artifacts are stronger outreach material than a generic launch link. Publish the evaluation case pack in the existing public repository with a contextual link to its explanation on the site. Add site/docs links to package metadata and repository documentation where useful. Contribute genuine integration examples to relevant open-source projects; suggest a resource listing only when it satisfies that project's criteria. Offer a practical tutorial or reproducible comparison to a small number of AI engineering newsletters and educators. Ask actual users to publish their implementation and cite the specific template they used.

Operating target, not a forecast: pursue 5–10 relevant editorial referring domains over the first 90 days, prioritizing developer resources and genuine usage. Record referring page, context, destination, referral visits, and activated users. Avoid bought followed links, mass directory submissions, reciprocal-link schemes, and automated forum promotion. [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)

No outreach, backlink purchase, public posting, or fabricated credibility work was performed by this task.

## Measurement and decisions

| Metric                                          | Tool / cadence                                                         | Baseline or action                                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Indexed canonical target pages                  | Search Console Pages + URL Inspection; weekly after release            | Pending processing. Investigate persistent excluded target URLs individually.                                                                                           |
| Non-brand impressions and clicks by query/page  | GSC Performance; weekly, compare 28-day windows                        | Pending. Separate brand regex `promptmarket                                                                                                                             | prompt market | promptmarket.sh` from non-brand. |
| CTR by query, device, country, and position     | GSC; monthly                                                           | Compare similar position ranges; rewrite weak snippets when impressions are sufficient, not after a few searches.                                                       |
| Top-10 keyword coverage and query→URL ownership | Ahrefs Rank Tracker if available; weekly                               | Load the keyword map, US desktop/mobile. Baseline individual ranks unknown; do not equate them with Site Explorer's zero count.                                         |
| Relevant live referring domains                 | Ahrefs Site Explorer; monthly                                          | 1 observed. Review quality and destination page, not DR alone.                                                                                                          |
| Organic engaged visits and activation           | Existing analytics, or a selected first-party/privacy-appropriate tool | Baseline unavailable. Track successful prompt copy, skill install-command copy, and setup-doc visits by landing page. These events are proposed, not instrumented here. |
| LCP, INP, CLS                                   | GSC/CrUX field data; monthly; PSI/Lighthouse per release               | Unmeasured. PSI API quota blocked this audit.                                                                                                                           |
| Crawl errors, broken links, duplicates          | Ahrefs Site Audit; weekly after configured                             | Inspect canonical targets and sitemap mismatches; dashboard crawl count is not a full audit.                                                                            |

Do not send prompt text, user queries, repository content, or clipboard data to analytics. A copy event should include only a stable content ID and outcome after the clipboard write succeeds. A copied install command is an intent signal, not proof of installation.

Days 0–14: deploy the reviewed changes, confirm metadata and sitemap on the live domain, establish the first GSC baseline, and request indexing for the principal new URLs if needed. Days 15–45: expand the first two templates and publish evaluation evidence. Days 46–90: invest in pages receiving relevant impressions; improve internal links for queries around positions 11–30; adjust titles for pages with weak CTR relative to comparable positions. If there is no discovery, diagnose indexing and links before producing dozens more pages.

Success means increasing relevant non-brand clicks and actual prompt/skill use, with a growing number of intended pages in positions 1–10. Review the broad “agent prompts” objective alongside attainable task-specific terms. Reassess at 90 days; do not promise a ranking date.

## Local verification results

- Production build completed successfully; Next.js reported existing dynamic filesystem tracing warnings in shared content/registry code.
- Web lint and TypeScript checks passed; content TypeScript check passed through the workspace task.
- 23 content/retrieval tests and 11 web tests passed, including new indexing, canonical, sitemap completeness, and JSON-LD escaping coverage. Content tests were run directly to avoid relying on an earlier Turbo cache result.
- Crawled all 59 sitemap URLs from the local production build: every URL returned 200, one H1, one title, one description, and one matching canonical, with no unexpected noindex.
- Verified filtered/search variants are noindex, historical skill versions canonicalize to the stable URL, missing lesson/prompt/skill pages return 404, and API/MCP responses carry noindex headers.
- Desktop and narrow mobile browser checks passed for the prompt library; the mobile template copy button changed to “Copied.” The observed narrow viewport had no horizontal document overflow. Category filtering returned the expected agent templates.
- Raw local crawl results: [local-verification.json](./local-verification.json). Keyword planning data: [keyword-map.csv](./keyword-map.csv).

Deployment, Google's selected canonicals, indexing, individual ranks, sitemap submission, field performance, and analytics instrumentation remain separate release/measurement steps. No ranking improvement is claimed from local checks.
