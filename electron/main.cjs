
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require("electron");

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const dotenv = require("dotenv");

app.setName("Sales Quotation System");

if (process.platform === "win32") {
  app.setAppUserModelId("com.aiglobal.salesquotation");
}

const PORT = 3210;
const APP_URL = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ICON_PATH = path.join(__dirname, "sales-quotation.ico");
const LOG_PATH = path.join(app.getPath("userData"), "desktop.log");

let mainWindow = null;
let setupWindow = null;
let serverProcess = null;
let isQuitting = false;
let isSavingConfig = false;
let setupError = "";
let setupConfig = null;
let lastServerExit = null;
let serverOutput = [];

const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: "3306",
  database: "",
  username: "root",
  password: "",
};

// --------------------------------------------------
// Persistent diagnostic logging
// Log file:
// %APPDATA%\Sales Quotation System\desktop.log
// --------------------------------------------------

function writeLog(level, message) {
  const entry =
    `[${new Date().toISOString()}] [${level}] ${message}\r\n`;

  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, entry, "utf8");
  } catch (error) {
    console.error("Unable to write desktop log:", error);
  }

  if (level === "ERROR") {
    console.error(message);
  } else {
    console.log(message);
  }
}

function addServerOutput(streamName, data) {
  const message = data.toString();
  const entry = `[Next.js ${streamName}] ${message}`;

  serverOutput.push(entry);

  // Keep recent output in memory for error reporting.
  if (serverOutput.length > 100) {
    serverOutput = serverOutput.slice(-100);
  }

  writeLog(streamName === "stderr" ? "ERROR" : "INFO", entry.trimEnd());
}

function getServerFailureMessage() {
  const output = serverOutput.join("").trim();

  let message = "The Next.js server exited unexpectedly.";

  if (lastServerExit) {
    message +=
      `\r\nExit code: ${lastServerExit.code ?? "unknown"}` +
      `; signal: ${lastServerExit.signal ?? "none"}.`;
  }

  if (output) {
    message += `\r\n\r\nRecent server output:\r\n${output.slice(-6000)}`;
  }

  message += `\r\n\r\nDiagnostic log:\r\n${LOG_PATH}`;

  return message;
}

// --------------------------------------------------
// Database configuration
// --------------------------------------------------

function getConfigPath() {
  return path.join(app.getPath("userData"), "app.env");
}

function getRuntimeDirectory() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "desktop-runtime");
  }

  return path.join(PROJECT_ROOT, "desktop-runtime");
}

function readEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return dotenv.parse(fs.readFileSync(filePath, "utf8"));
}

function configFromEnvironment(environment) {
  let url = null;

  if (environment.DATABASE_URL) {
    try {
      url = new URL(environment.DATABASE_URL);
    } catch (error) {
      writeLog("ERROR", `Unable to parse DATABASE_URL: ${error.message}`);
    }
  }

  function decode(value) {
    try {
      return decodeURIComponent(value || "");
    } catch {
      return value || "";
    }
  }

  return {
    host:
      environment.DB_HOST ||
      environment.DATABASE_HOST ||
      url?.hostname ||
      DEFAULT_CONFIG.host,

    port:
      environment.DB_PORT ||
      environment.DATABASE_PORT ||
      url?.port ||
      DEFAULT_CONFIG.port,

    database:
      environment.DB_NAME ||
      environment.DATABASE_NAME ||
      decode(url?.pathname?.replace(/^\/+/, "")),

    username:
      environment.DB_USER ||
      environment.DATABASE_USER ||
      decode(url?.username) ||
      DEFAULT_CONFIG.username,

    password:
      environment.DB_PASSWORD ??
      environment.DATABASE_PASSWORD ??
      decode(url?.password),
  };
}

function getSavedConfig() {
  const environment = readEnvironmentFile(getConfigPath());

  return environment ? configFromEnvironment(environment) : null;
}

function normalizeDatabaseConfig(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid database configuration.");
  }

  const config = {
    host: String(raw.host ?? "").trim(),
    port: String(raw.port ?? "").trim(),
    database: String(raw.database ?? "").trim(),
    username: String(raw.username ?? "").trim(),
    password: String(raw.password ?? ""),
  };

  if (!config.host) {
    throw new Error("Database host is required.");
  }

  if (!/^\d+$/.test(config.port)) {
    throw new Error("Database port must be a number.");
  }

  const portNumber = Number(config.port);

  if (portNumber < 1 || portNumber > 65535) {
    throw new Error("Database port must be between 1 and 65535.");
  }

  if (!config.database) {
    throw new Error("Database name is required.");
  }

  if (!config.username) {
    throw new Error("Database username is required.");
  }

  config.port = String(portNumber);

  return config;
}

function buildDatabaseUrl(config) {
  const host =
    config.host.includes(":") && !config.host.startsWith("[")
      ? `[${config.host}]`
      : config.host;

  const credentials =
    encodeURIComponent(config.username) +
    (config.password
      ? `:${encodeURIComponent(config.password)}`
      : "");

  return (
    `mysql://${credentials}` +
    `@${host}:${config.port}/` +
    encodeURIComponent(config.database)
  );
}

function buildDatabaseEnvironment(config) {
  return {
    DATABASE_URL: buildDatabaseUrl(config),

    DB_HOST: config.host,
    DB_PORT: config.port,
    DB_USER: config.username,
    DB_PASSWORD: config.password,
    DB_NAME: config.database,

    DATABASE_HOST: config.host,
    DATABASE_PORT: config.port,
    DATABASE_USER: config.username,
    DATABASE_PASSWORD: config.password,
    DATABASE_NAME: config.database,
  };
}

function saveDatabaseConfig(config) {
  const environment = buildDatabaseEnvironment(config);

  const contents = [
    "# Sales Quotation System database settings",
    ...Object.entries(environment).map(
      ([key, value]) => `${key}=${JSON.stringify(value)}`
    ),
    "",
  ].join("\r\n");

  fs.mkdirSync(path.dirname(getConfigPath()), {
    recursive: true,
  });

  fs.writeFileSync(getConfigPath(), contents, {
    encoding: "utf8",
    mode: 0o600,
  });

  writeLog("INFO", `Database configuration saved to ${getConfigPath()}`);
}

// --------------------------------------------------
// Next.js server lifecycle
// --------------------------------------------------

function getServerFile() {
  return path.join(getRuntimeDirectory(), "server.js");
}

async function stopNextServer() {
  const child = serverProcess;
  serverProcess = null;

  if (!child || child.exitCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2500);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    try {
      child.kill();
    } catch (error) {
      writeLog("ERROR", `Error stopping Next.js server: ${error.message}`);
      clearTimeout(timer);
      resolve();
    }
  });
}

function waitForServer(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function attempt() {
      if (isQuitting) {
        reject(new Error("Application startup was cancelled."));
        return;
      }

      if (!serverProcess) {
        reject(new Error(getServerFailureMessage()));
        return;
      }

      const request = http.get(`${APP_URL}/login`, (response) => {
        response.resume();

        writeLog(
          "INFO",
          `Next.js responded to startup check with HTTP ${response.statusCode}.`
        );

        resolve();
      });

      request.setTimeout(1500, () => {
        request.destroy();
      });

      request.on("error", () => {
        if (!serverProcess) {
          reject(new Error(getServerFailureMessage()));
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(
            new Error(
              `The application did not start within ${timeoutMs / 1000} seconds.` +
              `\r\n\r\n${getServerFailureMessage()}`
            )
          );
          return;
        }

        setTimeout(attempt, 400);
      });
    }

    attempt();
  });
}

async function startNextServer(environment) {
  await stopNextServer();

  lastServerExit = null;
  serverOutput = [];

  const runtimeDirectory = getRuntimeDirectory();
  const serverFile = getServerFile();

  writeLog("INFO", "Starting Next.js server.");
  writeLog("INFO", `Packaged app: ${app.isPackaged}`);
  writeLog("INFO", `Runtime directory: ${runtimeDirectory}`);
  writeLog("INFO", `Server file: ${serverFile}`);
  writeLog("INFO", `App executable: ${process.execPath}`);
  writeLog("INFO", `Database config file: ${getConfigPath()}`);

  if (!fs.existsSync(serverFile)) {
    throw new Error(
      `Next.js standalone server not found:\r\n${serverFile}` +
      "\r\n\r\nRun npm run desktop:prepare first."
    );
  }

  const runtimeEnvironment = {
    ...process.env,
    ...environment,

    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    ELECTRON_RUN_AS_NODE: "1",
  };

  // Do not log database passwords or the full connection URL.
  writeLog("INFO", "Launching standalone server process.");

  const child = spawn(process.execPath, [serverFile], {
    cwd: runtimeDirectory,
    env: runtimeEnvironment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess = child;

  child.stdout.on("data", (data) => {
    addServerOutput("stdout", data);
  });

  child.stderr.on("data", (data) => {
    addServerOutput("stderr", data);
  });

  child.on("error", (error) => {
    writeLog(
      "ERROR",
      `Next.js process launch error: ${error.stack || error.message}`
    );

    if (serverProcess === child) {
      serverProcess = null;
    }
  });

  child.on("exit", (code, signal) => {
    lastServerExit = { code, signal };

    writeLog(
      code === 0 && !signal ? "INFO" : "ERROR",
      `Next.js process exited. Code=${code}; signal=${signal ?? "none"}.`
    );

    if (serverProcess === child) {
      serverProcess = null;
    }
  });

  await waitForServer();
  writeLog("INFO", "Next.js server started successfully.");
}

// --------------------------------------------------
// Database connection test
// --------------------------------------------------

async function testDatabaseConnection() {
  let response;

  try {
    response = await fetch(`${APP_URL}/api/test-db`, {
      cache: "no-store",
    });
  } catch (error) {
    writeLog(
      "ERROR",
      `Cannot reach database test endpoint: ${error.message}`
    );

    return {
      success: false,
      message: "Cannot reach the database test endpoint.",
    };
  }

  const payload = await response.json().catch(() => null);

  if (response.ok && payload?.success !== false) {
    writeLog("INFO", "Database connection test succeeded.");

    return {
      success: true,
      message: "Database connection successful.",
    };
  }

  const detail =
    typeof payload?.message === "string"
      ? payload.message
      : "";

  const lower = detail.toLowerCase();

  writeLog(
    "ERROR",
    `Database test failed. HTTP ${response.status}; ${detail || "No API error message."}`
  );

  if (
    lower.includes("access denied") ||
    lower.includes("authentication") ||
    lower.includes("password")
  ) {
    return {
      success: false,
      message:
        "Database authentication failed. Check your username and password.",
    };
  }

  if (lower.includes("unknown database")) {
    return {
      success: false,
      message: "The database was not found. Check the database name.",
    };
  }

  return {
    success: false,
    message:
      detail ||
      `Database connection test failed (HTTP ${response.status}).`,
  };
}

// --------------------------------------------------
// Application windows
// --------------------------------------------------

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#F7F8F6",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL).catch((error) => {
    writeLog("ERROR", `Failed to load main application: ${error.stack || error.message}`);
  });
}

function createSetupWindow(config, errorMessage = "") {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }

  setupConfig = config || getSavedConfig() || { ...DEFAULT_CONFIG };
  setupError = errorMessage || "";

  setupWindow = new BrowserWindow({
    width: 620,
    height: 790,
    minWidth: 560,
    minHeight: 700,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    title: "Sales Quotation System — Database Setup",
    backgroundColor: "#F7F8F6",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  setupWindow.loadFile(path.join(__dirname, "setup.html")).catch((error) => {
    writeLog("ERROR", `Failed to load database setup form: ${error.stack || error.message}`);
  });

  setupWindow.once("ready-to-show", () => {
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.show();
    }
  });

  setupWindow.on("closed", () => {
    setupWindow = null;

    if (!mainWindow && !isQuitting) {
      app.quit();
    }
  });
}

// --------------------------------------------------
// Setup form IPC handlers
// --------------------------------------------------

function registerSetupHandlers() {
  ipcMain.handle("setup:get-initial-data", () => ({
    config:
      setupConfig ||
      getSavedConfig() ||
      { ...DEFAULT_CONFIG },

    configPath: getConfigPath(),
    error: setupError,
  }));

  ipcMain.handle("setup:save-and-connect", async (_event, rawConfig) => {
    if (isSavingConfig) {
      return {
        success: false,
        message: "A connection attempt is already in progress.",
      };
    }

    isSavingConfig = true;

    try {
      const config = normalizeDatabaseConfig(rawConfig);
      setupConfig = config;

      // Never write the password to the diagnostic log.
      writeLog(
        "INFO",
        `Testing database host=${config.host}, port=${config.port}, database=${config.database}, user=${config.username}`
      );

      saveDatabaseConfig(config);

      await startNextServer(buildDatabaseEnvironment(config));

      const result = await testDatabaseConnection();

      if (!result.success) {
        throw new Error(result.message);
      }

      setupError = "";
      createMainWindow();

      setTimeout(() => {
        if (setupWindow && !setupWindow.isDestroyed()) {
          setupWindow.close();
        }
      }, 500);

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      writeLog(
        "ERROR",
        `Database setup failed: ${error.stack || error.message || String(error)}`
      );

      await stopNextServer();

      setupError =
        error instanceof Error
          ? error.message
          : "Unable to save database configuration.";

      return {
        success: false,
        message: setupError,
      };
    } finally {
      isSavingConfig = false;
    }
  });
}

// --------------------------------------------------
// Application startup
// --------------------------------------------------

async function startApplication() {
  registerSetupHandlers();

  writeLog("INFO", "----------------------------------------");
  writeLog("INFO", "Sales Quotation System starting.");
  writeLog("INFO", `Electron version: ${process.versions.electron}`);
  writeLog("INFO", `Node version: ${process.versions.node}`);
  writeLog("INFO", `Packaged app: ${app.isPackaged}`);
  writeLog("INFO", `User data directory: ${app.getPath("userData")}`);

  if (!app.isPackaged) {
    const developmentEnvPath = path.join(PROJECT_ROOT, ".env");

    if (!fs.existsSync(developmentEnvPath)) {
      throw new Error(`Development .env file not found:\r\n${developmentEnvPath}`);
    }

    const developmentEnvironment = readEnvironmentFile(developmentEnvPath);

    await startNextServer(developmentEnvironment);
    createMainWindow();

    return;
  }

  const savedEnvironment = readEnvironmentFile(getConfigPath());

  if (!savedEnvironment) {
    writeLog("INFO", "No saved database configuration. Opening setup form.");
    createSetupWindow({ ...DEFAULT_CONFIG });
    return;
  }

  const savedConfig = configFromEnvironment(savedEnvironment);

  try {
    const normalized = normalizeDatabaseConfig(savedConfig);

    await startNextServer(buildDatabaseEnvironment(normalized));

    const result = await testDatabaseConnection();

    if (!result.success) {
      throw new Error(result.message);
    }

    createMainWindow();
  } catch (error) {
    writeLog(
      "ERROR",
      `Startup with saved configuration failed: ${error.stack || error.message || String(error)}`
    );

    await stopNextServer();

    createSetupWindow(
      savedConfig,
      error instanceof Error
        ? error.message
        : "Unable to connect to the database."
    );
  }
}

// --------------------------------------------------
// Single application instance and shutdown
// --------------------------------------------------

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    } else if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startApplication().catch((error) => {
      writeLog(
        "ERROR",
        `Application startup failed: ${error.stack || error.message || String(error)}`
      );

      dialog.showErrorBox(
        "Sales Quotation System",
        error instanceof Error ? error.message : "Unable to start the application."
      );

      app.quit();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  void stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
