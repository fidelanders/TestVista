# 🚀 TestVista — Improvement Roadmap

## Purpose

This document defines a **controlled, milestone-based improvement plan** for TestVista.

The goal is to improve TestVista without introducing all planned features at once. Each milestone should be implemented, tested, reviewed, and committed before the next milestone begins.

> **Guiding principle:** improve the execution foundation first, then reporting, then analytics, then CI/CD.

---

# 🎯 Current Project Baseline

TestVista currently wraps **Newman** in a modular reporting layer. The existing pipeline is:

```text
Postman Collection
        ↓
index.js / server.js
        ↓
Newman
        ↓
newmanParser.js
        ↓
sanitizer.js
        ↓
HTML / JSON / PDF
```

The current project already provides:

- Premium interactive HTML dashboard
- Printable A4 report
- Optional server-side PDF generation through Puppeteer
- Sanitized JSON output
- Sensitive-data redaction
- Request/response header removal
- Nested body sanitization
- HTML escaping
- Newman failure correlation
- CLI execution
- Web upload execution
- Shared `runCollection()` pipeline
- Search and pass/fail filtering
- Jump-to-first-failure
- Modular reporter components

The current README also identifies these roadmap items:

- Non-zero CLI exit code on failed requests
- Trend view across historical runs
- Dark mode
- Slack/Teams webhook notification

This improvement roadmap expands that foundation without requiring a large rewrite.

---

# 🧭 Improvement Strategy

Do **not** implement every feature simultaneously.

Use the following progression:

```text
Milestone 1
Environment Support
        ↓
Milestone 2
Iteration Support
        ↓
Milestone 3
Data-Driven Testing
        ↓
Milestone 4
Iteration-Aware Reporting
        ↓
Milestone 5
Execution History & Analytics
        ↓
Milestone 6
CI/CD & Automation
        ↓
Milestone 7
Optional UX / Product Enhancements
```

Each milestone should be independently testable.

---

# 🟢 Milestone 1 — Postman Environment Support

## Objective

Allow TestVista to run a Postman collection with an **optional Postman environment file**.

### Target capability

```text
Collection
    +
Environment (optional)
    ↓
Newman
    ↓
Existing TestVista Report
```

## Why start here?

Environment support changes the Newman execution configuration without requiring a redesign of the reporting system.

It is also a prerequisite for making TestVista useful across environments such as:

- Local
- Development
- QA
- Staging
- Production-like test environments

## Implementation tasks

### 1. Extend `runCollection()`

Current conceptual API:

```javascript
runCollection({
    collection,
    reportBaseName
})
```

Target:

```javascript
runCollection({
    collection,
    environment,
    reportBaseName
})
```

`environment` must remain optional so existing collection-only execution continues to work.

### 2. Pass environment to Newman

Only add the Newman `environment` option when an environment has actually been supplied.

### 3. CLI support

Introduce support for something similar to:

```bash
node index.js   --collection collections/api.json   --environment environments/staging.postman_environment.json
```

The exact argument implementation can be chosen during development.

### 4. Web upload support

Allow the user to provide:

```text
Collection
[ Choose collection ]

Environment (optional)
[ Choose environment ]

[ Run Test ]
```

### 5. Safe report metadata

The report may show:

```text
Collection: My API
Environment: Staging
```

but should **never expose environment secrets**.

Do not render raw environment JSON into the report.

## Acceptance criteria

- [x] Collection-only execution still works.
- [x] Collection + environment execution works.
- [x] Environment variables resolve correctly inside Newman.
- [x] CLI execution supports an optional environment.
- [x] Web execution supports an optional environment.
- [x] Existing HTML output still works.
- [x] Existing JSON output still works.
- [x] Existing PDF output still works.
- [x] Environment secrets are not exposed.
- [x] Existing sanitizer behavior remains intact.
- [x] No unrelated features are introduced.

> **Status: ✅ Complete.** Implemented and tested against all three execution paths (CLI flag-less, CLI with `--collection`/`--environment`, and web upload). Testing caught a real leak: Newman's summary embeds the full resolved `environment`/`globals`/`collection` objects — including every variable's actual value — as top-level fields alongside `run`, using a `{key, value}` shape that the existing key-name-based sanitizer doesn't inspect. Fixed by stripping those top-level fields entirely before writing any report (nothing in the reporting pipeline reads them). Re-verified clean via direct string search on both the JSON and HTML output after the fix, through both the CLI and web upload paths. See the "🔐 Environment Support" section in README.md for details.

## Suggested commit

```bash
git add .
git commit -m "feat: add Postman environment support"
```

> **STOP HERE. Test this milestone thoroughly before starting Milestone 2.**

---

# 🟢 Milestone 2 — Newman Iteration Support

## Objective

Allow users to run a collection multiple times using Newman's iteration capability.

### First version

Keep this deliberately simple.

Support:

```text
Iterations: 1
```

or:

```text
Iterations: 10
```

Do **not** add CSV/JSON data files yet.

## Target execution flow

```text
Collection
    +
Environment
    +
Iterations
    ↓
Newman
    ↓
TestVista
```

## Implementation tasks

### 1. Extend execution configuration

Target:

```javascript
runCollection({
    collection,
    environment,
    iterations,
    reportBaseName
})
```

Default:

```javascript
iterations = 1
```

### 2. Pass iterations to Newman

Map the TestVista option to Newman's iteration configuration.

### 3. CLI support

Example target:

```bash
node index.js   --collection collections/api.json   --environment environments/staging.json   --iterations 10
```

### 4. Web UI

Add:

```text
Iterations
[ 1 ]
```

### 5. Preserve current behavior

If the user does not specify an iteration count:

```text
iterations = 1
```

## Acceptance criteria

- [ ] Default execution still runs once.
- [ ] User can specify multiple iterations.
- [ ] Newman actually executes the requested number of iterations.
- [ ] Collection + environment + iterations works together.
- [ ] Existing reports are still generated.
- [ ] No sensitive data is exposed.
- [ ] No duplicated execution logic exists between CLI and web mode.

## Suggested commit

```bash
git add .
git commit -m "feat: add Newman iteration support"
```

> **STOP HERE. Verify the Newman execution count before improving the report.**

---

# 🟢 Milestone 3 — Data-Driven Testing

## Objective

Allow Newman iterations to consume Postman data files.

Support:

- CSV
- JSON

### Example

```text
Collection
    +
Environment
    +
users.csv
    +
Iterations
    ↓
Newman
```

## CSV example

```csv
customerId,email
10001,test1@example.com
10002,test2@example.com
10003,test3@example.com
```

## JSON example

```json
[
  {
    "customerId": "10001",
    "email": "test1@example.com"
  },
  {
    "customerId": "10002",
    "email": "test2@example.com"
  }
]
```

## Implementation tasks

- [ ] Add optional data-file configuration.
- [ ] Detect CSV vs JSON.
- [ ] Pass the file to Newman.
- [ ] Validate file existence.
- [ ] Validate supported file type.
- [ ] Handle invalid data files gracefully.
- [ ] Keep environment support working.
- [ ] Keep iteration support working.

## Target configuration

```javascript
runCollection({
    collection,
    environment,
    dataFile,
    iterations,
    reportBaseName
})
```

## Acceptance criteria

- [ ] CSV data runs correctly.
- [ ] JSON data runs correctly.
- [ ] Iteration variables resolve correctly.
- [ ] Invalid files produce useful errors.
- [ ] Existing collection-only runs remain unaffected.

## Suggested commit

```bash
git add .
git commit -m "feat: add data-driven Newman execution"
```

---

# 🟢 Milestone 4 — Iteration-Aware Reporting

## Objective

Make the report understand that one request can execute multiple times.

Instead of only reporting:

```text
Create Policy — Failed
```

the report should eventually identify:

```text
Create Policy
Iteration: 4
Status: Failed
```

## New report summary

Example:

```text
EXECUTION SUMMARY

Iterations       10
Total Requests   100
Passed           92
Failed            8
Pass Rate         92%
```

## Iteration overview

| Iteration | Requests | Passed | Failed | Pass Rate |
|---|---:|---:|---:|---:|
| 1 | 10 | 10 | 0 | 100% |
| 2 | 10 | 9 | 1 | 90% |
| 3 | 10 | 10 | 0 | 100% |
| 4 | 10 | 8 | 2 | 80% |

## Implementation tasks

- [ ] Preserve iteration information during parsing.
- [ ] Update `newmanParser.js`.
- [ ] Track request-to-iteration relationship.
- [ ] Add iteration counts to summary.
- [ ] Add iteration-level pass/fail information.
- [ ] Identify the iteration responsible for a failure.
- [ ] Preserve existing failure correlation.
- [ ] Add iteration filter.
- [ ] Ensure printing still includes the full report.

## Dashboard filters

Current:

```text
All | Passed | Failed
```

Target:

```text
All | Passed | Failed | Iteration
```

## Acceptance criteria

- [ ] Every execution can be traced to an iteration.
- [ ] Failed iterations are identifiable.
- [ ] Summary totals are accurate.
- [ ] Existing single-run reports still look correct.
- [ ] Iteration filtering works.
- [ ] Search works with iteration-aware results.
- [ ] PDF/print output includes all iterations.

## Suggested commit

```bash
git add .
git commit -m "feat: add iteration-aware reporting"
```

---

# 🟡 Milestone 5 — Execution Configuration & Better UX

## Objective

Create a clean execution configuration layer rather than continuously adding individual parameters throughout the application.

## Target model

```javascript
const runConfig = {
    collection,
    environment,
    dataFile,
    iterations,
    timeout,
    delay,
    bail
};
```

Then:

```javascript
runCollection(runConfig);
```

## Recommended first options

Expose only:

- Collection
- Environment
- Data file
- Iterations
- Request timeout
- Continue on error

Avoid exposing every Newman option immediately.

## UI concept

```text
EXECUTION SETTINGS

Collection
[ my-api.postman_collection.json ]

Environment
[ staging.postman_environment.json ]

Data File
[ users.csv ]

Iterations
[ 10 ]

Request Timeout
[ 30 seconds ]

Continue on Error
[ ✓ ]

[ RUN TESTS ]
```

## Acceptance criteria

- [ ] Execution configuration has one clear source of truth.
- [ ] CLI and web modes use the same configuration model.
- [ ] No duplicated Newman configuration logic.
- [ ] Invalid configurations are rejected clearly.
- [ ] Existing functionality remains compatible.

## Suggested commit

```bash
git add .
git commit -m "refactor: centralize Newman execution configuration"
```

---

# 🟡 Milestone 6 — Execution IDs & Better Report Management

## Objective

Give every test execution a unique identity.

Example:

```text
Run ID:
TV-20260808-080512-A7F3
```

Generated files:

```text
reports/
├── TV-20260808-080512-A7F3.html
├── TV-20260808-080512-A7F3.json
└── TV-20260808-080512-A7F3.pdf
```

## Benefits

- Prevent report collisions.
- Make reports traceable.
- Prepare the project for historical analysis.
- Make CI/CD artifacts easier to identify.

## Implementation tasks

- [ ] Generate unique run ID.
- [ ] Attach run ID to report metadata.
- [ ] Use run ID in generated filenames.
- [ ] Display run ID in dashboard.
- [ ] Include execution timestamp.
- [ ] Include collection/environment metadata safely.

## Suggested commit

```bash
git add .
git commit -m "feat: add unique test execution IDs"
```

---

# 🟠 Milestone 7 — Historical Runs & Trend Analytics

## Objective

Move TestVista from a single-run reporter toward a test analytics platform.

Example:

```text
TEST HISTORY

Aug 08   94.7%   53 failures
Aug 07   97.2%   28 failures
Aug 06   99.1%    9 failures
Aug 05   98.4%   16 failures
```

## Potential analytics

### Pass-rate trend

```text
Pass Rate
100% ┤
 98% ┤       ●
 96% ┤   ●       ●
 94% ┤             ●
 92% ┤
     └────────────────
```

### Additional metrics

- Pass-rate trend
- Failure count trend
- Average response time
- Slowest endpoints
- Frequently failing requests
- Iteration failure frequency

## Acceptance criteria

- [ ] Historical reports can be identified.
- [ ] Previous runs can be loaded safely.
- [ ] Trend calculations are accurate.
- [ ] Current report generation still works without history.
- [ ] Historical data does not expose secrets.

## Suggested commit

```bash
git add .
git commit -m "feat: add historical run analytics"
```

---

# 🔴 Milestone 8 — CI/CD Integration

## Objective

Make TestVista suitable for automated pipelines.

## Priority features

### 1. Non-zero exit code

When tests fail:

```text
Newman/TestVista
      ↓
Failures detected
      ↓
process.exit(1)
```

When all tests pass:

```text
process.exit(0)
```

This allows CI systems to correctly mark builds as failed.

### 2. GitHub Actions

Example target:

```yaml
- name: Run API Test Suite
  run: node index.js
```

### 3. Jenkins

Allow TestVista to run as a pipeline step.

### 4. Machine-readable output

Continue supporting sanitized JSON for automation.

## Acceptance criteria

- [ ] Passing run returns exit code 0.
- [ ] Failing run returns non-zero exit code.
- [ ] CI can archive HTML/JSON/PDF artifacts.
- [ ] CI does not expose secrets.
- [ ] Documentation includes a working CI example.

## Suggested commit

```bash
git add .
git commit -m "feat: add CI pipeline support"
```

---

# 🟣 Milestone 9 — Notifications

## Objective

Notify teams when automated test runs fail.

Potential integrations:

- Slack
- Microsoft Teams
- Other webhook-compatible services

Example:

```text
🚨 TestVista API Test Failure

Collection: My API
Environment: Staging
Iterations: 20

Pass Rate: 92%
Failed: 16

Run ID:
TV-20260808-080512-A7F3
```

## Important rule

Notifications must never include:

- Access tokens
- Passwords
- Cookies
- API keys
- Client secrets
- Authorization headers
- Sensitive request/response values

## Suggested commit

```bash
git add .
git commit -m "feat: add test failure notifications"
```

---

# ⚪ Milestone 10 — Optional Product Enhancements

These are valuable, but should come **after the execution and reporting foundation is stable**.

Potential improvements:

- [ ] Dark mode
- [ ] Improved dashboard customization
- [ ] Better report sharing
- [ ] Saved execution configurations
- [ ] Report comparison
- [ ] Regression comparison
- [ ] Slow-request detection
- [ ] Failure categorization
- [ ] Request-level performance insights
- [ ] Advanced filtering
- [ ] Export improvements

These should not distract from the core execution improvements.

---

# 🧪 Testing Strategy for Every Milestone

Every milestone should be tested at three levels.

## 1. Regression Test

Verify existing functionality still works.

```text
Collection only
    ↓
Newman
    ↓
HTML
JSON
PDF
```

## 2. New Feature Test

Verify the newly introduced functionality.

Example:

```text
Collection
+
Environment
    ↓
Newman
    ↓
Correct variables
```

## 3. Security Test

Verify sensitive information is still protected.

Check:

- Authorization headers
- Cookies
- API keys
- Passwords
- Tokens
- JWTs
- Environment secrets
- Sensitive response fields

The security requirement should remain non-negotiable.

---

# 🔐 Security Rules

TestVista's existing security model should be preserved throughout every milestone.

Never allow the generated report to expose:

```text
Authorization
Cookie
Set-Cookie
Bearer tokens
JWTs
Passwords
API keys
Client secrets
Environment secrets
```

All newly introduced data sources must pass through the same sanitization philosophy.

---

# 🏗️ Target Architecture

After the milestones are complete, the architecture should evolve toward:

```text
                    ┌──────────────────────┐
                    │      TestVista       │
                    └──────────┬───────────┘
                               │
                 ┌─────────────▼─────────────┐
                 │  Execution Configuration  │
                 └─────────────┬─────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
     Collection           Environment           Data File
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                         ┌─────▼─────┐
                         │  Newman   │
                         │ Iterations│
                         └─────┬─────┘
                               │
                         ┌─────▼─────┐
                         │   Parser  │
                         └─────┬─────┘
                               │
                         ┌─────▼─────┐
                         │ Sanitizer │
                         └─────┬─────┘
                               │
               ┌───────────────┼────────────────┐
               ▼               ▼                ▼
             HTML             JSON             PDF
               │
               ▼
       Historical Analytics
               │
               ▼
             CI/CD
               │
               ▼
         Notifications
```

---

# 📅 Recommended Development Order

| Priority | Milestone | Recommendation |
|---|---|---|
| 🔴 1 | Environment Support | **Start here** |
| 🔴 2 | Newman Iterations | **Next** |
| 🟢 3 | CSV/JSON Data Files | After iterations work |
| 🟢 4 | Iteration-Aware Reporting | After execution works |
| 🟡 5 | Execution Configuration | Refactor once options grow |
| 🟡 6 | Run IDs | Prepare for history |
| 🟠 7 | Historical Analytics | Later |
| 🔴 8 | CI/CD | Important for portfolio/product maturity |
| 🟣 9 | Notifications | After CI/CD |
| ⚪ 10 | UI Enhancements | Lowest priority |

---

# 🚦 The Rule for Avoiding Feature Overload

For each milestone:

```text
PLAN
  ↓
IMPLEMENT ONE FEATURE
  ↓
TEST
  ↓
FIX
  ↓
REGRESSION TEST
  ↓
COMMIT
  ↓
DOCUMENT
  ↓
NEXT MILESTONE
```

Do **not** move to the next milestone because the code "looks like it should work."

Move forward only when the current milestone passes its acceptance criteria.

---

# 🎯 Immediate Next Step

Start with **Milestone 1 only**.

Your first development target is:

```text
Collection
    +
Optional Postman Environment
    ↓
Newman
    ↓
Existing TestVista Reports
```

Do not implement:

- Iterations
- CSV
- JSON data files
- Historical analytics
- Notifications
- Dark mode

yet.

Once Milestone 1 is working and tested, move to Milestone 2.

---

# 🏆 Final Product Vision

The long-term goal is for TestVista to evolve from:

> **A Newman HTML reporter**

into:

> **A secure, configurable API test execution and reporting platform built around Postman/Newman.**

The progression should remain deliberate:

```text
REPORTER
   ↓
EXECUTION TOOL
   ↓
DATA-DRIVEN TEST RUNNER
   ↓
TEST ANALYTICS PLATFORM
   ↓
CI/CD TESTING PLATFORM
```

The most important part is not how many features TestVista has.

It is how **reliable, secure, modular, and maintainable** each feature is.
