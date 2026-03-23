/**
 * Doom loop detection helpers.
 *
 * Shared between ToolExecutor (production) and tests so the
 * comparison algorithm cannot drift between the two.
 */

import type { TaskState } from "./TaskState"

export const DOOM_LOOP_SOFT_THRESHOLD = 3
export const DOOM_LOOP_HARD_THRESHOLD = 5

/**
 * Recursive canonical JSON serialization.
 * Sorts keys at every level so that semantically identical objects
 * with different key order produce the same string.
 */
export function stableStringify(value: unknown): string {
	if (value === null || value === undefined) {
		return JSON.stringify(value)
	}
	if (typeof value !== "object") {
		return JSON.stringify(value)
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`
	}
	const obj = value as Record<string, unknown>
	const sortedKeys = Object.keys(obj).sort()
	const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
	return `{${pairs.join(",")}}`
}

/**
 * Compute the canonical signature for a tool call.
 * Two calls are considered identical when they share the same name and signature.
 */
export function toolCallSignature(params: Record<string, unknown> | undefined): string {
	return stableStringify(params ?? {})
}

export interface DoomLoopResult {
	softWarning: boolean
	hardEscalation: boolean
}

/**
 * Core doom loop detection step. Must be called BEFORE updating
 * lastToolName / lastToolParams on TaskState.
 *
 * Compares the current call against the previous state, updates the
 * counter, and returns which thresholds (if any) were crossed.
 */
export function checkDoomLoop(state: TaskState, toolName: string, currentSignature: string): DoomLoopResult {
	if (toolName === state.lastToolName && currentSignature === state.lastToolParams) {
		state.consecutiveIdenticalToolCount++
	} else {
		state.consecutiveIdenticalToolCount = 1
	}

	return {
		softWarning: state.consecutiveIdenticalToolCount === DOOM_LOOP_SOFT_THRESHOLD,
		hardEscalation: state.consecutiveIdenticalToolCount >= DOOM_LOOP_HARD_THRESHOLD,
	}
}
