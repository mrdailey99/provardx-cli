# ProvarDX MCP Server – Implementation Plan (Plugin-Aware, MCP-First)

**Audience:** ProvarDX CLI engineers  
**Primary Goal:**  
Expose ProvarDX capabilities through an MCP server **starting with existing CLI + plugin functionality**, then layer in Quality Hub APIs, then AWS AI endpoints.

This plan is designed to be **implementation-ready**, aligned with the current repo and plugin architecture, and safe to execute incrementally.

---

## Why this order matters

We intentionally **do not start with AI or backend APIs**.

Instead, we:
1. Stand up an MCP server in the main ProvarDX CLI repo
2. Expose *existing ProvarDX plugin-backed commands* as MCP tools
3. Prove CLI ↔ MCP parity using shared logic
4. Add Quality Hub MCP tools
5. Add AWS API Gateway / Lambda AI tools

This gives:
- Immediate MCP value
- Zero backend dependency risk early
- No breaking changes to shared plugin repos
- A clean upgrade path to enterprise / self-hosted MCP usage

---

## Current repo landscape (confirmed)

### Main CLI repo
- `provardx-cli`
- Owns:
  - CLI command registration (`sf provar ...`)
  - User entrypoints
  - Config resolution
  - Execution orchestration

### Shared plugin repos (DO NOT refactor initially)
These already contain **well-structured, reusable logic**:

#### `provardx-plugins-automation`
- Automation lifecycle commands:
  - metadata download
  - project compile
  - test setup
  - test run
- Utilities:
  - `provardxExecutor`
  - config validation
  - file + JSON helpers
- Result models:
  - `SfProvarAutomationTestRunResult`
  - error handling

#### `provardx-plugins-manager`
- Quality Hub / Manager interactions:
  - connect
  - display
  - open
  - test run / abort / report
- Internal REST + SOQL utilities
- Rich result and reporter abstractions

#### `provardx-plugins-utils`
- Shared helpers:
  - error handling
  - JSON / file utilities
  - property validation
  - constants

**Key principle:**  
👉 MCP tools should call **the same services these plugins already expose**, not reimplement logic.

---

## Phase 1 — MCP Server Bootstrap (FIRST PRIORITY)

### Objective
Running:

```bash
sf provar mcp start
```

starts a **long-running MCP server over stdio** that IDE agents can connect to.

No QH. No AWS. Tools may be stubbed initially.

---

### Files to add (CLI repo only)

```
src/commands/provar/mcp/start.ts
src/mcp/server.ts
```

---

### `src/commands/provar/mcp/start.ts`

```ts
import { SfCommand } from '@salesforce/sf-plugins-core';

export default class McpStart extends SfCommand<void> {
  public static summary = 'Start the ProvarDX MCP server';

  public async run(): Promise<void> {
    this.log('Starting ProvarDX MCP server...');
    await import('../../../mcp/server').then(m => m.startMcpServer());
  }
}
```

> ⚠️ This command must **not exit**.
> Avoid stdout logging after MCP connects (log to stderr if needed).

---

### `src/mcp/server.ts`

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export async function startMcpServer() {
  const server = new McpServer({
    name: 'provardx',
    version: '0.1.0',
  });

  // v0 sanity tool
  server.tool(
    'provardx.ping',
    { type: 'object', properties: {}, additionalProperties: false },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: true,
            name: 'provardx',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

---

### Phase 1 success criteria

* `sf provar mcp start` runs and stays alive
* MCP client can connect
* `provardx.ping` works

---

## Phase 2 — Expose EXISTING plugin-backed commands as MCP tools

### Objective

Expose **existing ProvarDX functionality** as MCP tools **without touching QH or AWS**.

This phase proves:

* MCP is genuinely useful
* CLI and MCP share behavior
* Plugin repos are already "MCP-ready"

---

## Which commands to expose first (safe + deterministic)

### From `provardx-plugins-automation`

Mirror existing CLI flows that already rely on this plugin:

* `provar.automation.metadata.download`
* `provar.automation.project.compile`
* `provar.automation.test.setup`
* `provar.automation.test.run`

These already use:

* `provardxExecutor`
* validated config inputs
* structured result objects

Perfect MCP candidates.

---

### From existing CLI config commands

* `provar.config.get`
* `provar.config.set`
* `provar.config.load`
* `provar.config.validate`

Low-risk, deterministic, and immediately useful in IDEs.

---

## Implementation rule (critical)

**Do NOT shell out to `sf provar ...` from MCP.**

Instead:

* CLI commands call shared services
* MCP tools call the **same services**
* Shared services delegate to plugin APIs

---

## Minimal service adapter layer (CLI repo)

Create **thin adapters**, not new logic:

```
src/services/
  configService.ts
  automationService.ts
  managerService.ts   (later)
```

### Example: `automationService.ts`

```ts
import { provardxExecutor } from '@provartesting/provardx-plugins-automation';

export async function runAutomationTests(options: RunOptions) {
  return provardxExecutor.executeTestRun(options);
}
```

CLI command:

```ts
await runAutomationTests(parsedFlags);
```

MCP tool:

```ts
await runAutomationTests(input);
```

---

## MCP tool registration example

```
src/mcp/tools/automation.ts
```

```ts
import { runAutomationTests } from '../../services/automationService';

export function registerAutomationTools(server: any) {
  server.tool(
    'provar.automation.test.run',
    {
      type: 'object',
      properties: {
        projectPath: { type: 'string' },
        configPath: { type: 'string' }
      },
      required: ['projectPath']
    },
    async (input) => {
      const result = await runAutomationTests(input);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );
}
```

---

### Phase 2 success criteria

* MCP client can:

  * compile a project
  * run automation tests
* Output matches CLI behavior
* No plugin repo changes required

---

## Phase 3 — Introduce a shared invocation seam (now justified)

Only after MCP tools are real.

```
src/core/invoke.ts
```

```ts
export async function invoke(capability: string, input: unknown) {
  switch (capability) {
    case 'provar.automation.test.run':
      return runAutomationTests(input as any);
    case 'provar.config.get':
      return getConfig((input as any).key);
    default:
      throw new Error(`Unknown capability: ${capability}`);
  }
}
```

This becomes the hook point for:

* Quality Hub
* AWS AI
* Remote MCP routing

---

## Phase 4 — Quality Hub MCP tools (manager plugin–backed)

Using `provardx-plugins-manager`, expose:

* `provar.qh.run_tests`
* `provar.qh.get_request_status`
* `provar.qh.abort_test_run`

These map directly to existing Manager logic + REST helpers.

At this point:

* CLI commands may already exist
* MCP tools simply reuse manager services

---

## Phase 5 — AWS API Gateway / Lambda AI tools

Finally add:

* `provar.test.generate`
* `provar.test.validate`
* `provar.test.repair` (optional)

Pattern:

```
MCP tool → HTTP → API Gateway → Lambda
```

Routing config (`provardx.json`) can now decide:

* local only
* managed (Provar)
* self-hosted MCP

---

## Initial next steps (PR checklist)

### Day 1

* [x] Add MCP SDK dependency
* [x] Implement `sf provar mcp start`
* [x] Implement MCP server + `provardx.ping`

### Day 2

* [ ] Add `automationService.ts`
* [ ] Wrap one automation command as MCP tool
* [ ] Verify CLI ↔ MCP parity

### Day 3

* [ ] Add config MCP tools
* [ ] Add shared `invoke()` seam
* [ ] Document MCP usage

---

## Explicit non-goals (v0)

* ❌ No Quality Hub yet
* ❌ No AWS AI yet
* ❌ No routing config yet
* ❌ No monorepo refactors
* ❌ No subprocess CLI execution

---

## Definition of success

> "From Cursor or Claude Desktop, I can compile and run Provar automation tests via MCP, without touching the CLI directly."

Once that's true, adding QH and AI becomes purely additive.
