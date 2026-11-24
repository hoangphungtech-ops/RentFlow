"""Test a release candidate on a private, freshly seeded MySQL, with no local secrets."""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import ProxyHandler, build_opener
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
NPM = "npm.cmd" if os.name == "nt" else "npm"
LOOPBACK = build_opener(ProxyHandler({}))


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for_probe(probe, services=()):
    for _ in range(120):
        if any(process.poll() is not None for process in services):
            raise RuntimeError("Isolated application exited during startup")
        try:
            if probe():
                return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError("Isolated service did not become healthy")


def ready(url):
    with LOOPBACK.open(url, timeout=2) as response:
        return response.status == 200


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--resolve-lock", action="store_true", help="Publish the backend lock only after the isolated test passes.")
    args.add_argument("--offline", action="store_true", help="Use the existing npm cache for installation.")
    options = args.parse_args()
    publish = options.resolve_lock
    cache = "--offline" if options.offline else "--prefer-offline"
    mysql = "rentflow-v8-candidate-" + uuid4().hex[:10]
    root_password, demo_password, admin_password = (uuid4().hex for _ in range(3))
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(("SMTP_", "MYSQL_", "DEMO_"))}
    env.update(MYSQL_ROOT_PASSWORD=root_password, DEMO_PASSWORD=demo_password, DEMO_ADMIN_PASSWORD=admin_password,
               DEMO_ADMIN_EMAIL="testadmin@rentflow.test", PUBLIC_ORIGIN="", NODE_ENV="development",
               TRUST_PROXY_HOPS="0", API_HOST="127.0.0.1", NEXT_TELEMETRY_DISABLED="1")
    tracked = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "backend", "web"],
        cwd=ROOT,
    ).decode()
    with tempfile.TemporaryDirectory(prefix="rentflow-release-candidate-") as directory:
        work = Path(directory)
        for file in filter(None, tracked.split("\0")):
            target = work / file
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / file, target)
        for file in ["backend/.env", "backend/.env.admin-demo"]:
            (work / file).touch()
        api_port, web_port = free_port(), free_port()
        env.update(PORT=str(api_port), RENTFLOW_API_ORIGIN=f"http://127.0.0.1:{api_port}",
                   RENTFLOW_TEST_ORIGIN=f"http://127.0.0.1:{web_port}")
        if publish:
            subprocess.run([NPM, "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", cache],
                           cwd=work / "backend", env=env, check=True)
        for project in ["backend", "web"]:
            subprocess.run([NPM, "ci", "--ignore-scripts", "--no-audit", "--no-fund", cache],
                           cwd=work / project, env=env, check=True)

        subprocess.run(["docker", "run", "-d", "--rm", "--name", mysql, "--tmpfs", "/var/lib/mysql",
                        "-p", "127.0.0.1::3306", "-e", "MYSQL_ROOT_PASSWORD",
                        "-e", "MYSQL_DATABASE=rentflow", "mysql:8.0"], env=env, check=True, stdout=subprocess.DEVNULL)
        services = []
        try:
            wait_for_probe(lambda: subprocess.run(["docker", "exec", mysql, "sh", "-ec",
                'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol tcp -h 127.0.0.1 -uroot rentflow -e "SELECT 1"'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0)
            mapped = subprocess.check_output(["docker", "port", mysql, "3306/tcp"], text=True).strip()
            env["DATABASE_URL"] = f"mysql://root:{root_password}@{mapped}/rentflow"

            def run(project, *command):
                project_env = {**env, "NODE_ENV": "production"} if project == "web" else env
                subprocess.run(command, cwd=work / project, env=project_env, check=True)

            for action in ["validate", "generate", "migrate deploy"]:
                run("backend", "node", "node_modules/prisma/build/index.js", *action.split())
            run("backend", NPM, "run", "build")
            run("backend", NPM, "run", "seed")
            run("backend", NPM, "run", "provision:demo-admin")
            run("web", NPM, "run", "build")
            services.append(subprocess.Popen(["node", "dist/src/main.js"], cwd=work / "backend", env=env))
            wait_for_probe(lambda: ready(env["RENTFLOW_API_ORIGIN"] + "/api/health"), services)
            web_env = {**env, "NODE_ENV": "production", "PORT": str(web_port), "HOSTNAME": "127.0.0.1"}
            services.append(subprocess.Popen(["node", "-e", "require('./.next/standalone/server.js')"],
                                             cwd=work / "web", env=web_env))
            wait_for_probe(lambda: ready(env["RENTFLOW_TEST_ORIGIN"] + "/api/health"), services)
            for suite in ["test", "test:accounts", "test:smtp"]:
                run("backend", NPM, "run", suite)
            run("web", NPM, "test")
            run("backend", NPM, "audit", "--audit-level=moderate")
            if publish:
                shutil.copyfile(work / "backend" / "package-lock.json", ROOT / "backend" / "package-lock.json")
                print("Validated backend lock published to workspace")
        finally:
            for service in reversed(services):
                if service.poll() is None:
                    service.terminate()
                    service.wait(timeout=10)
            subprocess.run(["docker", "stop", mysql], check=True, stdout=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
