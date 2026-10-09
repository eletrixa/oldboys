/**
 * The eval set: five synthetic personas, in report order.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/personas/index.ts
 * Deps:    eval/personas/*
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Design constraints:
 * - Fictional people only; adding a persona changes the headline, so re-run `pnpm eval` and commit eval/results.json
 */
import type { Persona } from "../persona";
import { p1 } from "./p1-data-engineer";
import { p2 } from "./p2-frontend";
import { p3 } from "./p3-product-cv";
import { p4 } from "./p4-devops-degraded";
import { p5 } from "./p5-ux-thin";

export const PERSONAS: readonly Persona[] = [p1, p2, p3, p4, p5];
