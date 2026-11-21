"""Smoke test the production images on an isolated, loopback-only Windows stack."""
import json
import os
import pathlib
import subprocess
import tempfile
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOMAIN = "rentflow.localhost"
TAG = os.environ.get("RENTFLOW_SMOKE_TAG", "local-build-check")
password = uuid.uuid4().hex
project = "rentflow-smoke-" + password[:6]
environment = dict(
    os.environ,
    RENTFLOW_DOMAIN=DOMAIN,
    RENTFLOW_RELEASE=TAG,
    MYSQL_ROOT_PASSWORD=uuid.uuid4().hex,
    MYSQL_PASSWORD=password,
    DATABASE_URL=f"mysql://rentflow:{password}@mysql:3306/rentflow",
)


def invoke(command, **options):
    return subprocess.run(command, env=environment, check=True, **options)


def main():
    runtime_check = """
    require('@prisma/client');
    for (const name of ['prisma', '@prisma/config', 'effect', 'deepmerge-ts']) {
      try { require.resolve(name); throw Error('Unexpected CLI package: ' + name); }
      catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
    }
    console.log('Prisma client present; Prisma CLI advisory chain absent');
    """
    invoke(["docker", "run", "--rm", "--entrypoint", "node", f"rentflow-api:{TAG}", "-e", runtime_check])

    with tempfile.TemporaryDirectory() as directory:
        temp = pathlib.Path(directory)
        caddy = temp / "Caddyfile"
        source = (ROOT / "deploy" / "Caddyfile").read_text()
        caddy.write_text(source.replace("{$RENTFLOW_DOMAIN} {", "{$RENTFLOW_DOMAIN} {\n    tls internal", 1))
        overrides = temp / "compose.yml"
        overrides.write_text(
            'services:\n  edge:\n    ports: !override ["127.0.0.1:18443:443"]\n'
            f'    volumes:\n      - "{caddy.as_posix()}:/etc/caddy/Caddyfile:ro"\n'
        )
        compose = [
            "docker", "compose", "-p", project,
            "-f", str(ROOT / "deploy" / "compose.production.yml"), "-f", str(overrides),
        ]
        try:
            invoke([*compose, "up", "-d", "--wait", "mysql"])
            invoke([*compose, "run", "--rm", "--no-deps", "migrate"])
            invoke([*compose, "up", "-d", "--no-build", "--wait", "api", "web", "edge"])
            certificate = temp / "root.crt"
            invoke([*compose, "cp", "edge:/data/caddy/pki/authorities/local/root.crt", str(certificate)])
            curl = [
                "curl.exe", "--noproxy", "*", "--silent", "--show-error", "--fail", "--retry", "5",
                "--retry-all-errors", "--ssl-revoke-best-effort", "--cacert", str(certificate), "--resolve", f"{DOMAIN}:18443:127.0.0.1",
            ]
            for path in ["/", "/quan-ly", "/khoi-phuc", "/quyen-rieng-tu", "/xoa-tai-khoan", "/api/health"]:
                response = invoke([*curl, "https://" + DOMAIN + ":18443" + path], stdout=subprocess.PIPE).stdout
                if not response or (path == "/api/health" and b'"status":"ok"' not in response):
                    raise RuntimeError("Invalid HTTPS smoke response for " + path)
                print("HTTPS smoke PASS", path, flush=True)
            mysql = invoke([*compose, "ps", "-q", "mysql"], capture_output=True, text=True).stdout.strip()
            bindings = invoke(
                ["docker", "inspect", "--format", "{{json .HostConfig.PortBindings}}", mysql],
                capture_output=True, text=True,
            ).stdout
            if any((json.loads(bindings) or {}).values()):
                raise RuntimeError("MySQL unexpectedly has a host port")
            print("MySQL 3306 has no host mapping", flush=True)
            demo_check = """
            const assert = require('node:assert/strict');
            const { randomUUID } = require('node:crypto');
            const { db, passwordHash } = require('./dist/src/auth');
            async function verify() {
              assert.equal(await db.user.count({ where: { username: 'testadmin' } }), 0);
              const password = randomUUID();
              const hash = passwordHash(password);
              const login = identifier => fetch('http://127.0.0.1:3001/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RentFlow-Web': '1' },
                body: JSON.stringify({ identifier, password }),
              });
              await db.user.create({ data: { username: 'testadmin', email: 'demo@rentflow.test',
                fullName: 'Smoke demo fixture', role: 'OWNER', isDemo: true, passwordHash: hash } });
              assert.equal((await login('testadmin')).status, 401);
              await db.user.create({ data: { email: 'smoke@rentflow.test',
                fullName: 'Smoke renter fixture', role: 'RENTER', passwordHash: hash } });
              const response = await login('smoke@rentflow.test');
              assert.equal(response.status, 200);
              const cookie = response.headers.get('set-cookie') ?? '';
              assert(cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
              assert.equal((await response.json()).token, undefined);
            }
            verify().catch(() => { process.exitCode = 1; }).finally(() => db.$disconnect());
            """
            invoke([*compose, "exec", "-T", "api", "node", "-e", demo_check])
            print("Production bootstrap left demo account absent, denied copied demo fixture and served a Secure HttpOnly cookie", flush=True)
        finally:
            invoke([*compose, "stop", "edge", "web", "api", "mysql"])


if __name__ == "__main__":
    main()
