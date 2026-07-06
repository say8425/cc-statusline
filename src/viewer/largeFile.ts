export const LARGE_FILE_LINE_THRESHOLD = 1500;

export const LOCKFILE_NAMES: ReadonlySet<string> = new Set([
	"pnpm-lock.yaml",
	"package-lock.json",
	"npm-shrinkwrap.json",
	"yarn.lock",
	"bun.lock",
	"bun.lockb",
	"Cargo.lock",
	"composer.lock",
	"Gemfile.lock",
	"poetry.lock",
	"go.sum",
	"flake.lock",
	"Podfile.lock",
]);

const basename = (path: string): string => {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? path : path.slice(slash + 1);
};

export const isLargeFile = (name: string, changedLines: number): boolean =>
	LOCKFILE_NAMES.has(basename(name)) ||
	changedLines > LARGE_FILE_LINE_THRESHOLD;
