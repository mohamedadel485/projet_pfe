import fs from "fs";
import net from "net";
import path from "path";
import { ChildProcess, spawn } from "child_process";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 27017;
const STARTUP_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 500;

let managedMongoProcess: ChildProcess | null = null;
let startupPromise: Promise<boolean> | null = null;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const testTcpPort = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });

const resolveBackendRoot = (): string =>
  path.resolve(__dirname, "..", "..");

const resolveMongoPort = (mongoUri: string): number => {
  try {
    const parsed = new URL(mongoUri);
    return parsed.port ? Number(parsed.port) : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
};

const isLocalMongoUri = (mongoUri: string): boolean => {
  try {
    const parsed = new URL(mongoUri);
    return ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return mongoUri.includes("localhost") || mongoUri.includes("127.0.0.1");
  }
};

const resolveMongodPath = (): string | null => {
  const configured = process.env.MONGOD_PATH?.trim();
  if (configured) {
    return fs.existsSync(configured) ? configured : null;
  }

  if (process.platform !== "win32") {
    return "mongod";
  }

  const preferred = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";
  if (fs.existsSync(preferred)) {
    return preferred;
  }

  const installRoot = "C:\\Program Files\\MongoDB\\Server";
  if (!fs.existsSync(installRoot)) {
    return null;
  }

  const versions = fs
    .readdirSync(installRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  for (const version of versions) {
    const candidate = path.join(installRoot, version, "bin", "mongod.exe");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const waitForMongoToAcceptConnections = async (
  host: string,
  port: number,
  child: ChildProcess,
): Promise<boolean> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await testTcpPort(host, port)) {
      return true;
    }

    if (child.exitCode !== null) {
      return false;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return false;
};

const startManagedLocalMongo = async (port: number): Promise<boolean> => {
  if (await testTcpPort(DEFAULT_HOST, port)) {
    return true;
  }

  const mongodPath = resolveMongodPath();
  if (!mongodPath) {
    console.warn(
      "MongoDB local auto-start unavailable: mongod executable not found.",
    );
    return false;
  }

  const backendRoot = resolveBackendRoot();
  const dataDir = path.join(backendRoot, ".mongo-data");
  const logDir = path.join(backendRoot, ".mongo-log");
  const logPath = path.join(logDir, "mongod.log");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  console.warn(
    `MongoDB not reachable on ${DEFAULT_HOST}:${port}. Attempting local auto-start...`,
  );

  const child = spawn(
    mongodPath,
    [
      "--dbpath",
      path.relative(backendRoot, dataDir) || ".mongo-data",
      "--logpath",
      path.relative(backendRoot, logPath) || ".mongo-log\\mongod.log",
      "--bind_ip",
      DEFAULT_HOST,
      "--port",
      String(port),
    ],
    {
      cwd: backendRoot,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  managedMongoProcess = child;

  child.once("exit", (code, signal) => {
    managedMongoProcess = null;
    console.warn(
      `Managed MongoDB process stopped (code=${String(code)}, signal=${String(signal)}).`,
    );
  });

  const started = await waitForMongoToAcceptConnections(DEFAULT_HOST, port, child);
  if (!started) {
    console.warn(
      `MongoDB local auto-start failed. Check ${logPath} for details.`,
    );
    return false;
  }

  console.log(
    `Local MongoDB auto-started on ${DEFAULT_HOST}:${port} (PID: ${child.pid ?? "unknown"}).`,
  );
  return true;
};

export const ensureLocalMongoForDevelopment = async (
  mongoUri: string,
): Promise<boolean> => {
  const isDevelopmentLike =
    (process.env.NODE_ENV ?? "development") !== "production";
  const autoStartEnabled =
    (process.env.MONGODB_AUTO_START ?? "true").trim().toLowerCase() !== "false";

  if (!isDevelopmentLike || !autoStartEnabled || !isLocalMongoUri(mongoUri)) {
    return false;
  }

  const port = resolveMongoPort(mongoUri);
  if (startupPromise) {
    return startupPromise;
  }

  startupPromise = startManagedLocalMongo(port).finally(() => {
    startupPromise = null;
  });

  return startupPromise;
};
