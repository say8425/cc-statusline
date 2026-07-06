export const movedBeyondThreshold = (
	down: { x: number; y: number },
	up: { x: number; y: number },
	threshold: number,
): boolean => Math.hypot(up.x - down.x, up.y - down.y) > threshold;
