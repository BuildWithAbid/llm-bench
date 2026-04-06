import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { demoPrompt, demoResults, demoStates } from "./demo-data.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const assetsDir = join(repoRoot, "docs", "assets");
const generatedDir = join(assetsDir, "generated");

mkdirSync(generatedDir, { recursive: true });

function run(command, args, options = {}) {
  const isWindowsCmd =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(command);

  const result = isWindowsCmd
    ? spawnSync(
        quoteCmdCommand(command, args),
        [],
        {
          cwd: repoRoot,
          stdio: "inherit",
          ...options,
          shell: true,
        },
      )
    : spawnSync(command, args, {
        cwd: repoRoot,
        stdio: "inherit",
        ...options,
        shell: false,
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with code ${result.status}`);
  }
}

function quoteCmdArgument(value) {
  const stringValue = String(value);
  if (!/[\s"]/u.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function quoteCmdCommand(command, args) {
  return [quoteCmdArgument(command), ...args.map(quoteCmdArgument)].join(" ");
}

function getTscArgs() {
  return [join(repoRoot, "node_modules", "typescript", "bin", "tsc")];
}

function getChromePath() {
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
        ];

  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) {
    throw new Error("No supported Chrome or Edge binary found for screenshot generation.");
  }

  return browser;
}

function toFileUrl(path) {
  const normalized = path.replace(/\\/g, "/");
  return `file:///${normalized}`;
}

function screenshot(browserPath, sourcePath, targetPath, width, height) {
  run(browserPath, [
    "--headless",
    "--disable-gpu",
    `--window-size=${width},${height}`,
    `--screenshot=${targetPath}`,
    "--hide-scrollbars",
    toFileUrl(sourcePath),
  ]);
}

run(process.execPath, getTscArgs());

const terminalPng = join(assetsDir, "terminal-race-preview.png");
const resultHtml = join(generatedDir, "demo-result-card.html");
const resultPng = join(assetsDir, "result-card-preview.png");
const terminalHtml = join(generatedDir, "terminal-preview.html");

const { generateCards } = await import(pathToFileURL(join(repoRoot, "dist", "card.js")).href);

await generateCards(demoPrompt, demoResults, join(generatedDir, "demo-result-card"));
writeFileSync(terminalHtml, buildTerminalPreviewHtml(), "utf-8");

const browserPath = getChromePath();
screenshot(browserPath, terminalHtml, terminalPng, 1440, 980);
screenshot(browserPath, resultHtml, resultPng, 1280, 1100);

function buildTerminalPreviewHtml() {
  const winner = demoResults[0];
  const rows = demoStates
    .map((state) => {
      const isWinner = state.name === winner.name;
      const statusColor =
        state.status === "done"
          ? "#4ade80"
          : state.status === "failed"
            ? "#fb7185"
            : "#38bdf8";

      return `
        <div class="row ${isWinner ? "winner" : ""}">
          <div class="cell model">${isWinner ? "★ " : ""}${escapeHtml(state.name)}</div>
          <div class="cell status" style="color:${statusColor}">${escapeHtml(state.status)}</div>
          <div class="cell tokens">${state.tokensReceived > 0 ? state.tokensReceived : "-"}</div>
          <div class="cell time">${formatTime(state.elapsedMs)}</div>
          <div class="cell cost">${state.costUsd > 0 ? formatCost(state.costUsd) : "-"}</div>
          <div class="cell error">${state.error ? escapeHtml(state.error) : ""}</div>
        </div>
      `;
    })
    .join("");

  const scoreRows = demoResults
    .map(
      (result, index) => `
        <div class="score-row ${index === 0 ? "winner" : ""}">
          <div class="score-cell rank">${index + 1}.</div>
          <div class="score-cell model">${escapeHtml(result.name)}</div>
          <div class="score-cell">${result.speedScore.toFixed(1)}</div>
          <div class="score-cell">${result.costScore.toFixed(1)}</div>
          <div class="score-cell">${result.qualityScore.toFixed(1)}</div>
          <div class="score-cell overall">${result.overallScore.toFixed(1)}</div>
        </div>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLM Bench Terminal Preview</title>
  <style>
    body {
      margin: 0;
      background: radial-gradient(circle at top, #15233b 0%, #090f1c 55%, #050911 100%);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      color: #e2e8f0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 40px;
      box-sizing: border-box;
    }
    .window {
      width: 1280px;
      border-radius: 22px;
      overflow: hidden;
      background: #0b1220;
      border: 1px solid #1e293b;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    .titlebar {
      height: 54px;
      background: #10192b;
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 10px;
      color: #cbd5e1;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 18px;
      font-weight: 600;
    }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.red { background: #fb7185; }
    .dot.yellow { background: #fbbf24; }
    .dot.green { background: #34d399; }
    .title {
      margin-left: auto;
      margin-right: auto;
      transform: translateX(-34px);
    }
    .content {
      padding: 34px 36px 30px;
    }
    .hero {
      display: flex;
      align-items: baseline;
      gap: 18px;
      margin-bottom: 12px;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    .hero .brand {
      font-size: 34px;
      font-weight: 800;
      color: #f8fafc;
    }
    .hero .state {
      font-size: 28px;
      font-weight: 700;
      color: #38bdf8;
    }
    .prompt {
      color: #94a3b8;
      font-size: 19px;
      margin-bottom: 26px;
    }
    .table {
      border: 1px solid #1e293b;
      border-radius: 18px;
      overflow: hidden;
      background: #09111d;
    }
    .header, .row, .score-header, .score-row {
      display: grid;
      grid-template-columns: 300px 150px 120px 120px 140px 1fr;
      align-items: center;
      column-gap: 18px;
      padding: 16px 20px;
    }
    .header, .score-header {
      color: #64748b;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .row {
      border-top: 1px solid #132033;
      font-size: 22px;
    }
    .row.winner {
      background: rgba(20, 83, 45, 0.45);
    }
    .cell.model {
      color: #f8fafc;
      font-weight: 700;
    }
    .cell.error {
      color: #94a3b8;
      font-size: 17px;
      text-align: right;
    }
    .score-table {
      margin-top: 22px;
      border: 1px solid #1e293b;
      border-radius: 18px;
      overflow: hidden;
      background: #0a1324;
    }
    .score-header, .score-row {
      grid-template-columns: 80px 320px 120px 120px 120px 120px;
    }
    .score-row {
      border-top: 1px solid #132033;
      font-size: 21px;
    }
    .score-row.winner {
      background: rgba(20, 83, 45, 0.45);
    }
    .score-cell.model {
      color: #f8fafc;
      font-weight: 700;
    }
    .score-cell.overall {
      color: #4ade80;
      font-weight: 800;
    }
    .winner-callout {
      margin-top: 18px;
      color: #4ade80;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 24px;
      font-weight: 800;
    }
    .winner-callout span {
      color: #94a3b8;
      font-weight: 500;
      font-size: 20px;
    }
    .saved {
      margin-top: 10px;
      color: #64748b;
      font-size: 17px;
    }
  </style>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="dot red"></div>
      <div class="dot yellow"></div>
      <div class="dot green"></div>
      <div class="title">llm-bench live benchmark</div>
    </div>
    <div class="content">
      <div class="hero">
        <div class="brand">LLM Bench</div>
        <div class="state">Race complete</div>
      </div>
      <div class="prompt">Prompt: ${escapeHtml(demoPrompt)}</div>

      <div class="table">
        <div class="header">
          <div>Model</div>
          <div>Status</div>
          <div>Tokens</div>
          <div>Time</div>
          <div>Cost</div>
          <div></div>
        </div>
        ${rows}
      </div>

      <div class="winner-callout">
        Winner: ${escapeHtml(winner.name)}
        <span>(${formatTime(winner.elapsedMs)}, ${formatCost(winner.costUsd)}, score: ${winner.overallScore.toFixed(1)})</span>
      </div>

      <div class="score-table">
        <div class="score-header">
          <div>#</div>
          <div>Model</div>
          <div>Speed</div>
          <div>Cost</div>
          <div>Quality</div>
          <div>Overall</div>
        </div>
        ${scoreRows}
      </div>

      <div class="saved">Cards saved to docs/assets/generated/demo-result-card.txt and docs/assets/generated/demo-result-card.html</div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cost) {
  if (cost === 0) return "-";
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}
