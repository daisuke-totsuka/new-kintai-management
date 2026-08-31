const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const resultPath = path.join(backendDir, "test-results", "result.json");

fs.rmSync(resultPath, { force: true });

const testResult = spawnSync(
  "python",
  ["-m", "pytest", "--json-report", "--json-report-file=test-results/result.json"],
  {
    cwd: backendDir,
    stdio: "inherit",
    shell: false,
  },
);

if (testResult.error) {
  console.error(testResult.error.message);
  process.exit(1);
}

if (!fs.existsSync(resultPath)) {
  console.error(`Pytest result file was not created: ${resultPath}`);
  process.exit(testResult.status || 1);
}

const exportResult = spawnSync("python", ["scripts/export-test-result.py"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: false,
});

if (exportResult.error) {
  console.error(exportResult.error.message);
  process.exit(1);
}

if (exportResult.status !== 0) {
  process.exit(exportResult.status || 1);
}

process.exit(testResult.status || 0);
