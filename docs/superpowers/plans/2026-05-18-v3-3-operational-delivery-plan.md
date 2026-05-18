# V3.3 可运营交付闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a V3.3 operational delivery loop that keeps GitHub Actions compatible with Node 24, indexes delivery evidence, maps North Star metrics to runnable checks, and strengthens Docker UI surface evidence.

**Architecture:** This plan adds thin guard tests and documentation around existing workflows instead of replacing release gates. CI changes stay in `.github/workflows/`, operational evidence stays in `docs/`, and UI runtime evidence extends the existing Docker Playwright smoke suite. Each task is independently testable and should be committed separately.

**Tech Stack:** Bun Test, GitHub Actions YAML, Playwright Docker smoke, Markdown docs, existing Bun scripts.

---

## File Structure

- Create `tests/github_actions_node24_guard.test.ts`: guards every workflow file for the Node 24 JavaScript actions opt-in.
- Modify `.github/workflows/ci-quality-gate.yml`: adds top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- Modify `.github/workflows/security-secrets-scan.yml`: adds top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- Modify `.github/workflows/db-repair-drill-manual.yml`: adds top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- Modify `.github/workflows/docker-persistence-manual.yml`: adds top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- Modify `.github/workflows/e2e-real-manual.yml`: adds top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` without changing job-level real E2E secrets.
- Modify `.github/workflows/stress-manual.yml`: adds top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- Create `docs/OPERATIONAL_EVIDENCE.md`: central evidence index for quality, Docker, acceptance, real E2E, DB drill, stress, and security.
- Create `tests/operational_evidence_docs.test.ts`: guards evidence commands and artifact paths.
- Modify `README.md`: links the operational evidence index from the main entry list.
- Modify `docs/RELEASE_CHECKLIST.md`: references the operational evidence index after release artifacts are produced.
- Create `docs/NORTH_STAR_OPERATIONS.md`: maps V3.2 North Star metrics to automated, manual, or evidence-only coverage.
- Create `tests/north_star_operations_docs.test.ts`: guards the North Star matrix against unsupported coverage claims.
- Create `tests/e2e/docker/nebula-core-surfaces.spec.ts`: Docker UI smoke coverage for core Nebula Flow surfaces.
- Modify `tests/docker_ui_smoke_script.test.ts`: locks the new Docker smoke file into the root `docker:ui-smoke` command contract.
- Modify `docs/superpowers/plans/2026-05-18-v3-3-operational-delivery-plan.md`: convert this plan into an implementation record after all tasks are complete.

## Task 1: CI Node 24 Compatibility Guard

**Files:**
- Create: `tests/github_actions_node24_guard.test.ts`
- Modify: `.github/workflows/ci-quality-gate.yml`
- Modify: `.github/workflows/security-secrets-scan.yml`
- Modify: `.github/workflows/db-repair-drill-manual.yml`
- Modify: `.github/workflows/docker-persistence-manual.yml`
- Modify: `.github/workflows/e2e-real-manual.yml`
- Modify: `.github/workflows/stress-manual.yml`

- [ ] **Step 1: Write the failing workflow guard test**

Create `tests/github_actions_node24_guard.test.ts` with this content:

```ts
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()
const workflowsDir = path.resolve(repoPath, '.github/workflows')
const requiredNode24Env = "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'"

const readWorkflow = (fileName: string) => {
  const workflowPath = path.join(workflowsDir, fileName)
  expect(existsSync(workflowPath)).toBe(true)
  return readFileSync(workflowPath, 'utf8')
}

const listWorkflowFiles = () =>
  readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml'))
    .sort()

describe('GitHub Actions Node 24 兼容策略', () => {
  it('所有 workflow 均应显式启用 Node 24 JavaScript actions 运行时', () => {
    const workflowFiles = listWorkflowFiles()

    expect(workflowFiles).toEqual([
      'ci-quality-gate.yml',
      'db-repair-drill-manual.yml',
      'docker-persistence-manual.yml',
      'e2e-real-manual.yml',
      'security-secrets-scan.yml',
      'stress-manual.yml'
    ])

    for (const fileName of workflowFiles) {
      const workflow = readWorkflow(fileName)
      expect(workflow, `${fileName} should opt into Node 24 actions`).toContain(requiredNode24Env)
    }
  })

  it('Quality Gate 和 Docker Delivery 应保留现有执行入口', () => {
    const workflow = readWorkflow('ci-quality-gate.yml')

    expect(workflow).toContain('name: CI · Quality Gate')
    expect(workflow).toContain('name: Release Gate')
    expect(workflow).toContain('name: Docker Delivery')
    expect(workflow).toContain('bun run release:gate')
    expect(workflow).toContain('bun run docker:smoke -- --wait-timeout 420 --keep-up')
    expect(workflow).toContain('bun run docker:ui-smoke')
  })
})
```

- [ ] **Step 2: Run the guard to confirm it fails**

Run:

```bash
bun test tests/github_actions_node24_guard.test.ts --max-concurrency 1
```

Expected: FAIL because none of the workflow files currently contain `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'`.

- [ ] **Step 3: Add the top-level Node 24 env to every workflow**

For each file in `.github/workflows/*.yml`, add this top-level block after the `on:` section and before `jobs:`:

```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'
```

For `.github/workflows/e2e-real-manual.yml`, keep the existing job-level env unchanged:

```yaml
jobs:
  e2e-real:
    name: Real E2E Regression
    runs-on: ubuntu-latest
    timeout-minutes: 60
    env:
      E2E_REAL_CHANNELS: ${{ vars.E2E_REAL_CHANNELS }}
      GEMINI_API_KEYS: ${{ secrets.GEMINI_API_KEYS }}
```

- [ ] **Step 4: Run local workflow guard verification**

Run:

```bash
bun test tests/github_actions_node24_guard.test.ts tests/manual_workflows_presence.test.ts --max-concurrency 1
git diff --check
```

Expected: all tests pass and `git diff --check` exits 0.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add .github/workflows tests/github_actions_node24_guard.test.ts
git commit -m "ci enable node 24 actions runtime"
```

- [ ] **Step 6: Push and verify remote CI**

Run:

```bash
git push
gh run list --limit 6 --json databaseId,workflowName,displayTitle,headSha,status,conclusion,url
```

Expected after remote completion:

- `CI · Security Secrets Scan`: success.
- `CI · Quality Gate`: success.
- The Node.js 20 deprecation annotation is absent, or the run clearly uses the Node 24 opt-in strategy.

## Task 2: Operational Evidence Index

**Files:**
- Create: `docs/OPERATIONAL_EVIDENCE.md`
- Create: `tests/operational_evidence_docs.test.ts`
- Modify: `README.md`
- Modify: `docs/RELEASE_CHECKLIST.md`

- [ ] **Step 1: Write the failing evidence docs guard**

Create `tests/operational_evidence_docs.test.ts` with this content:

```ts
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readFile = (relativePath: string) => {
  const target = path.resolve(repoPath, relativePath)
  expect(existsSync(target)).toBe(true)
  return readFileSync(target, 'utf8')
}

describe('运营证据索引文档', () => {
  it('README 应暴露运营证据入口', () => {
    const readme = readFile('README.md')

    expect(readme).toContain('[docs/OPERATIONAL_EVIDENCE.md](docs/OPERATIONAL_EVIDENCE.md)')
  })

  it('运营证据索引应覆盖发布、部署、验收、真实回归、演练与安全证据', () => {
    const doc = readFile('docs/OPERATIONAL_EVIDENCE.md')

    for (const required of [
      'CI · Quality Gate',
      '.github/workflows/ci-quality-gate.yml',
      'quality-gate-artifacts',
      'artifacts/quality-summary.json',
      'artifacts/slo-report.json',
      'docker-ui-smoke-artifacts',
      'test-results/playwright-docker/',
      'bun run acceptance:deploy -- --base-url http://127.0.0.1:18081',
      'artifacts/deploy-acceptance/<timestamp>/summary.json',
      'E2E_REAL_CHANNELS=true bun run acceptance:real',
      'artifacts/real-acceptance/<timestamp>/summary.json',
      'bun run drill:db-repair',
      'db-repair-drill-artifacts',
      'bun run stress:collab-ws',
      'CI · Security Secrets Scan',
      'gitleaks.sarif'
    ]) {
      expect(doc).toContain(required)
    }
  })

  it('发布检查清单应指向运营证据索引', () => {
    const checklist = readFile('docs/RELEASE_CHECKLIST.md')

    expect(checklist).toContain('docs/OPERATIONAL_EVIDENCE.md')
  })
})
```

- [ ] **Step 2: Run the guard to confirm it fails**

Run:

```bash
bun test tests/operational_evidence_docs.test.ts --max-concurrency 1
```

Expected: FAIL because `docs/OPERATIONAL_EVIDENCE.md` and README/checklist links do not exist yet.

- [ ] **Step 3: Create `docs/OPERATIONAL_EVIDENCE.md`**

Create `docs/OPERATIONAL_EVIDENCE.md` with this content:

```md
# VeoMuse 运营证据索引

本文汇总 V3.3 可运营交付闭环使用的证据入口。它不替代 `docs/RELEASE_CHECKLIST.md`，只作为发布、部署、验收、演练和安全证据的总索引。

## 质量门禁

- Workflow：`CI · Quality Gate`
- 文件：`.github/workflows/ci-quality-gate.yml`
- 入口：`bun run release:gate`
- Artifact：`quality-gate-artifacts`
- 关键产物：`artifacts/quality-summary.json`
- SLO 产物：`artifacts/slo-report.json`
- 通过标准：Release Gate job 为 success，且 quality summary 与 SLO report 已上传。

## Docker Delivery

- Workflow：`CI · Quality Gate`
- Job：`Docker Delivery`
- 入口：`bun run docker:smoke -- --wait-timeout 420 --keep-up`
- 浏览器入口：`bun run docker:ui-smoke`
- Artifact：`docker-ui-smoke-artifacts`
- 关键产物：`test-results/playwright-docker/`
- 通过标准：Docker smoke、Docker UI smoke、artifact upload、compose cleanup 均完成。

## 部署态只读验收

- 命令：`bun run acceptance:deploy -- --base-url http://127.0.0.1:18081`
- 产物：`artifacts/deploy-acceptance/<timestamp>/summary.json`
- 通过标准：summary 记录目标 base URL、健康探测、只读验收步骤与失败原因。

## 真实渠道验收

- 命令：`E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url https://veomuse.example.com --api-base-url https://api.veomuse.example.com`
- 产物：`artifacts/real-acceptance/<timestamp>/summary.json`
- 通过标准：真实环境 precheck、就绪探测、外部 real 回归与失败步骤均被记录。
- 跳过条件：真实渠道环境变量或凭证缺失时，只能标记为未执行，不能标记为通过。

## DB 修复演练

- Manual workflow：`Manual · DB Repair Drill`
- 命令：`bun run drill:db-repair`
- Artifact：`db-repair-drill-artifacts`
- 关键产物：`data/drills/`、`artifacts/db-repair-drill.log`
- 通过标准：损坏注入、检测、备份、修复和演练日志完整。

## 协作 WebSocket 压测

- Manual workflow：`Manual · Collaboration WS Stress`
- 命令：`bun run stress:collab-ws`
- Artifact：`stress-artifacts`
- 关键产物：`artifacts/stress-collab-ws.log`
- 通过标准：压测脚本退出 0，artifact 上传成功。

## 安全扫描

- Workflow：`CI · Security Secrets Scan`
- 轻量入口：`bun run security:scan`
- 深度扫描：`gitleaks/gitleaks-action@v2`
- SARIF：`gitleaks.sarif`
- 通过标准：Bun Secrets Guard 与 Gitleaks Deep Scan 均为 success。
```

- [ ] **Step 4: Link the evidence index from README and release checklist**

Add this bullet to `README.md` under `## 主入口`:

```md
- 运营证据索引：[docs/OPERATIONAL_EVIDENCE.md](docs/OPERATIONAL_EVIDENCE.md)
```

Add this sentence to `docs/RELEASE_CHECKLIST.md` after the deployment artifact standards:

```md
证据索引与跳过口径见：`docs/OPERATIONAL_EVIDENCE.md`。
```

- [ ] **Step 5: Run evidence docs verification**

Run:

```bash
bun test tests/operational_evidence_docs.test.ts --max-concurrency 1
git diff --check
```

Expected: all tests pass and `git diff --check` exits 0.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add README.md docs/RELEASE_CHECKLIST.md docs/OPERATIONAL_EVIDENCE.md tests/operational_evidence_docs.test.ts
git commit -m "docs add operational evidence index"
```

## Task 3: North Star Operations Matrix

**Files:**
- Create: `docs/NORTH_STAR_OPERATIONS.md`
- Create: `tests/north_star_operations_docs.test.ts`
- Modify: `docs/requirements/PROJECT_REQUIREMENTS.md`

- [ ] **Step 1: Write the failing North Star docs guard**

Create `tests/north_star_operations_docs.test.ts` with this content:

```ts
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readFile = (relativePath: string) => {
  const target = path.resolve(repoPath, relativePath)
  expect(existsSync(target)).toBe(true)
  return readFileSync(target, 'utf8')
}

describe('V3.2 北极星指标运营化文档', () => {
  it('需求文档应指向北极星运营矩阵', () => {
    const requirements = readFile('docs/requirements/PROJECT_REQUIREMENTS.md')

    expect(requirements).toContain('docs/NORTH_STAR_OPERATIONS.md')
  })

  it('北极星运营矩阵应覆盖所有 V3.2 NS 指标并声明覆盖状态', () => {
    const doc = readFile('docs/NORTH_STAR_OPERATIONS.md')

    for (const required of [
      '关键主链路端到端成功率 >= 99.5%',
      '非 AI API P95 响应时间 <= 400ms',
      '新用户首次完成创建工作区到导出平均步骤 <= 8',
      '数据库损坏修复演练脚本每周稳定通过',
      '主分支安全门禁全绿',
      '自动覆盖',
      '手动复验',
      '证据产物',
      'artifacts/slo-report.json',
      'bun run e2e:smoke -- --workers=1 --retries=0',
      'bun run drill:db-repair',
      'CI · Security Secrets Scan',
      'CI · Quality Gate'
    ]) {
      expect(doc).toContain(required)
    }
  })

  it('暂未自动覆盖的指标不得写成已自动通过', () => {
    const doc = readFile('docs/NORTH_STAR_OPERATIONS.md')

    expect(doc).toContain('| 新用户首次完成创建工作区到导出平均步骤 <= 8 | 手动复验 |')
    expect(doc).not.toContain('| 新用户首次完成创建工作区到导出平均步骤 <= 8 | 自动覆盖 |')
  })
})
```

- [ ] **Step 2: Run the guard to confirm it fails**

Run:

```bash
bun test tests/north_star_operations_docs.test.ts --max-concurrency 1
```

Expected: FAIL because `docs/NORTH_STAR_OPERATIONS.md` and the requirements link do not exist yet.

- [ ] **Step 3: Create `docs/NORTH_STAR_OPERATIONS.md`**

Create `docs/NORTH_STAR_OPERATIONS.md` with this content:

```md
# V3.2 北极星指标运营矩阵

本文把 `docs/requirements/PROJECT_REQUIREMENTS.md` 中的 V3.2 北极星目标映射到 V3.3 可运营交付闭环。覆盖状态只描述当前证据，不把手动复验写成自动通过。

| 指标 | 覆盖状态 | 运行入口 | 证据产物 | 通过口径 |
| --- | --- | --- | --- | --- |
| 关键主链路端到端成功率 >= 99.5% | 自动覆盖 | `bun run e2e:smoke -- --workers=1 --retries=0` 与 `bun run release:gate` | `playwright-report/`、`artifacts/quality-summary.json` | E2E 与 Release Gate 均通过；真实渠道另看 real acceptance |
| 非 AI API P95 响应时间 <= 400ms | 自动覆盖 | `bun run release:gate` | `artifacts/slo-report.json` | main 分支使用 hard SLO gate，报告中非 AI API 样本满足阈值 |
| 新用户首次完成创建工作区到导出平均步骤 <= 8 | 手动复验 | 功能导览与主链路 E2E 复查 | 复验记录或后续专项 artifact | 当前缺少自动步数统计，不能声明自动通过 |
| 数据库损坏修复演练脚本每周稳定通过 | 手动复验 | `bun run drill:db-repair` 或 `Manual · DB Repair Drill` | `data/drills/`、`artifacts/db-repair-drill.log` | 每周 manual workflow 成功并上传演练日志 |
| 主分支安全门禁全绿 | 自动覆盖 | `CI · Security Secrets Scan` 与 `CI · Quality Gate` | `gitleaks.sarif`、`quality-gate-artifacts` | Secrets Scan、Release Gate、Docker Delivery 均为 success |
```

- [ ] **Step 4: Link the matrix from requirements**

In `docs/requirements/PROJECT_REQUIREMENTS.md`, under `### 5.1 北极星目标（NS）`, add this sentence after the bullet list:

```md
运营化映射与证据口径见：`docs/NORTH_STAR_OPERATIONS.md`。
```

- [ ] **Step 5: Run North Star verification**

Run:

```bash
bun test tests/north_star_operations_docs.test.ts --max-concurrency 1
git diff --check
```

Expected: all tests pass and `git diff --check` exits 0.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add docs/requirements/PROJECT_REQUIREMENTS.md docs/NORTH_STAR_OPERATIONS.md tests/north_star_operations_docs.test.ts
git commit -m "docs map north star operations evidence"
```

## Task 4: Docker Nebula Core Surface Evidence

**Files:**
- Create: `tests/e2e/docker/nebula-core-surfaces.spec.ts`
- Modify: `tests/docker_ui_smoke_script.test.ts`

- [ ] **Step 1: Write the failing root script guard**

In `tests/docker_ui_smoke_script.test.ts`, extend the existing Docker UI smoke command test with this expectation:

```ts
expect(script).toContain('nebula-core-surfaces.spec.ts')
```

Run:

```bash
bun test tests/docker_ui_smoke_script.test.ts --max-concurrency 1
```

Expected: FAIL because the root Docker UI smoke command does not yet mention `nebula-core-surfaces.spec.ts`.

- [ ] **Step 2: Create the Nebula core surfaces Docker spec**

Create `tests/e2e/docker/nebula-core-surfaces.spec.ts` with this content:

```ts
import { expect, test, type Page } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

const observeFatalBrowserSignals = (page: Page) => {
  const failures: string[] = []

  page.on('pageerror', (error) => failures.push(`pageerror: ${error?.message || error}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      failures.push(`console.${msg.type()}: ${msg.text()}`)
    }
  })

  return () => {
    expect(failures, failures.join('\n')).toEqual([])
  }
}

const assertNebulaSurface = async (page: Page, testId: string, label: string) => {
  const surface = page.getByTestId(testId)
  await expect(surface, `${label} should exist`).toBeVisible()
  const metrics = await surface.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return {
      height: rect.height,
      scrollHeight: node.scrollHeight,
      scrollWidth: node.scrollWidth,
      width: rect.width
    }
  })

  expect(metrics.width, `${label} width`).toBeGreaterThan(24)
  expect(metrics.height, `${label} height`).toBeGreaterThan(16)
  expect(metrics.scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(
    Math.ceil(metrics.width) + 3
  )
  expect(metrics.scrollHeight, `${label} vertical overflow`).toBeLessThanOrEqual(
    Math.ceil(metrics.height) + 3
  )
}

test.setTimeout(120_000)

test('Docker Nebula Flow 核心 surface 应保留部署态语义与浏览器健康', async ({ page }) => {
  attachPageDebug(page, 'docker-nebula-core-surfaces')
  const assertNoFatalBrowserSignals = observeFatalBrowserSignals(page)

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissGuideIfPresent(page)

  await assertNebulaSurface(page, 'director-flow-bus', 'Director Flow')
  await assertNebulaSurface(page, 'director-canvas-launchpad', 'Director Canvas')
  await assertNebulaSurface(page, 'output-dock', 'Output Dock')
  await assertNebulaSurface(page, 'timeline-bus', 'Timeline Bus')
  await assertNebulaSurface(page, 'command-rail-flow', 'Command Rail')

  await page.getByTestId('btn-mode-audio').click()
  await assertNebulaSurface(page, 'audio-bus', 'Audio Bus')

  await page.getByTestId('btn-mode-color').click()
  await page.getByTestId('btn-lab-mode-watch').click()
  await assertNebulaSurface(page, 'watch-bus', 'Watch Bus')

  await page.getByTestId('btn-lab-mode-compare').click()
  await assertNebulaSurface(page, 'experiment-bus', 'Experiment Bus')

  assertNoFatalBrowserSignals()
})
```

- [ ] **Step 3: Include the new spec in the Docker UI smoke script contract**

If `package.json` currently runs all docker project tests implicitly, update the script only if needed. If no script change is needed, change `tests/docker_ui_smoke_script.test.ts` so it asserts the new file exists and remains under `tests/e2e/docker/`.

Use this assertion if the package script stays broad:

```ts
expect(existsSync(path.resolve(repoPath, 'tests/e2e/docker/nebula-core-surfaces.spec.ts'))).toBe(
  true
)
```

The file already imports `existsSync` and `path` if the test currently uses them; if not, add:

```ts
import { existsSync, readFileSync } from 'fs'
import path from 'path'
```

- [ ] **Step 4: Run the Docker surface tests**

Run:

```bash
bun test tests/docker_ui_smoke_script.test.ts --max-concurrency 1
bun run docker:ui-smoke -- --workers=1 --retries=0 tests/e2e/docker/nebula-core-surfaces.spec.ts tests/e2e/docker/experiment-bus-overlay.spec.ts tests/e2e/docker/all-ui-surfaces.spec.ts
git diff --check
```

Expected: unit guard passes, Docker Playwright tests pass, and `git diff --check` exits 0.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add tests/docker_ui_smoke_script.test.ts tests/e2e/docker/nebula-core-surfaces.spec.ts
git commit -m "test guard nebula core docker surfaces"
```

## Task 5: Plan Closure and Remote Verification Record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-18-v3-3-operational-delivery-plan.md`

- [ ] **Step 1: Update this plan into an implementation record**

Append this section to the end of this file after all previous tasks are complete:

```md
## Implementation Record

### Task 1: CI Node 24 Compatibility Guard

- Added `tests/github_actions_node24_guard.test.ts`.
- Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` to all GitHub Actions workflows.
- Verification:
  - `bun test tests/github_actions_node24_guard.test.ts tests/manual_workflows_presence.test.ts --max-concurrency 1`
  - `git diff --check`

### Task 2: Operational Evidence Index

- Added `docs/OPERATIONAL_EVIDENCE.md`.
- Added `tests/operational_evidence_docs.test.ts`.
- Linked the evidence index from README and release checklist.
- Verification:
  - `bun test tests/operational_evidence_docs.test.ts --max-concurrency 1`
  - `git diff --check`

### Task 3: North Star Operations Matrix

- Added `docs/NORTH_STAR_OPERATIONS.md`.
- Added `tests/north_star_operations_docs.test.ts`.
- Linked the matrix from `docs/requirements/PROJECT_REQUIREMENTS.md`.
- Verification:
  - `bun test tests/north_star_operations_docs.test.ts --max-concurrency 1`
  - `git diff --check`

### Task 4: Docker Nebula Core Surface Evidence

- Added `tests/e2e/docker/nebula-core-surfaces.spec.ts`.
- Updated Docker smoke guards to keep the surface spec discoverable.
- Verification:
  - `bun test tests/docker_ui_smoke_script.test.ts --max-concurrency 1`
  - `bun run docker:ui-smoke -- --workers=1 --retries=0 tests/e2e/docker/nebula-core-surfaces.spec.ts tests/e2e/docker/experiment-bus-overlay.spec.ts tests/e2e/docker/all-ui-surfaces.spec.ts`
  - `git diff --check`

### Remote Verification

- `CI · Security Secrets Scan`: success
- `CI · Quality Gate`: success
- `Release Gate`: success
- `Docker Delivery`: success
```

- [ ] **Step 2: Run the plan index guard**

Run:

```bash
bun test tests/workflow_docs_presence.test.ts --max-concurrency 1
git diff --check
```

Expected: the plan remains indexed in `docs/superpowers/README.md`, all checks pass, and whitespace is clean.

- [ ] **Step 3: Commit Task 5**

Run:

```bash
git add docs/superpowers/plans/2026-05-18-v3-3-operational-delivery-plan.md
git commit -m "docs record v3.3 operational delivery implementation"
```

- [ ] **Step 4: Push and close remote gate**

Run:

```bash
git push
gh run list --limit 6 --json databaseId,workflowName,displayTitle,headSha,status,conclusion,url
```

Expected after completion:

- Latest `CI · Security Secrets Scan`: success.
- Latest `CI · Quality Gate`: success.
- Latest `Docker Delivery`: success.
- Local `git status --short --branch` shows `## main...origin/main`.

## Self-Review

- Spec coverage: Task 1 covers CI Node 24 compatibility; Task 2 covers operational evidence indexing; Task 3 covers North Star runtime mapping; Task 4 covers deployed visual surface evidence; Task 5 covers closure and remote verification evidence.
- Placeholder scan: this plan intentionally contains no placeholder sections or deferred implementation steps.
- Type and naming consistency: all new test filenames, doc paths, commands, artifact paths, and workflow names are used consistently across tasks.
