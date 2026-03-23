/**
 * JSON Task view component
 * Outputs task messages as JSON instead of rich styled text
 */

import { Box } from "ink"
import React, { useEffect, useRef } from "react"
import { useTaskContext, useTaskState } from "../context/TaskContext"
import { useCompletionSignals } from "../hooks/useStateSubscriber"
import { originalConsoleLog } from "../utils/console"
import {
	createStructuredCompleteEvent,
	createStructuredMessageEvent,
	createStructuredStartEvent,
	deriveStructuredExitCode,
	type StructuredEvent,
	serializeStructuredEvent,
} from "../utils/structured-output"

interface TaskJsonViewProps {
	taskId?: string
	verbose?: boolean
	onComplete?: () => void
	onError?: () => void
}

function outputJson(data: StructuredEvent) {
	originalConsoleLog(serializeStructuredEvent(data))
}

export const TaskJsonView: React.FC<TaskJsonViewProps> = ({ taskId: _taskId, verbose = false, onComplete, onError }) => {
	const state = useTaskState()
	const { isTaskComplete, getCompletionMessage } = useCompletionSignals()
	const { setIsComplete } = useTaskContext()
	// Track outputted messages by timestamp (don't re-output on updates)
	const outputtedMessages = useRef<Set<number>>(new Set())
	const hasOutputtedCompletion = useRef(false)
	const lastOutputtedStartTaskId = useRef<string | undefined>(undefined)

	// Emit a structured task start event once per task id.
	useEffect(() => {
		if (!_taskId || lastOutputtedStartTaskId.current === _taskId) {
			return
		}

		lastOutputtedStartTaskId.current = _taskId
		outputJson(createStructuredStartEvent(_taskId))
	}, [_taskId])

	// Output messages as JSON when they arrive
	useEffect(() => {
		const messages = state.clineMessages || []

		for (let i = 0; i < messages.length; i++) {
			const message = messages[i]

			// Skip partial messages - wait for complete message
			if (message.partial) {
				continue
			}

			// Skip if we already outputted this timestamp
			if (outputtedMessages.current.has(message.ts)) {
				continue
			}

			// Filter out noisy messages in non-verbose mode
			if (!verbose) {
				if (message.say === "api_req_started" || message.say === "api_req_finished") {
					outputtedMessages.current.add(message.ts)
					continue
				}
			}

			// Output the message as JSON
			outputJson(createStructuredMessageEvent(message, i, _taskId))

			outputtedMessages.current.add(message.ts)
		}
	}, [state.clineMessages, verbose, _taskId])

	// Handle task completion
	useEffect(() => {
		if (isTaskComplete() && !hasOutputtedCompletion.current) {
			hasOutputtedCompletion.current = true
			setIsComplete(true)

			const completionMsg = getCompletionMessage()
			const isError = completionMsg?.say === "error" || completionMsg?.ask === "api_req_failed"

			// Output completion status
			outputJson(
				createStructuredCompleteEvent({
					status: isError ? "error" : "success",
					exitCode: deriveStructuredExitCode(isError ? "error" : "success"),
					message: completionMsg ?? undefined,
					taskId: _taskId,
				}),
			)

			if (isError) {
				onError?.()
			} else {
				onComplete?.()
			}

			// Don't exit automatically - let the parent handle cleanup
		}
	}, [isTaskComplete, setIsComplete, onComplete, onError, getCompletionMessage, _taskId])

	// Render nothing visible - all output goes to stdout as JSON
	return <Box />
}
