import type { ClineMessage } from "@shared/ExtensionMessage"

export const STRUCTURED_OUTPUT_SCHEMA_VERSION = 1 as const

export type StructuredOutputEventType = "start" | "message" | "complete" | "error"
export type StructuredCompletionStatus = "success" | "error" | "timeout" | "aborted"

export interface StructuredOutputBaseEvent {
	schemaVersion: typeof STRUCTURED_OUTPUT_SCHEMA_VERSION
	event: StructuredOutputEventType
	timestamp: number
	taskId?: string
	sessionId?: string
}

export interface StructuredStartEvent extends StructuredOutputBaseEvent {
	event: "start"
	taskId: string
	sessionId: string
}

export interface StructuredMessageEvent extends StructuredOutputBaseEvent, ClineMessage {
	event: "message"
	role: "user" | "assistant" | "system"
	messageType: ClineMessage["type"]
	taskId?: string
	sessionId?: string
	timestamp: number
	ts: number
}

export interface StructuredCompleteEvent extends StructuredOutputBaseEvent {
	event: "complete"
	status: StructuredCompletionStatus
	exitCode: number
	result?: string
	messageType?: ClineMessage["type"]
	ask?: ClineMessage["ask"]
	say?: ClineMessage["say"]
	text?: string
}

export interface StructuredErrorEvent extends StructuredOutputBaseEvent {
	event: "error"
	status: Exclude<StructuredCompletionStatus, "success">
	exitCode: number
	message: string
}

export type StructuredEvent = StructuredStartEvent | StructuredMessageEvent | StructuredCompleteEvent | StructuredErrorEvent

export function serializeStructuredEvent(event: StructuredEvent): string {
	return JSON.stringify(event)
}

export function writeStructuredEvent(event: StructuredEvent, writeLine: (line: string) => unknown): void {
	writeLine(`${serializeStructuredEvent(event)}\n`)
}

export function createStructuredStartEvent(taskId: string, timestamp = Date.now()): StructuredStartEvent {
	return {
		schemaVersion: STRUCTURED_OUTPUT_SCHEMA_VERSION,
		event: "start",
		timestamp,
		taskId,
		sessionId: taskId,
	}
}

export function getStructuredMessageRole(
	message: Pick<ClineMessage, "say" | "ask" | "type">,
	index: number,
): "user" | "assistant" | "system" {
	if (message.say === "user_feedback" || message.say === "user_feedback_diff") {
		return "user"
	}

	if (message.say === "text" && index === 0) {
		return "user"
	}

	if (message.say === "api_req_started" || message.say === "api_req_finished") {
		return "system"
	}

	return "assistant"
}

export function createStructuredMessageEvent(
	message: ClineMessage,
	index: number,
	taskId?: string,
): StructuredMessageEvent {
	const timestamp = message.ts
	return {
		schemaVersion: STRUCTURED_OUTPUT_SCHEMA_VERSION,
		event: "message",
		timestamp,
		ts: timestamp,
		taskId,
		sessionId: taskId,
		role: getStructuredMessageRole(message, index),
		messageType: message.type,
		...message,
	}
}

export function createStructuredCompleteEvent(
	options: {
		status: StructuredCompletionStatus
		exitCode: number
		result?: string
		message?: ClineMessage
		taskId?: string
		timestamp?: number
	},
): StructuredCompleteEvent {
	const timestamp = options.timestamp ?? Date.now()
	const message = options.message

	return {
		schemaVersion: STRUCTURED_OUTPUT_SCHEMA_VERSION,
		event: "complete",
		timestamp,
		taskId: options.taskId,
		sessionId: options.taskId,
		status: options.status,
		exitCode: options.exitCode,
		result: options.result ?? message?.text,
		messageType: message?.type,
		ask: message?.ask,
		say: message?.say,
		text: message?.text,
	}
}

export function createStructuredErrorEvent(
	message: string,
	options: {
		exitCode?: number
		status?: Exclude<StructuredCompletionStatus, "success">
		taskId?: string
		timestamp?: number
	} = {},
): StructuredErrorEvent {
	const status = options.status ?? "error"
	return {
		schemaVersion: STRUCTURED_OUTPUT_SCHEMA_VERSION,
		event: "error",
		timestamp: options.timestamp ?? Date.now(),
		taskId: options.taskId,
		sessionId: options.taskId,
		status,
		exitCode: options.exitCode ?? deriveStructuredExitCode(status),
		message,
	}
}

export function deriveStructuredExitCode(status: StructuredCompletionStatus): number {
	switch (status) {
		case "success":
			return 0
		case "timeout":
			return 4
		case "aborted":
			return 5
		case "error":
		default:
			return 1
	}
}

export function inferStructuredStatusFromError(errorMessage: string): StructuredCompletionStatus {
	const normalized = errorMessage.toLowerCase()

	if (normalized.includes("timeout")) {
		return "timeout"
	}

	if (normalized.includes("abort") || normalized.includes("cancel")) {
		return "aborted"
	}

	return "error"
}
