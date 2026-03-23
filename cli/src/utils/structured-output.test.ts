import { describe, expect, it } from "vitest"
import type { ClineMessage } from "@shared/ExtensionMessage"
import {
	createStructuredCompleteEvent,
	createStructuredErrorEvent,
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

	it("builds a structured error event with the inferred timeout status", () => {
		const event = createStructuredErrorEvent("Timeout", {
			status: inferStructuredStatusFromError("Timeout"),
			exitCode: deriveStructuredExitCode("timeout"),
			taskId: "task-123",
			timestamp: 200,
		})

		expect(event).toMatchObject({
			schemaVersion: 1,
			event: "error",
			taskId: "task-123",
			sessionId: "task-123",
			timestamp: 200,
			status: "timeout",
			exitCode: 4,
			message: "Timeout",
		})
	})
})
