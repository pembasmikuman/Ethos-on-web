#!/bin/sh
# Runs the WebKit e2e tests inside Playwright's container, since WebKit needs Ubuntu libraries most hosts lack.
# Uses the official bun release inside the container (a distro bun is linked to host libraries). Extra args go to `playwright test`.
set -e
V=$(bun -e "console.log(require('@playwright/test/package.json').version)")
exec podman run --rm --userns=keep-id --ipc=host -v "$PWD":/work:Z -w /work -e HOME=/tmp -e ETHOS_BACKUP \
  mcr.microsoft.com/playwright:v$V-noble bash -c '
    curl -fsSL -o /tmp/bun.zip https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip &&
    python3 -c "import zipfile; zipfile.ZipFile(\"/tmp/bun.zip\").extractall(\"/tmp\")" &&
    chmod +x /tmp/bun-linux-x64/bun && ln -s bun /tmp/bun-linux-x64/bunx && export PATH=/tmp/bun-linux-x64:$PATH &&
    bun --bun x playwright test "$@"' e2e "$@"
