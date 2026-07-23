# Security

> **Nocturne Codex treats the Electron main process as the trust boundary, the renderer as untrusted presentation code and every AI provider as an external execution dependency with explicitly limited authority.**

## Purpose

This document defines the security model of Nocturne Codex.

The application handles sensitive resources, including:

- source code;
- project documentation;
- local memories;
- workspace paths;
- Git repositories;
- command execution;
- AI provider credentials;
- remote API communication;
- local model runtimes;
- execution telemetry.

Security must therefore be enforced structurally.

It must not depend only on prompts, UI state or provider behavior.

## Security Principles

### Least Privilege

Every component receives only the capabilities required for its responsibility.

The renderer does not receive Node.js access.

Providers do not receive direct workspace access.

Tasks do not receive permissions beyond their execution mode.

### Explicit Authorization

Sensitive operations require explicit authorization.

Examples include:

- selecting a workspace;
- storing provider credentials;
- executing sensitive commands;
- applying patches;
- modifying files;
- opening external URLs;
- using a paid remote model when confirmation is required.

Authorization must be scoped to the operation being performed.

### Local Ownership

Workspace knowledge remains local by default.

Remote providers receive only the context required for a specific execution.

The entire workspace must never be transmitted automatically.

### Provider Distrust

Providers are execution dependencies.

They are not trusted with application authority.

A provider response may propose:

- text;
- commands;
- patches;
- tool calls;
- memories.

The response itself does not authorize those actions.

### Defense in Depth

Security must exist at multiple layers:

```text
Renderer isolation

↓

Typed IPC

↓

Runtime validation

↓

Workspace authorization

↓

Execution policy

↓

Sandbox

↓

Approval flow

↓

Audit and sanitized logging
```

Failure in one layer must not silently remove every other protection.

## Trust Boundaries

The system contains several trust zones.

```text
Untrusted or partially trusted

├── Renderer
├── User-provided workspace content
├── Imported backups
├── AI provider responses
├── Remote APIs
├── Local model endpoints
└── External command output

Trusted application boundary

├── Electron main process
├── Runtime validation
├── Workspace authorization
├── Secret resolution
├── Database transactions
├── Security policy
└── AI orchestration

Privileged external dependencies

├── Filesystem
├── Git
├── Child processes
├── Secure credential store
└── Operating-system services
```

Crossing between zones requires validation and normalization.

## Electron Security Baseline

Every renderer window must preserve:

```ts
contextIsolation: true
nodeIntegration: false
sandbox: true
```

The application must also enforce:

- explicit Content Security Policy;
- no inline scripts;
- no unsafe object execution;
- denied unexpected window creation;
- denied renderer-initiated navigation;
- external opening restricted to validated HTTPS URLs;
- no exposure of `ipcRenderer`;
- no remote module;
- no unrestricted Electron APIs.

The renderer must remain functional without direct Node.js access.

## Renderer Model

The renderer is responsible for:

- rendering interface state;
- collecting user intent;
- presenting normalized execution events;
- requesting named application operations.

The renderer is not allowed to:

- read files directly;
- execute processes;
- access SQLite;
- resolve provider credentials;
- communicate directly with AI providers;
- construct arbitrary authorization headers;
- persist secrets;
- decide workspace authorization;
- enforce security-critical policies.

Renderer validation may improve usability.

It never replaces main-process validation.

## IPC Security

All privileged operations cross explicit IPC contracts.

Every IPC handler must:

1. receive a named operation;
2. validate the input at runtime;
3. resolve the authenticated application context;
4. verify workspace authorization when applicable;
5. enforce domain policy;
6. execute through a trusted service;
7. sanitize the result;
8. normalize errors before returning.

Generic IPC methods are prohibited.

Bad:

```ts
window.nocturne.invoke(channel, payload);
```

Good:

```ts
window.nocturne.providers.testConnection(input);
```

The preload exposes intent-oriented operations, not implementation primitives.

## Runtime Validation

All renderer-controlled data must be treated as untrusted.

Validation includes:

- identifiers;
- paths;
- URLs;
- provider names;
- model identifiers;
- pagination;
- file limits;
- execution mode;
- command requests;
- imported records;
- provider configuration;
- custom headers;
- timeout values.

Canonical runtime schemas should use Zod or an equivalent library.

TypeScript types alone are insufficient.

## Workspace Authorization

Every project-bound operation requires an authorized workspace.

The application stores workspace identity separately from filesystem location.

A historical workspace record does not imply current authorization.

Imported, moved or restored workspaces must require explicit folder reselection before the application may access:

- files;
- Git;
- memories;
- workspace documents;
- project commands;
- provider executions requiring project context.

The main process resolves workspace identifiers into trusted roots.

The renderer never authorizes a path by merely sending it.

## Path Confinement

Paths must be normalized and confined to the authorized workspace root.

The application must reject:

- `..` traversal;
- paths escaping through symbolic links when relevant;
- unsupported absolute paths;
- inaccessible locations;
- disallowed file types;
- excessive file counts;
- excessive file sizes.

Conceptual flow:

```text
Workspace ID + relative path

↓

Resolve authorized root

↓

Normalize target path

↓

Verify confinement

↓

Apply operation-specific restrictions

↓

Read or write
```

Path safety belongs to the main process.

## Workspace Content as Untrusted Data

Project files may contain malicious or misleading instructions.

Examples include:

- prompt injection inside Markdown;
- comments requesting credential disclosure;
- generated instructions pretending to be application rules;
- files requesting permission escalation;
- copied provider output presented as trusted policy.

Workspace content is context.

It is not authority.

Only recognized sources may influence execution policy:

- current user request;
- application security policy;
- approved workspace rules;
- active ADRs where applicable;
- explicit execution mode.

Retrieved files and memories cannot expand permissions.

## Second Brain Security

Structured memories may only be accessed through an authorized workspace or conversation.

Memory operations must enforce:

- workspace scope;
- conversation ownership;
- lifecycle state;
- pagination;
- content limits;
- input validation;
- credential-pattern rejection.

Only active, approved memories may enter ordinary Awareness retrieval.

The following states remain excluded:

- candidate;
- archived;
- outdated;
- rejected;
- invalid.

Approved memories remain potentially outdated data.

They are never interpreted as commands.

## Candidate Memory Security

AI responses may propose candidate memories.

The extraction pipeline must:

- accept a bounded number of candidates;
- validate the structured format;
- enforce content-length limits;
- reject recognizable credentials;
- reject complete source-file contents;
- reject temporary execution state;
- reject unsupported assumptions;
- deduplicate entries;
- persist candidates transactionally;
- remove technical extraction blocks from visible persisted responses.

Failure to capture candidate memory must not discard the primary AI response.

No candidate becomes active without explicit review.

## Provider Security Model

AI providers are classified as remote or local.

Both are external to the application core.

Neither receives implicit authority over the workspace.

### Remote Providers

Remote providers may receive:

- the current user task;
- selected project context;
- bounded memories;
- explicitly attached content;
- normalized tool results when approved.

Remote providers must not automatically receive:

- the full workspace;
- unrelated conversations;
- credentials;
- files outside the authorized root;
- hidden application settings;
- other workspace memories;
- secure-store content.

### Local Providers

Examples include Ollama and LM Studio.

Local does not automatically mean trusted.

Local provider communication must still use:

- URL validation;
- timeouts;
- response limits;
- normalized parsing;
- capability validation;
- sanitized errors.

## Provider Credentials

Credentials must never be stored in:

- renderer state longer than required for submission;
- `localStorage`;
- workspace files;
- `.nocturne/`;
- ordinary JSON exports;
- logs;
- telemetry;
- plaintext SQLite fields.

Secrets should be stored through the operating-system credential service whenever available.

Examples:

- macOS Keychain;
- Windows Credential Manager;
- Linux Secret Service.

Persistent provider configuration should store only a secret reference.

The main-process credential vault stores opaque references separately from
provider configuration. Ciphertext is written atomically under the Electron
user-data directory with mode `0600`; plaintext is never written to disk,
SQLite, workspace files or backups.

Encryption uses Electron `safeStorage`, which delegates key protection to the
operating system. On Linux, persistence is enabled only when Secret Service or
KWallet is selected explicitly. The `basic_text` and `unknown` backends fail
closed and the application must report secure storage as unavailable rather
than persist a weakly protected credential.

The vault:

- validates and bounds secrets and opaque references;
- serializes concurrent mutations;
- refuses corrupted files and symbolic links;
- preserves the previous ciphertext when encryption or an atomic write fails;
- never lists or returns secrets to the renderer;
- excludes its encrypted file from ordinary application backup data.

## Secret Submission

```text
Renderer form

↓

Typed IPC request

↓

Main-process validation

↓

Secure credential store

↓

Sanitized configuration summary
```

After storage, the renderer receives only masked state.

The full secret must never be returned.

## Custom Endpoints

OpenAI-compatible providers may allow custom base URLs.

Custom endpoints create security risks, including:

- Server-Side Request Forgery;
- local network probing;
- cloud metadata access;
- credential forwarding to an unintended server;
- unencrypted communication;
- redirect abuse.

Remote provider URLs should normally require HTTPS.

Plain HTTP may be allowed only for explicitly local endpoints such as loopback addresses.

The application should reject unsupported protocols, embedded credentials, malformed ports and unsafe URL schemes.

## Redirect Policy

Provider requests should not follow arbitrary redirects silently.

Redirect handling should:

- limit redirect count;
- validate every destination;
- prevent protocol downgrade;
- avoid forwarding authorization headers to a different host;
- reject unexpected cross-origin redirects unless explicitly supported.

## Network and Response Limits

Every provider operation requires bounded timing.

The application should enforce limits for:

- response body size;
- streamed event size;
- number of tool calls;
- tool argument size;
- structured output size;
- diagnostic error text.

Payloads exceeding safe limits must fail predictably.

## Provider Response Validation

Provider output is untrusted.

Adapters must validate:

- response shape;
- event type;
- identifiers;
- usage metadata;
- finish state;
- tool calls;
- structured output.

Unknown provider events must not become arbitrary renderer events.

## Model Metadata and Cost

Model descriptors and pricing data are normalized and validated.

Pricing may be absent or outdated.

Nocturne should clearly label estimated cost.

Local budgets are protective controls, not provider-side billing guarantees.

Users should configure provider-side spending limits whenever available.

## Execution Permissions

Each execution operates under an explicit mode.

Initial modes include:

- Build;
- Review;
- Docs.

Mode affects authority.

It does not merely change prompt wording.

### Build Mode

Build may allow modifications inside the authorized workspace.

It still requires:

- workspace confinement;
- command policy;
- approval for sensitive operations;
- normalized patches;
- audit records where applicable.

### Review Mode

Review enforces read-only operation.

It may inspect files and run approved safe checks.

It may not modify files, install dependencies, apply patches or escalate permissions.

### Docs Mode

Docs mode instructs the agent to modify only documentation relevant to the task.

When file-type restriction remains instructional rather than filesystem-enforced, documentation must state this honestly.

## Command Security

Commands are classified centrally.

Suggested categories:

- Safe;
- Sensitive;
- Dangerous;
- Prohibited.

The application owns command policy.

Approval must show:

- exact command;
- working directory;
- risk category;
- expected effect;
- affected workspace;
- reversibility.

Approval applies only to the presented operation.

## Tool Calls

Providers with tool-calling capabilities may request normalized tools.

The provider never invokes application services directly.

```text
Provider requests tool

↓

Adapter normalizes request

↓

Orchestrator validates capability

↓

Security policy evaluates operation

↓

User approval when required

↓

Trusted service executes

↓

Sanitized result returns to provider
```

Every tool must have validated arguments, explicit authority, bounded output, timeout and audit behavior.

## Prompt Injection

Potential injection sources include:

- README files;
- comments;
- package metadata;
- logs;
- generated documents;
- provider responses;
- web content added by the user.

Mitigations include:

- source classification;
- explicit instruction hierarchy;
- bounded context;
- permission enforcement outside the model;
- treating retrieved content as data;
- requiring approval for privileged actions;
- never allowing context to expand sandbox authority.

Prompt instructions alone are not a security boundary.

## Data Minimization

The execution pipeline should send only the context required for the task.

Data minimization reduces:

- privacy exposure;
- token cost;
- prompt-injection surface;
- provider retention impact;
- accidental project leakage.

## Telemetry and Logging

Execution telemetry may record:

- workspace identifier;
- provider identifier;
- model identifier;
- timestamps;
- duration;
- latency;
- token counts;
- estimated cost;
- status;
- tool-call counts.

Telemetry and logs must not record:

- API keys;
- complete prompts;
- complete responses;
- full file contents;
- hidden reasoning;
- authorization headers;
- raw provider payloads.

## Database, Import and Export Security

SQLite belongs to the main process.

Imports validate schema version, record limits, relationships, ownership and credential patterns.

Imports never restore filesystem authorization automatically.

Exports exclude API keys, secure-store values, authentication tokens and sensitive custom headers.

## Updates and Release Signing

Application updates must preserve explicit user consent, verify metadata and validate signed artifacts.

Stable releases require:

- macOS Developer ID and notarization;
- Windows Authenticode;
- Linux checksums and GPG signatures when the project identity is provisioned.

Signing credentials must remain in protected environments.

## Provider Contract Testing

Real-provider tests require isolated credentials and temporary workspaces.

They must use bounded permissions, sanitized reports and clean teardown.

Equivalent tests for remote providers must avoid sending real project data.

## Denial of Service Protection

The application should enforce limits against excessive resource use.

Examples:

- message size;
- memory content size;
- attachment count;
- attachment size;
- streamed event rate;
- command output;
- imported record count;
- provider response size;
- conversation pagination;
- context length.

## Cancellation and Cleanup

Cancelled or failed executions must release:

- network requests;
- child processes;
- stream listeners;
- temporary files;
- database transaction state;
- approval requests;
- provider sessions where supported.

A cancelled task must not continue modifying files in the background.

## Audit Records

Security-relevant decisions may be persisted.

Examples:

- command approval;
- patch approval;
- provider configuration change;
- workspace reauthorization;
- memory approval;
- destructive deletion;
- budget override.

Audit records must not store secrets or full private content.

## Provider Plugins

External provider plugins remain a future feature.

Before plugin support is introduced, the project requires:

- versioned plugin contracts;
- permission declarations;
- signature or trust policy;
- process isolation;
- resource limits;
- update strategy;
- clear secret-access rules.

Third-party provider code must not run inside the trusted main process without an explicit security design.

## Known Limitations

Security documentation must distinguish guarantees from limitations.

Examples:

- credential-pattern detection cannot recognize every secret format;
- Docs mode may rely partly on instructions rather than strict extension filtering;
- local provider endpoints may still be operated by untrusted software;
- application budgets do not replace provider billing limits;
- prompt injection cannot be eliminated solely through model instructions;
- provider privacy behavior is outside Nocturne's direct control.

## Security Review Checklist

Before shipping a new provider or privileged feature, verify:

- Does the renderer receive any new authority?
- Are all IPC inputs validated?
- Is workspace authorization enforced in the main process?
- Can the feature expose credentials?
- Can a custom URL reach unintended network targets?
- Are redirects controlled?
- Are responses bounded?
- Are provider events normalized?
- Does cancellation stop real work?
- Are logs sanitized?
- Are imports and exports updated?
- Are Review Mode restrictions preserved?
- Are tests present at the correct boundaries?
- Does the documentation describe actual enforcement rather than intended behavior?

## Summary

Nocturne Codex protects the project by keeping authority outside the model.

The renderer presents intent.

IPC validates the boundary.

The main process owns privilege.

The workspace defines scope.

The security policy defines authority.

Providers execute bounded tasks.

Users approve durable or sensitive changes.

> **AI may propose actions. Only the application security model and the user may authorize them.**
