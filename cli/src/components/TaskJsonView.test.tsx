import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TaskJsonView } from "./TaskJsonView"

const originalConsoleLogMock = vi.hoisted(() => vi.fn())

vi.mock("../utils/console", () => ({
	originalConsoleLog: originalConsoleLogMock,
}))

vi.mock("../context/TaskContext", () => ({
	useTaskContext: () => ({ setIsComplete: vi.fn() }),
	useTaskState: () => ({
		clineMessages: [
			{ ts: 1, type: "say", say: "text", text: "hello" },
			{ ts: 2, type: "say", say: "completion_result", text: "done" },
		],
	}),
}))

vi.mock("../hooks/useStateSubscriber", () => ({
	useCompletionSignals: () => ({
		isTaskComplete: () => true,
		getCompletionMessage: () => ({ ts: 2, type: "say", say: "completion_result", text: "done" }),
	}),
}))

describe("TaskJsonView", () => {
	beforeEach(() => {
		originalConsoleLogMock.mockClear()
	})

	it("emits structured start, message, and complete events", () => {
		render(<TaskJsonView taskId="task-123" />)

		expect(originalConsoleLogMock).toHaveBeenCalled()
		const events = originalConsoleLogMock.mock.calls.map(([line]) => JSON.parse(line as string))

		expect(events[0]).toMatchObject({
			schemaVersion: 1,
			event: "start",
			taskId: "task-123",
			sessionId: "task-123",
		})
		expect(events[1]).toMatchObject({
			schemaVersion: 1,
			event: "message",
			ts: 1,
			type: "say",
			say: "text",
			text: "hello",
			role: "user",
		})
		expect(events[2]).toMatchObject({
			schemaVersion: 1,
			event: "message",
			ts: 2,
			type: "say",
			say: "completion_result",
			text: "done",
		})
		expect(events.at(-1)).toMatchObject({
			schemaVersion: 1,
			event: "complete",
			status: "success",
			exitCode: 0,
			taskId: "task-123",
			sessionId: "task-123",
			result: "done",
		})
	})
})
