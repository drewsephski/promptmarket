#!/usr/bin/env node
import { run } from "../dist/program.js";

process.exitCode = await run(process.argv);
