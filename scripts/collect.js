#!/usr/bin/env node
import { collectAll } from '../src/collect.js';
import { ensureCurrentWeek } from '../src/rotation.js';

const limit = Number(process.argv[2]) || 1200;
await collectAll({ limit });
ensureCurrentWeek({ log: console.log });
