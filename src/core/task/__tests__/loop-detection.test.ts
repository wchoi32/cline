import { describe, it } from "mocha"
import "should"
import { checkRepeatedToolCall, LOOP_DETECTION_SOFT_THRESHOLD, stableStringify, toolCallSignature } from "../loop-detection"
import { TaskState } from "../TaskState"

/**
 * Tests for doom loop detection.
 *
 * These tests exercise the shared helpers from doom-loop.ts directly —
 * the same functions used by ToolExecutor in production. No duplicated
 * algorithm.
 */

/** Simulate a complete tool call cycle matching production order in ToolExecutor. */
function simulateToolCall(state: TaskState, toolName: string, params: Record<string, unknown>, maxMistakes = 3) {
	const sig = toolCallSignature(params)

	// Step 1: check BEFORE updating state (matches production)
	const result = checkRepeatedToolCall(state, toolName, sig)

	if (result.softWarning) {
		state.userMessageContent.push({
			type: "text",
			text: `[WARNING] You have called "${toolName}" with identical arguments ${LOOP_DETECTION_SOFT_THRESHOLD} times consecutively without making progress. You MUST try a different approach — use a different tool, different arguments, or reconsider your strategy.`,
		})
	}
	if (result.hardEscalation) {
		state.consecutiveMistakeCount = maxMistakes
	}

	// Step 2: update state AFTER comparison (matches production)
	state.lastToolName = toolName
	state.lastToolParams = sig

	return result
}

describe("stableStringify", () => {
	it("sorts top-level keys", () => {
		stableStringify({ b: 2, a: 1 }).should.equal(stableStringify({ a: 1, b: 2 }))
	})

	it("sorts nested object keys recursively", () => {
		const a = { outer: { z: 1, a: 2 }, first: true }
		const b = { first: true, outer: { a: 2, z: 1 } }
		stableStringify(a).should.equal(stableStringify(b))
	})

	it("handles arrays (order-preserving)", () => {
		stableStringify([3, 1, 2]).should.equal("[3,1,2]")
		stableStringify([1, 2]).should.not.equal(stableStringify([2, 1]))
	})

	it("handles null", () => {
		stableStringify(null).should.equal("null")
	})

	it("handles primitives", () => {
		stableStringify("hello").should.equal('"hello"')
		stableStringify(42).should.equal("42")
		stableStringify(true).should.equal("true")
	})

	it("handles empty object", () => {
		stableStringify({}).should.equal("{}")
	})
})

describe("Loop Detection", () => {
	it("should not trigger warning before threshold", () => {
		const state = new TaskState()

		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "read_file", { path: "src/main.ts" })

		state.consecutiveIdenticalToolCount.should.equal(2)
		state.userMessageContent.length.should.equal(0)
		state.consecutiveMistakeCount.should.equal(0)
	})

	it("should inject warning at soft threshold (3 identical calls)", () => {
		const state = new TaskState()

		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		const result = simulateToolCall(state, "read_file", { path: "src/main.ts" })

		result.softWarning.should.be.true()
		result.hardEscalation.should.be.false()
		state.consecutiveIdenticalToolCount.should.equal(3)
		state.userMessageContent.length.should.equal(1)
		const warning = state.userMessageContent[0] as { type: string; text: string }
		warning.text.should.containEql("[WARNING]")
		state.consecutiveMistakeCount.should.equal(0)
	})

	it("should escalate at hard threshold (5 identical calls)", () => {
		const state = new TaskState()

		for (let i = 0; i < 5; i++) {
			simulateToolCall(state, "search_files", { regex: "TODO", path: "." })
		}

		state.consecutiveIdenticalToolCount.should.equal(5)
		state.consecutiveMistakeCount.should.equal(3)
		state.userMessageContent.length.should.equal(1) // one warning at threshold 3
	})

	it("should reset counter when different tool is used", () => {
		const state = new TaskState()

		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "list_files", { path: "src/" })

		state.consecutiveIdenticalToolCount.should.equal(1)
		state.userMessageContent.length.should.equal(0)
	})

	it("should reset counter when same tool used with different params", () => {
		const state = new TaskState()

		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "read_file", { path: "src/utils.ts" })

		state.consecutiveIdenticalToolCount.should.equal(1)
		state.userMessageContent.length.should.equal(0)
	})

	it("should handle empty params", () => {
		const state = new TaskState()

		simulateToolCall(state, "attempt_completion", {})
		simulateToolCall(state, "attempt_completion", {})
		simulateToolCall(state, "attempt_completion", {})

		state.consecutiveIdenticalToolCount.should.equal(3)
		state.userMessageContent.length.should.equal(1)
	})

	it("should not interfere with existing consecutiveMistakeCount from errors", () => {
		const state = new TaskState()
		state.consecutiveMistakeCount = 2

		simulateToolCall(state, "read_file", { path: "a.ts" })
		simulateToolCall(state, "read_file", { path: "a.ts" })

		state.consecutiveMistakeCount.should.equal(2) // untouched
	})

	it("should resume counting after a break", () => {
		const state = new TaskState()

		simulateToolCall(state, "read_file", { path: "a.ts" })
		simulateToolCall(state, "read_file", { path: "a.ts" })
		simulateToolCall(state, "list_files", { path: "." })
		simulateToolCall(state, "read_file", { path: "a.ts" })
		simulateToolCall(state, "read_file", { path: "a.ts" })
		simulateToolCall(state, "read_file", { path: "a.ts" })

		state.consecutiveIdenticalToolCount.should.equal(3)
		state.userMessageContent.length.should.equal(1)
	})

	it("should NOT count different tools with same params as identical", () => {
		const state = new TaskState()

		simulateToolCall(state, "read_file", { path: "src/main.ts" })
		simulateToolCall(state, "search_files", { path: "src/main.ts" })
		simulateToolCall(state, "list_files", { path: "src/main.ts" })

		state.consecutiveIdenticalToolCount.should.equal(1)
		state.userMessageContent.length.should.equal(0)
	})

	it("should treat different key orders as identical params", () => {
		const state = new TaskState()

		simulateToolCall(state, "search_files", { regex: "TODO", path: "src/" })
		simulateToolCall(state, "search_files", { path: "src/", regex: "TODO" })
		simulateToolCall(state, "search_files", { regex: "TODO", path: "src/" })

		state.consecutiveIdenticalToolCount.should.equal(3)
		state.userMessageContent.length.should.equal(1)
	})

	it("should treat nested objects with different key orders as identical", () => {
		const state = new TaskState()

		// biome-ignore lint/suspicious/noExplicitAny: test needs nested objects to verify recursive sorting
		const call1 = { server: "gh", input: { repo: "cline", owner: "cline" } } as Record<string, any>
		// biome-ignore lint/suspicious/noExplicitAny: test needs nested objects to verify recursive sorting
		const call2 = { server: "gh", input: { owner: "cline", repo: "cline" } } as Record<string, any>
		// biome-ignore lint/suspicious/noExplicitAny: test needs nested objects to verify recursive sorting
		const call3 = { input: { repo: "cline", owner: "cline" }, server: "gh" } as Record<string, any>
		simulateToolCall(state, "use_mcp_tool", call1)
		simulateToolCall(state, "use_mcp_tool", call2)
		simulateToolCall(state, "use_mcp_tool", call3)

		state.consecutiveIdenticalToolCount.should.equal(3)
		state.userMessageContent.length.should.equal(1)
	})
})
