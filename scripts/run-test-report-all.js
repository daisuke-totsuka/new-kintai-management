const { spawnSync } = require("child_process");

const npmCommand = "npm";

const commands = [
  {
    name: "Frontend",
    args: ["--prefix", "frontend", "run", "test:report"],
  },
  {
    name: "Backend",
    args: ["run", "test:report:backend"],
  },
];

let exitCode = 0;

for (const command of commands) {
  console.log(`\n[${command.name}] npm ${command.args.join(" ")}`);
  const result = spawnSync(npmCommand, command.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    exitCode = 1;
    continue;
  }

  if (result.status !== 0) {
    exitCode = result.status || 1;
  }
}

process.exit(exitCode);
