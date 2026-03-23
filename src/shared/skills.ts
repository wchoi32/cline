/**
 * Optional execution metadata declared in skill frontmatter.
 * Older consumers can ignore these fields safely.
 */
export interface SkillInvocationMetadata {
	manual: boolean
	auto: boolean
}

/**
 * Skill metadata loaded at startup for discovery.
 * Required fields are kept stable for backwards compatibility; optional
 * fields are additive and ignored by older consumers.
 */
export interface SkillMetadata {
	name: string
	description: string
	path: string
	source: "global" | "project"
	version?: number
	tags?: string[]
	tools?: string[]
	resources?: string[]
	/**
	 * Execution metadata. Optional on the interface for backward compatibility,
	 * but always set by normalizeSkillMetadata() during discovery.
	 * Defaults to { manual: true, auto: false } when omitted from frontmatter.
	 */
	invocation?: SkillInvocationMetadata
}

/**
 * Full skill content loaded on-demand when skill is activated.
 */
export interface SkillContent extends SkillMetadata {
	instructions: string
}
