import path from "node:path"
import type { ToolUse } from "@core/assistant-message"
import { normalizeMemoryFileName, saveWorkspaceMemory } from "@core/context/instructions/user-instructions/memory"
import { formatResponse } from "@core/prompts/responses"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SaveMemoryToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SAVE_MEMORY

	getDescription(block: ToolUse): string {
		const name = block.params.name
		return name ? `[${block.name} for '${name}']` : `[${block.name}]`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const name = block.params.name
		if (!name) {
			return
		}

		const partialMessage = JSON.stringify({
			tool: "saveMemory",
			path: uiHelpers.removeClosingTag(block, "name", name),
		})
		await uiHelpers.ask("tool", partialMessage, block.partial).catch(() => {})
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		if (config.isSubagentExecution) {
			return formatResponse.toolDenied()
		}

		const rawName: string | undefined = block.params.name
		const rawContent: string | undefined = block.params.content

		if (!rawName) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(ClineDefaultTool.SAVE_MEMORY, "name")
		}

		if (!rawContent) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(ClineDefaultTool.SAVE_MEMORY, "content")
		}

		const fileName = normalizeMemoryFileName(rawName)
		const relativePath = path.join(".cline", "memory", fileName)
		const approvalMessage = `Cline wants to save persistent workspace memory to ${relativePath}.\n\nThis will write a durable markdown note that can be reloaded in future sessions.`

		const autoApproved = await config.callbacks.shouldAutoApproveToolWithPath(block.name, relativePath)
		if (!autoApproved) {
			showNotificationForApproval(
				`Cline wants to save workspace memory in ${relativePath}`,
				config.autoApprovalSettings.enableNotifications,
			)

			const { response, text, images, files } = await config.callbacks.ask("tool", approvalMessage, false)
			if (text || (images && images.length > 0) || (files && files.length > 0)) {
				await config.callbacks.say("user_feedback", text ?? "", images, files)
			}

			if (response !== "yesButtonClicked") {
				config.taskState.didRejectTool = true
				return formatResponse.toolDenied()
			}
		}

		const savedPath = await saveWorkspaceMemory(config.cwd, rawName, rawContent)
		config.taskState.consecutiveMistakeCount = 0

		const relativeSavedPath = path.relative(config.cwd, savedPath).replace(/\\/g, "/")
		return formatResponse.toolResult(`Saved persistent workspace memory to ${relativeSavedPath}`)
	}
}
