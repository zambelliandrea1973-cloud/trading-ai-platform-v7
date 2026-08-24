import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const databaseUser = "bridge_audit_test";
const databaseName = "bridge_audit_test";

test("PostgreSQL audit schema persists heartbeats and security rejections", async () => {
  const clusterRoot = await mkdtemp(join(tmpdir(), "bridge-audit-postgres-"));
  const dataDirectory = join(clusterRoot, "data");
  const socketDirectory = join(clusterRoot, "socket");
  const logFile = join(clusterRoot, "postgres.log");
  const port = await findFreePort();
  const connectionString = `postgresql://${databaseUser}@127.0.0.1:${port}/${databaseName}`;
  let postgresStarted = false;

  try {
    await mkdir(socketDirectory);
    await runCommand("initdb", [
      "--pgdata",
      dataDirectory,
      "--username",
      databaseUser,
      "--auth=trust",
      "--no-locale",
    ]);
    await runCommand("pg_ctl", [
      "--pgdata",
      dataDirectory,
      "--options",
      `-p ${port} -k ${socketDirectory}`,
      "--wait",
      "--log",
      logFile,
      "start",
    ]);
    postgresStarted = true;

    const isolatedEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: connectionString,
      PGHOST: "127.0.0.1",
      PGPORT: String(port),
      PGUSER: databaseUser,
      PGDATABASE: databaseName,
    };
    delete isolatedEnvironment.PGPASSWORD;

    await runCommand(
      "createdb",
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--username",
        databaseUser,
        databaseName,
      ],
      isolatedEnvironment,
    );
    await runCommand(
      "pnpm",
      ["--filter", "@workspace/db", "run", "push"],
      isolatedEnvironment,
    );

    process.env.DATABASE_URL = connectionString;
    process.env.PGHOST = "127.0.0.1";
    process.env.PGPORT = String(port);
    process.env.PGUSER = databaseUser;
    process.env.PGDATABASE = databaseName;
    delete process.env.PGPASSWORD;

    const { BridgeAuditStore } = await import(
      "../src/lib/broker/audit-store"
    );
    const { auditEventsTable, brokerDataStatusTable, db, pool } = await import(
      "@workspace/db"
    );
    try {
      const auditStore = new BridgeAuditStore();

      await auditStore.append({
        event: "heartbeat.received",
        actor: "bridge",
        at: "2026-08-24T12:00:00.000Z",
        detail: "Authenticated bridge heartbeat",
      });
      await auditStore.append({
        event: "heartbeat.rejected",
        actor: "system",
        at: "2026-08-24T12:00:01.000Z",
        detail: "Bridge heartbeat rejected because the key was rejected",
      });

      assert.deepEqual(await auditStore.list(), [
        {
          event: "heartbeat.received",
          actor: "bridge",
          at: "2026-08-24T12:00:00.000Z",
          detail: "Authenticated bridge heartbeat",
        },
        {
          event: "heartbeat.rejected",
          actor: "system",
          at: "2026-08-24T12:00:01.000Z",
          detail: "Bridge heartbeat rejected because the key was rejected",
        },
      ]);
      assert.equal(auditStore.getState().status, "healthy");

      await db.delete(brokerDataStatusTable);
      const latestDataStatus = {
        quotes: {
          status: "unavailable" as const,
          lastCheckedAt: "2026-08-24T12:00:03.000Z",
        },
        account: { status: "unknown" as const },
        positions: { status: "unknown" as const },
        history: { status: "unknown" as const },
      };
      const secondAuditStore = new BridgeAuditStore();
      await Promise.all([
        auditStore.saveDataStatus("quotes", latestDataStatus.quotes),
        secondAuditStore.saveDataStatus("account", {
          status: "available",
          lastCheckedAt: "2026-08-24T12:00:02.000Z",
        }),
      ]);

      const restartedAuditStore = new BridgeAuditStore();
      assert.deepEqual(await restartedAuditStore.loadDataStatus(), {
        ...latestDataStatus,
        account: {
          status: "available",
          lastCheckedAt: "2026-08-24T12:00:02.000Z",
        },
      });
      assert.equal((await db.select().from(brokerDataStatusTable)).length, 1);
    } finally {
      await pool.end();
    }
  } finally {
    if (postgresStarted) {
      await runCommand("pg_ctl", [
        "--pgdata",
        dataDirectory,
        "--mode",
        "immediate",
        "--wait",
        "stop",
      ]);
    }
    await rm(clusterRoot, { recursive: true, force: true });
  }
});

async function findFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert(address && typeof address !== "string");
  const { port } = address;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function runCommand(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<void> {
  try {
    await execFileAsync(command, args, {
      cwd: workspaceRoot,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const commandError = error as { stdout?: string; stderr?: string };
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        commandError.stdout,
        commandError.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
      { cause: error },
    );
  }
}