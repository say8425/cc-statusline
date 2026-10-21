import { $ } from "bun";

// dir이 속한 git 레포지토리 최상위 경로. 레포가 아니거나 git이 실패하면 null.
// diff 수치와 diff 뷰어 링크가 같은 레포를 가리키도록 둘 다 이 값을 기준으로 삼는다.
export const resolveRepoRoot = async (dir: string): Promise<string | null> => {
	try {
		const out = await $`git -C ${dir} rev-parse --show-toplevel 2>/dev/null`
			.nothrow()
			.quiet()
			.text();
		return out.trim() || null;
	} catch {
		return null;
	}
};
