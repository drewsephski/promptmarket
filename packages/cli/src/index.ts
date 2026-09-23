#!/usr/bin/env node
import { run } from "./program.js";

const exitCode = await run(process.argv);
process.exitCode = exitCode;
