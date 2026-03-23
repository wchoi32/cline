/**
 * Repeated tool call loop detection.
 *
 * Detects when the LLM calls the same tool with identical arguments
 * repeatedly, which wastes tokens without making progress.
 *
 * This is complementary to fileReadCache in ReadFileToolHandler, which
 * deduplicates file *content* on cache hits but still allows the tool
 * call to succeed and consume a turn. Loop detection catches the
 * repeated call pattern itself, regardless of which tool is involved.
 *
 * Shared between ToolExecutor (production) and tests so the
 * comparison algorithm cannot drift between the two.
 */

import type { TaskState } from "./TaskState"

export const LOOP_DETECTION_SOFT_THRESHOLD = 3
export const LOOP_DETECTION_HARD_THRESHOLD = 5

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

export interface LoopDetectionResult {
	softWarning: boolean
	hardEscalation: boolean
}

/**
 * Core loop detection step. Must be called BEFORE updating
 * lastToolName / lastToolParams on TaskState.
 *
 * Compares the current call against the previous state, updates the
 * counter, and returns which thresholds (if any) were crossed.
 */
export function checkRepeatedToolCall(state: TaskState, toolName: string, currentSignature: string): LoopDetectionResult {
	if (toolName === state.lastToolName && currentSignature === state.lastToolParams) {
		state.consecutiveIdenticalToolCount++
	} else {
		state.consecutiveIdenticalToolCount = 1
	}

	return {
		softWarning: state.consecutiveIdenticalToolCount === LOOP_DETECTION_SOFT_THRESHOLD,
		hardEscalation: state.consecutiveIdenticalToolCount >= LOOP_DETECTION_HARD_THRESHOLD,
	}
}
