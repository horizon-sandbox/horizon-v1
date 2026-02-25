# Block authoring examples

This file documents initial authoring contracts for the new reusable blocks:

- `hero-search`
- `promo-cards`
- `search-results`

## `hero-search`

Expected rows (in order):

1. Hero text row (3 columns)
   - Col 1: Eyebrow text (optional)
   - Col 2: Heading text (or heading element)
   - Col 3: Subheading text
2. Search row (1 column)
   - Search placeholder text or prefilled query text
3. Background row (optional)
   - Picture/image reference
4. Mode row (optional)
   - `default` or `prefilled`
5. Search target row (optional)
   - Path to search results page (default: `/drafts/search.html`)

Example authored table:

| Eyebrow | Title | Subtitle |
| --- | --- | --- |
| Education support | What can we help you find? | Explore learning for every stage of life with Pearson. |
| Search products, orders, or ask a question... |  |  |
| [Background image] |  |  |
| default |  |  |
| /drafts/search.html |  |  |

Prefilled variant:

| Eyebrow | Title | Subtitle |
| --- | --- | --- |
| Education support | What can we help you find? | Explore learning for every stage of life with Pearson. |
| Help me find a behavior assessment for children |  |  |
| [Background image] |  |  |
| prefilled |  |  |
| /drafts/search.html |  |  |

## `promo-cards`

Expected rows:

- Optional first row for options (single cell)
  - Example: `options: showDots=true`
- Then one row per card with 4 columns:
  1. Label/eyebrow
  2. Title
  3. Description
  4. CTA link

Example authored table:

| Options |
| --- |
| options: showDots=true |

| Label | Title | Description | CTA |
| --- | --- | --- | --- |
| EDUCATION: LEARN | Spark Your Curiosity | Igniting curiosity, building knowledge, and growing with confidence through compelling courseware and formative assessments. | [Explore learn offerings](/learn) |
| EDUCATION: PROGRESS | Recognizing Success | Celebrating growth and proving achievements with trusted assessments. | [Explore progress offerings](/progress) |
| EDUCATION: CAREER READY | Empowering Futures | Opening doors to careers through practical skills and workplace readiness. | [Explore career ready offerings](/career-ready) |

## Notes

- Both blocks are intentionally tolerant of missing optional fields.
- Keep image assets authored as normal image content; block JS handles transformation.
- Additional behavior (carousel motion, live search, chat integration) will be layered in future phases.

## `search-results`

Purpose:

- Render an Algolia-powered search experience using `instantsearch.js`.
- Run federated search across multiple indices from one query.
- Optionally enable Algolia Agent Studio chat via the InstantSearch `chat` widget.

Expected rows:

- Either 2-column `key | value` rows or single-cell `key: value` rows.
- Supported keys:
   - `appId` (optional, default `XFOI9EBBHR`)
   - `searchApiKey` (required, search-only key)
   - `shopIndex` (optional, default `live-learner-program-index-vector`)
   - `studyIndex` (optional, default `live-study-prep-course-catalog`)
   - `discoverIndex` (optional, default `live-en-us-learner-content-support-index`)
   - `supportIndex` (optional, default `live-en-us-learner-content-support-index`)
   - `contentIndex` (optional, default `live-en-us-learner-content-index`)
   - `title` (optional)
   - `placeholder` (optional)
   - `pearsonAiLabel` (optional)
   - `shopLabel` (optional)
   - `studyLabel` (optional)
   - `discoverLabel` (optional)
   - `supportLabel` (optional)
   - `contentLabel` (optional, label used inside Pearson AI aggregate)
   - `hitsPerPage` (optional, default `4`, max `10`)
   - `initialQuery` (optional)
   - `chatEnabled` (optional, default `true`)
   - `agentId` or `chatAgentId` (optional if `chatAgentApiUrl` is set)
   - `chatAgentApiUrl` (optional, AI SDK v5 compatible endpoint)
   - `chatTitle` (optional)
   - `chatPlaceholder` (optional)
   - `chatDisclaimer` (optional)
   - `chatPersistence` (optional, default `true`)
   - `chatCardLimit` (optional, default `4`, max `8`)
   - `chatUrlPrefix` (optional, default `https://www.pearson.com/store/en-us/`; applies to relative links and images)

Example authored table:

| Setting | Value |
| --- | --- |
| appId | XFOI9EBBHR |
| searchApiKey | PASTE_SEARCH_API_KEY_HERE |
| shopIndex | live-learner-program-index-vector |
| studyIndex | live-study-prep-course-catalog |
| discoverIndex | live-en-us-learner-content-support-index |
| supportIndex | live-en-us-learner-content-support-index |
| contentIndex | live-en-us-learner-content-index |
| chatAgentApiUrl | https://APP_ID.algolia.net/agent-studio/1/agents/AGENT_ID/completions?compatibilityMode=ai-sdk-5 |
| agentId | AGENT_ID |
| title | Search Results |
| placeholder | Search products, resources, or ask a question... |
| pearsonAiLabel | Pearson AI |
| shopLabel | Shop |
| studyLabel | Study |
| discoverLabel | Discover |
| supportLabel | Support |
| contentLabel | Content |
| chatTitle | Pearson AI Assistant |
| chatPlaceholder | Ask Pearson AI a question... |
| chatDisclaimer | Answers are generated by AI and may contain mistakes. |
| chatPersistence | true |
| chatCardLimit | 4 |
| chatUrlPrefix | https://www.pearson.com/store/en-us/ |
| hitsPerPage | 4 |
| initialQuery | behavior assessment children |

Notes:

- Query is synchronized with `?q=` in the URL.
- Chat transport uses `x-algolia-application-id` and `x-algolia-api-key` headers when `chatAgentApiUrl` is provided.
- In no-build/browser-only environments where the native InstantSearch `chat` widget is unavailable, the block falls back to Agent Studio HTTP API chat while preserving the same config keys.
- Chat fallback persists conversation/message history in localStorage and attempts to render structured product/item payloads as cards.
- If required credentials are missing, the block shows an inline config error.
