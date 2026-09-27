#!/usr/bin/env bash
# Resolve a PR's conflicts against main, verify, push to the fork, merge.
# Purely additive conflicts (both sides add distinct lines) are resolved by
# keeping both; anything that fails typecheck or tests afterwards is left
# for manual handling and reported.
set -uo pipefail
n="$1"
repo="RWA-ToolKit/stellar-rwa-web"

git checkout main -q 2>/dev/null
git pull --ff-only origin main -q 2>/dev/null
git merge --abort 2>/dev/null

meta=$(gh pr view "$n" -R "$repo" --json headRepositoryOwner,headRefName -q '"\(.headRepositoryOwner.login)|\(.headRefName)"' 2>/dev/null)
owner=${meta%%|*}; branch=${meta##*|}
[ -z "$owner" ] && { echo "#$n SKIP no-metadata"; exit 1; }

gh pr checkout "$n" -R "$repo" >/dev/null 2>&1 || { echo "#$n SKIP checkout-failed"; exit 1; }
git merge origin/main --no-commit --no-ff >/dev/null 2>&1

conf=$(git diff --name-only --diff-filter=U)
if [ -n "$conf" ]; then
  python3 - "$conf" <<'PY'
import re, sys, pathlib
for f in sys.argv[1].split():
    p = pathlib.Path(f)
    if not p.exists(): continue
    try: s = p.read_text()
    except Exception: continue
    # Keep both sides: these branches overwhelmingly add distinct props/lines.
    s2 = re.sub(r"<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> origin/main\n",
                lambda m: m.group(1) + m.group(2), s, flags=re.S)
    if s2 != s: p.write_text(s2)
PY
fi

left=$(grep -rl '^<<<<<<<' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' . 2>/dev/null | grep -v node_modules | head -3)
if [ -n "$left" ]; then echo "#$n MANUAL markers-remain: $left"; exit 1; fi

if [ "$(npm run typecheck 2>&1 | grep -c 'error TS')" != "0" ]; then
  echo "#$n MANUAL typecheck-failed"; exit 1
fi
if ! npx jest --ci --silent >/dev/null 2>&1; then
  echo "#$n MANUAL tests-failed"; exit 1
fi

git add -A
git commit -q -m "merge main into $branch

Resolves conflicts with main by keeping both sides; typecheck and the
full test suite pass on the merged result." 2>/dev/null

git -c credential.helper= -c credential.helper='!gh auth git-credential' \
    -c credential.https://github.com.username= \
    push "https://github.com/$owner/stellar-rwa-web.git" "HEAD:$branch" >/dev/null 2>&1 \
  || { echo "#$n MANUAL push-failed"; exit 1; }

sleep 4
gh pr merge "$n" -R "$repo" --merge >/dev/null 2>&1
state=$(gh pr view "$n" -R "$repo" --json state -q .state 2>/dev/null)
echo "#$n $state"
git checkout main -q 2>/dev/null
