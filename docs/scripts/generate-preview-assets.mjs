import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { demoPrompt, demoResults, demoStates } from "./demo-data.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const assetsDir = join(repoRoot, "docs", "assets");
const generatedDir = join(assetsDir, "generated");
const framesDir = join(generatedDir, "frames");
const manifestPath = join(generatedDir, "animation-manifest.json");

mkdirSync(generatedDir, { recursive: true });
mkdirSync(framesDir, { recursive: true });

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
  return pathToFileURL(path).href;
}

function screenshot(browserPath, sourcePath, targetPath, width, height) {
  run(browserPath, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    `--screenshot=${targetPath}`,
    toFileUrl(sourcePath),
  ]);
}

function buildAnimationFrames() {
  return [
    {
      key: "frame-1",
      headline: "Racing 4 models...",
      rows: demoStates.map((state) => ({ ...state, status: "waiting", tokensReceived: 0, elapsedMs: 0, costUsd: 0, error: undefined })),
      showScores: false,
      showSaved: false,
      duration: 500,
    },
    {
      key: "frame-2",
      headline: "Racing 4 models...",
      rows: [
        { ...demoStates[0], status: "streaming", tokensReceived: 68, elapsedMs: 700, costUsd: 0.0013 },
        { ...demoStates[1], status: "waiting", tokensReceived: 0, elapsedMs: 0, costUsd: 0, error: undefined },
        { ...demoStates[2], status: "streaming", tokensReceived: 81, elapsedMs: 500, costUsd: 0.0002 },
        { ...demoStates[3], status: "waiting", tokensReceived: 0, elapsedMs: 0, costUsd: 0, error: undefined },
      ],
      showScores: false,
      showSaved: false,
      duration: 650,
    },
    {
      key: "frame-3",
      headline: "Racing 4 models...",
      rows: [
        { ...demoStates[0] },
        { ...demoStates[1], status: "streaming", tokensReceived: 140, elapsedMs: 1900, costUsd: 0.0042 },
        { ...demoStates[2] },
        { ...demoStates[3] },
      ],
      showScores: false,
      showSaved: false,
      duration: 700,
    },
    {
      key: "frame-4",
      headline: "Race complete",
      rows: demoStates,
      showScores: true,
      showSaved: false,
      duration: 900,
    },
    {
      key: "frame-5",
      headline: "Race complete",
      rows: demoStates,
      showScores: true,
      showSaved: true,
      duration: 1400,
    },
  ];
}

run(process.execPath, getTscArgs());

const { generateCards } = await import(
  pathToFileURL(join(repoRoot, "dist", "card.js")).href
);

const resultBasePath = join(generatedDir, "demo-result-card");
const resultHtml = `${resultBasePath}.html`;
const terminalPng = join(assetsDir, "terminal-race-preview.png");
const resultPng = join(assetsDir, "result-card-preview.png");
const terminalGif = join(assetsDir, "terminal-race-demo.gif");

await generateCards(demoPrompt, demoResults, resultBasePath);

const browserPath = getChromePath();
const animationFrames = buildAnimationFrames();
const frameManifest = {
  output: terminalGif,
  max_width: 1100,
  frames: [],
};

for (const frame of animationFrames) {
  const htmlPath = join(framesDir, `${frame.key}.html`);
  const pngPath = join(framesDir, `${frame.key}.png`);

  writeFileSync(
    htmlPath,
    buildTerminalPreviewHtml({
      headline: frame.headline,
      rows: frame.rows,
      showScores: frame.showScores,
      showSaved: frame.showSaved,
    }),
    "utf-8",
  );

  screenshot(browserPath, htmlPath, pngPath, 1380, 900);
  frameManifest.frames.push({ path: pngPath, duration: frame.duration });
}

copyFileSync(join(framesDir, "frame-5.png"), terminalPng);
screenshot(browserPath, resultHtml, resultPng, 980, 760);
writeFileSync(manifestPath, JSON.stringify(frameManifest, null, 2), "utf-8");

run("python", [join(scriptDir, "build-demo-gif.py"), manifestPath]);

function buildTerminalPreviewHtml({ headline, rows, showScores, showSaved }) {
  const winner = demoResults[0];

  const rowMarkup = rows
    .map((state) => {
      const isWinner = state.name === winner.name;
      const statusColor =
        state.status === "done"
          ? "#4ade80"
          : state.status === "failed"
            ? "#fb7185"
            : state.status === "streaming"
              ? "#38bdf8"
              : "#64748b";

      return `
        <div class="row ${isWinner && state.status !== "waiting" ? "winner" : ""}">
          <div class="cell model">${isWinner && state.status !== "waiting" ? "★ " : ""}${escapeHtml(state.name)}</div>
          <div class="cell status" style="color:${statusColor}">${escapeHtml(state.status)}</div>
          <div class="cell tokens">${state.tokensReceived > 0 ? state.tokensReceived : "-"}</div>
          <div class="cell time">${state.elapsedMs > 0 ? formatTime(state.elapsedMs) : "-"}</div>
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
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: radial-gradient(circle at top, #15233b 0%, #090f1c 55%, #050911 100%);
      overflow: hidden;
    }
    body {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      color: #e2e8f0;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
    }
    .window {
      width: 1260px;
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
    .brand {
      font-size: 34px;
      font-weight: 800;
      color: #f8fafc;
    }
    .state {
      font-size: 28px;
      font-weight: 700;
      color: ${headline === "Race complete" ? "#38bdf8" : "#38bdf8"};
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
      min-height: 58px;
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
    .winner-callout {
      margin-top: 18px;
      color: #4ade80;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 24px;
      font-weight: 800;
      min-height: 34px;
      visibility: ${showScores ? "visible" : "hidden"};
    }
    .winner-callout span {
      color: #94a3b8;
      font-weight: 500;
      font-size: 20px;
    }
    .score-table {
      margin-top: 22px;
      border: 1px solid #1e293b;
      border-radius: 18px;
      overflow: hidden;
      background: #0a1324;
      visibility: ${showScores ? "visible" : "hidden"};
      min-height: 232px;
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
    .saved {
      margin-top: 10px;
      color: #64748b;
      font-size: 17px;
      min-height: 24px;
      visibility: ${showSaved ? "visible" : "hidden"};
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
        <div class="state">${escapeHtml(headline)}</div>
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
        ${rowMarkup}
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
