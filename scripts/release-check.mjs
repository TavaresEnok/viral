#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

const argv = new Set(process.argv.slice(2));
const skipInstall = argv.has("--skip-install");
const skipBuild = argv.has("--skip-build");
const skipTests = argv.has("--skip-tests");
const strict = argv.has("--strict");

const steps = [
    !skipInstall
        ? {
              name: "Install (frozen lockfile)",
              cmd: "corepack",
              args: ["pnpm", "install", "--frozen-lockfile"],
          }
        : null,
    { name: "Typecheck", cmd: "corepack", args: ["pnpm", "typecheck"] },
    {
        name: strict ? "Lint (strict)" : "Lint",
        cmd: "corepack",
        args: ["pnpm", strict ? "lint:strict" : "lint"],
    },
    !skipTests
        ? { name: "Test", cmd: "corepack", args: ["pnpm", "test"] }
        : null,
    !skipBuild
        ? { name: "Build", cmd: "corepack", args: ["pnpm", "build"] }
        : null,
].filter(Boolean);

const results = [];

function runStep(step) {
    const startedAt = performance.now();
    console.log(`\n==> ${step.name}`);

    const result = spawnSync(step.cmd, step.args, {
        stdio: "inherit",
        shell: false,
    });

    const durationSec = ((performance.now() - startedAt) / 1000).toFixed(1);
    const ok = result.status === 0;
    results.push({ name: step.name, ok, durationSec });

    if (!ok) {
        console.error(`\n✖ ${step.name} failed after ${durationSec}s`);
        printSummary();
        process.exit(result.status ?? 1);
    }

    console.log(`✔ ${step.name} passed in ${durationSec}s`);
}

function printSummary() {
    console.log("\nRelease check summary:");
    for (const item of results) {
        const icon = item.ok ? "✔" : "✖";
        console.log(`  ${icon} ${item.name} (${item.durationSec}s)`);
    }
}

for (const step of steps) {
    runStep(step);
}

printSummary();
console.log("\n✅ Release check completed successfully.");
