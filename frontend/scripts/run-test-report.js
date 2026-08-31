const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const resultPath = path.join(rootDir, "test-results", "result.json");
const vitestBin = path.join(rootDir, "node_modules", "vitest", "vitest.mjs");

fs.rmSync(resultPath, { force: true });

const testResult = spawnSync(
  process.execPath,
  [
    vitestBin,
    "run",
    "--reporter=json",
    "--outputFile=test-results/result.json",
    "--no-file-parallelism",
    "--maxWorkers=1",
    "--maxConcurrency=1",
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  },
);

if (testResult.error) {
  console.error(testResult.error.message);
  process.exit(1);
}

if (!fs.existsSync(resultPath)) {
  console.error(`Vitest result file was not created: ${resultPath}`);
  process.exit(testResult.status || 1);
}

const exportResult = spawnSync(process.execPath, ["scripts/export-test-result.js"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
});

if (exportResult.status !== 0) {
  process.exit(exportResult.status || 1);
}

process.exit(testResult.status || 0);
