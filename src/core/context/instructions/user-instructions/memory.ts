import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getClineHomePath } from "@core/storage/disk"
import { fileExistsAtPath, isDirectory } from "@utils/fs"
import { Logger } from "@/shared/services/Logger"

export type PersistentMemoryScope = "workspace" | "global"

export type PersistentMemoryFile = {
	scope: PersistentMemoryScope
	path: string
	displayPath: string
	content: string
}

const WORKSPACE_MEMORY_DIR = path.join(".cline", "memory")
const GLOBAL_MEMORY_DIR = "memory"

function normalizeMemoryFileName(name: string): string {
	const trimmed = name.trim()
	if (!trimmed) {
		throw new Error("Memory name cannot be empty.")
	}
	if (/[\\/]/.test(trimmed)) {
		throw new Error("Memory name cannot contain path separators.")
	}

	const withoutMarkdownExtension = trimmed.replace(/\.md$/i, "")
	const sanitized = withoutMarkdownExtension
		.replace(/\s+/g, "-")
		.replace(/[^A-Za-z0-9._-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^\.+/, "")
		.replace(/^[-_]+|[-_]+$/g, "")

	if (!sanitized) {
		throw new Error("Memory name must contain at least one alphanumeric character.")
	}

	return `${sanitized}.md`
}

async function readMemoryDirectory(baseDir: string, scope: PersistentMemoryScope): Promise<PersistentMemoryFile[]> {
	if (!(await fileExistsAtPath(baseDir)) || !(await isDirectory(baseDir))) {
		return []
	}

	let entries: string[]
	try {
		entries = await fs.readdir(baseDir)
	} catch (error) {
		Logger.warn(`Failed to read memory directory at ${baseDir}`, error)
		return []
	}

	const files = entries
		.filter((entry) => entry.toLowerCase().endsWith(".md"))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))

	const loaded = await Promise.all(
		files.map(async (entry) => {
			const fullPath = path.join(baseDir, entry)
			try {
				const rawContent = await fs.readFile(fullPath, "utf8")
				if (!rawContent.trim()) {
					return null
				}
				return {
					scope,
					path: fullPath,
					displayPath: scope === "workspace" ? path.posix.join(".cline", "memory", entry) : `~/.cline/memory/${entry}`,
					content: rawContent.trimEnd(),
				} satisfies PersistentMemoryFile
			} catch (error) {
				Logger.warn(`Failed to read memory file at ${fullPath}`, error)
				return null
			}
		}),
	)

	return loaded.filter((file): file is PersistentMemoryFile => file !== null)
}

export async function getPersistentMemoryFiles(cwd: string, opts?: { homeDir?: string }): Promise<PersistentMemoryFile[]> {
	const workspaceDir = path.resolve(cwd, WORKSPACE_MEMORY_DIR)
	const globalDir = path.join(opts?.homeDir ?? getClineHomePath(), GLOBAL_MEMORY_DIR)

	const [workspaceFiles, globalFiles] = await Promise.all([
		readMemoryDirectory(workspaceDir, "workspace"),
		readMemoryDirectory(globalDir, "global"),
	])

	return [...workspaceFiles, ...globalFiles]
}

export async function getPersistentMemoryInstructions(cwd: string, opts?: { homeDir?: string }): Promise<string | undefined> {
	const memoryFiles = await getPersistentMemoryFiles(cwd, opts)
	if (memoryFiles.length === 0) {
		return undefined
	}

	const workspaceFiles = memoryFiles.filter((file) => file.scope === "workspace")
	const globalFiles = memoryFiles.filter((file) => file.scope === "global")
	const sections: string[] = [
		"PERSISTENT MEMORY",
		"",
		"The following memory files were loaded from disk. Treat them as durable guidance and prefer workspace memory when it conflicts with global memory.",
	]

	const appendSection = (title: string, files: PersistentMemoryFile[]) => {
		if (files.length === 0) {
			return
		}
		sections.push("", `## ${title}`)
		for (const file of files) {
			sections.push(`### ${file.displayPath}`, file.content)
		}
	}

	appendSection("Workspace Memory", workspaceFiles)
	appendSection("Global Memory", globalFiles)

	return sections.join("\n")
}

async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
	const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`
	try {
		await fs.writeFile(tmpPath, content, "utf8")
		await fs.rename(tmpPath, filePath)
	} catch (error) {
		await fs.unlink(tmpPath).catch(() => {})
		throw error
	}
}

export async function saveWorkspaceMemory(cwd: string, name: string, content: string): Promise<string> {
	const memoryDir = path.resolve(cwd, WORKSPACE_MEMORY_DIR)
	const fileName = normalizeMemoryFileName(name)
	const filePath = path.join(memoryDir, fileName)

	await fs.mkdir(memoryDir, { recursive: true })
	await writeTextFileAtomic(filePath, `${content.replace(/\r?\n+$/u, "")}\n`)

	return filePath
}

export function getWorkspaceMemoryDirectory(cwd: string): string {
	return path.resolve(cwd, WORKSPACE_MEMORY_DIR)
}

export function getGlobalMemoryDirectory(): string {
	return path.join(os.homedir(), ".cline", GLOBAL_MEMORY_DIR)
}

export { normalizeMemoryFileName }
