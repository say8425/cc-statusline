import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeServer, resolveDiffdeck } from "../diff-server/ensure.ts";
import { getTokenPath } from "../diff-server/token.ts";

// Pins the diffdeck wire contract that ensure.ts leans on, against the REAL
// installed package rather than a stub. The unit tests inject a fake probe, so
// they cannot notice diffdeck renaming a header or moving its token path — the
// exact drift that would make an upgrade ship silently ineffective. This spawns
// the real CLI and asserts probeServer reads its marker, version, and pid, and
// that the daemon writes a token where token.ts reads one.

let child: ReturnType<typeof Bun.spawn> | null = null;
let cacheHome = "";

const freePort = (): number => {
	const srv = Bun.serve({ port: 0, fetch: () => new Response(null) });
	const { port } = srv;
	void srv.stop(true);
	// Typed optional even though `port: 0` always resolves to a real one. Checked
	// rather than asserted so a future Bun that stops reporting it fails loudly.
	if (port == null) throw new Error("Bun.serve reported no port");
	return port;
};

afterEach(() => {
	child?.kill("SIGKILL");
	child = null;
	if (cacheHome) rmSync(cacheHome, { recursive: true, force: true });
});

test("probeServer reads the version, pid, and token of a real diffdeck daemon", async () => {
	const { cli, version } = resolveDiffdeck();
	const port = freePort();
	cacheHome = mkdtempSync(join(tmpdir(), "cc-contract-"));
	const env = { ...process.env, XDG_CACHE_HOME: cacheHome };

	// A directly-controlled child (not the detached nohup daemon) so the test
	// can reliably kill it: here the daemon *is* child.pid, which lets us assert
	// the wire pid matches the real process.
	child = Bun.spawn(
		[process.execPath, cli, "--no-open", "--port", String(port)],
		{
			env,
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		},
	);

	let probe: Awaited<ReturnType<typeof probeServer>> = null;
	for (let i = 0; i < 100 && probe == null; i++) {
		probe = await probeServer(port);
		if (probe == null) await new Promise((r) => setTimeout(r, 50));
	}

	expect(probe).not.toBeNull();
	expect(probe?.version).toBe(version);
	expect(probe?.pid).toBe(child.pid);
	expect(existsSync(getTokenPath(env))).toBe(true);
});

// The test above proves the *running* daemon is the *installed* build — the pid
// and version agree — but it reads both sides out of the same install, so it
// cannot notice node_modules drifting away from what we declare. This pins the
// other leg: the installed build is one our manifest permits. Together the two
// are non-circular.
//
// Scope, precisely — an ordinary manifest/lockfile desync never reaches here,
// because `--frozen-lockfile` rejects it at install. What this catches is an
// installed build outside the declared range: local drift, and in CI a lockfile
// whose recorded range agrees with the manifest while its resolved version does
// not satisfy it (the shape a botched conflict resolution leaves, the two
// sitting ~100 lines apart). Installed != lockfile while both still satisfy the
// range slips past this one — the test below is what pins that.
test("the installed diffdeck satisfies the range the manifest declares", () => {
	const { version } = resolveDiffdeck();
	const manifest = JSON.parse(
		readFileSync(join(import.meta.dir, "..", "..", "package.json"), "utf8"),
	) as { dependencies: Record<string, string> };
	const range = manifest.dependencies["@say8425/diffdeck"];

	// Compared as an object so a failure names the offending version and range
	// — the whole point here is to make a silent drift loud. `range` is matched
	// as a string rather than echoed back because `Bun.semver.satisfies` returns
	// true for `undefined` and for non-semver forms like `workspace:*`: without
	// this, moving the dep to optionalDependencies or renaming the scope would
	// silence the guard exactly when it is needed.
	expect({
		version,
		range,
		satisfied: Bun.semver.satisfies(version, range),
	}).toEqual({ version, range: expect.any(String), satisfied: true });
});

// A third independent anchor: the two above tie to the install and to
// package.json, this one to bun.lock. What it alone catches, now that the dep is
// pinned exactly, is the lockfile disagreeing with the manifest while the
// install matches the manifest — a lockfile edited without a reinstall. Any
// install of a *different* version now trips the range assertion too, since the
// accepted set is the single pinned version.
//
// (Under the old caret range the niche was wider, and that is the shape this
// test was written for: main declared `^1.2.0` while the tree held the 1.3.0
// installed on another branch, and `satisfies("1.3.0", "^1.2.0")` is true, so
// only this assertion objected. Branch switching produces that state on its own
// because git does not manage node_modules. Kept as history — the pin narrowed
// it, it did not stop node_modules from drifting.)
//
// (#62 is the reminder that such drift happens — its tree held 1.0.0 — but it
// is not this test's case: #62 moved the range to `^1.2.0`, which 1.0.0 fails,
// so the range assertion already covers it. Its CI installed with
// --frozen-lockfile and passed, so the 1.2.0 contract was genuinely verified;
// what drifted was a claim in the PR body about a local run.)
//
// `bun.lock` is trailing-comma JSONC, which `JSON.parse` and `Bun.file().json()`
// both reject — but bun's module loader parses it, so no hand-rolled parsing is
// involved. A lockfile format change would break this loudly, which is the
// failure mode we want.
// `bun.lock` has no type to import, so the shape is narrowed at runtime instead
// of asserted. Anything unexpected leaves `locked` undefined (missing
// `packages`, a renamed key, a non-array entry) or a garbage slice (a
// non-registry specifier like `link:../diffdeck` yields that string whole);
// either way it fails the assertion by name rather than passing quietly.
const lockedVersion = (mod: unknown): string | undefined => {
	if (typeof mod !== "object" || mod === null) return undefined;
	const { packages } = mod as { packages?: unknown };
	if (typeof packages !== "object" || packages === null) return undefined;
	const entry = (packages as Record<string, unknown>)["@say8425/diffdeck"];
	const spec = Array.isArray(entry) ? entry[0] : undefined;
	// Entries read `name@version`; slice at the LAST `@` so the scope's own
	// leading `@` survives.
	return typeof spec === "string"
		? spec.slice(spec.lastIndexOf("@") + 1)
		: undefined;
};

test("the installed diffdeck matches the version the lockfile resolves", async () => {
	const { version } = resolveDiffdeck();
	const locked = lockedVersion(await import("../../bun.lock"));

	expect({ installed: version, locked }).toEqual({
		installed: version,
		locked: version,
	});
});
