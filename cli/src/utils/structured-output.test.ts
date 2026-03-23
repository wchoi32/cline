import { describe, expect, it } from "vitest"
import type { ClineMessage } from "@shared/ExtensionMessage"
import {
	createStructuredCompleteEvent,
	createStructuredMessageEvent,
	createStructuredStartEvent,
	deriveStructuredExitCode,
	inferStructuredStatusFromError,
	serializeStructuredEvent,
} from "./structured-output"

describe("structured-output", () => {
	it("builds a structured start event", () => {
		const event = createStructuredStartEvent("task-123", 123)

		expect(event).toEqual({
			schemaVersion: 1,
			event: "start",
			timestamp: 123,
			taskId: "task-123",
			sessionId: "task-123",
		})
	})

	it("builds a structured message event with raw Cline fields preserved", () => {
		const message = {
			ts: 42,
			type: "say",
			say: "text",
			text: "hello",
			partial: false,
		} satisfies ClineMessage

		const event = createStructuredMessageEvent(message, 0, "task-123")

		expect(event).toMatchObject({
			schemaVersion: 1,
			event: "message",
			taskId: "task-123",
			sessionId: "task-123",
			timestamp: 42,
			ts: 42,
			type: "say",
			say: "text",
			text: "hello",
			role: "user",
			messageType: "say",
		})
		expect(serializeStructuredEvent(event)).toContain('"event":"message"')
	})

	it("builds a structured completion event with exit code 0 for success", () => {
		const message = {
			ts: 99,
			type: "say",
			say: "completion_result",
			text: "done",
		} satisfies ClineMessage

		const event = createStructuredCompleteEvent({
			status: "success",
			exitCode: deriveStructuredExitCode("success"),
			message,
			taskId: "task-123",
			timestamp: 100,
		})

		expect(event).toMatchObject({
			schemaVersion: 1,
			event: "complete",
			taskId: "task-123",
			sessionId: "task-123",
			timestamp: 100,
			status: "success",
			exitCode: 0,
			say: "completion_result",
			text: "done",
			result: "done",
		})
	})

	it("builds a structured completion event with error details for terminal failures", () => {
		const message = {
			ts: 101,
			type: "say",
			say: "error",
			text: "request failed",
		} satisfies ClineMessage

		const event = createStructuredCompleteEvent({
			status: "error",
			exitCode: deriveStructuredExitCode("error"),
			errorMessage: "request failed",
			message,
			taskId: "task-123",
			timestamp: 102,
		})

		expect(event).toMatchObject({
			schemaVersion: 1,
			event: "complete",
			taskId: "task-123",
			sessionId: "task-123",
			timestamp: 102,
			status: "error",
			exitCode: 1,
			say: "error",
			text: "request failed",
			error: "request failed",
			result: undefined,
		})
	})

	it("infers timeout status from Error with name TimeoutError", () => {
		const err = new Error("operation timed out")
		err.name = "TimeoutError"
		expect(inferStructuredStatusFromError(err)).toBe("timeout")
	})

	it("infers aborted status from Error with name AbortError", () => {
		const err = new Error("signal aborted")
		err.name = "AbortError"
		expect(inferStructuredStatusFromError(err)).toBe("aborted")
	})

	it("infers timeout from string containing timeout", () => {
		expect(inferStructuredStatusFromError("Timeout")).toBe("timeout")
	})

	it("infers aborted from string containing cancel", () => {
		expect(inferStructuredStatusFromError("user cancel")).toBe("aborted")
	})

	it("returns error for unknown error types", () => {
		expect(inferStructuredStatusFromError(new Error("something broke"))).toBe("error")
		expect(inferStructuredStatusFromError("unknown failure")).toBe("error")
		expect(inferStructuredStatusFromError(42)).toBe("error")
	})
})
