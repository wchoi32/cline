import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.SAVE_MEMORY

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "save_memory",
	description:
		"Save durable workspace memory as a markdown file. Use this to capture stable project conventions, user preferences, or recurring instructions that should persist across sessions. Memory writes require explicit user approval.",
	// Only available in primary agent sessions, not subagent runs
	contextRequirements: (context) => !context.isSubagentRun,
	parameters: [
		{
			name: "name",
			required: true,
			instruction:
				"A short file name for the memory note. Do not include path separators. The tool will save it as a .md file under .cline/memory in the current workspace.",
			usage: "project-conventions",
		},
		{
			name: "content",
			required: true,
			instruction:
				"The markdown content to store as persistent memory. Keep it concise, durable, and limited to stable guidance rather than transient task notes.",
			usage: "Your memory content here",
		},
	],
}

export const save_memory_variants = [generic]
