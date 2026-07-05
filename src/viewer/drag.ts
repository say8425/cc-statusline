export function movedBeyondThreshold(
	down: { x: number; y: number },
	up: { x: number; y: number },
	threshold: number,
): boolean {
	return Math.hypot(up.x - down.x, up.y - down.y) > threshold;
}
