export type EphemeralCacheControl = { type: "ephemeral" }

export function makeEphemeralTextBlock(
	text: string,
): {
	type: "text"
	text: string
	cache_control: EphemeralCacheControl
} {
	return {
		type: "text",
		text,
		cache_control: { type: "ephemeral" },
	}
}

export function addEphemeralCacheControlToLastMatchingBlock<T extends { type: string; cache_control?: EphemeralCacheControl }>(
	blocks: T[],
	matches: (block: T) => boolean,
): T[] {
	const updatedBlocks = [...blocks]

	for (let index = updatedBlocks.length - 1; index >= 0; index--) {
		if (matches(updatedBlocks[index])) {
			updatedBlocks[index] = {
				...updatedBlocks[index],
				cache_control: { type: "ephemeral" },
			} as T
			break
		}
	}

	return updatedBlocks
}
