const crypto = require("crypto");
const path = require("path");
const fs = require("fs-extra");
const axios = require("axios");

const { logDebug, logWarning } = require("../utils/logger.js");

const DASHBOARD_ASSETS_ROOT = path.join(__dirname, "../../data/dashboard-assets");
const PUBLIC_ASSETS_PREFIX = "/dashboard-assets/";
const FAILED_RETRY_DELAY_MS = 10 * 60 * 1000;
const MAX_CONCURRENT_REMOTE_DOWNLOADS = 2;
const inflightDownloads = new Map();
const failedDownloads = new Map();
const downloadQueue = [];
let activeDownloadCount = 0;

async function resolveDashboardImage(sourceUrl, options = {}) {
  const asset = await ensureDashboardAsset(sourceUrl, options, { waitForDownload: false });
  return asset.publicPath;
}

async function storeDashboardImage(sourceUrl, options = {}) {
  const asset = await ensureDashboardAsset(sourceUrl, options, { waitForDownload: true });
  return asset.publicPath;
}

async function removeDashboardAsset(sourceUrl) {
  if (!isDashboardAssetPath(sourceUrl)) {
    return false;
  }

  const relativePath = getDashboardAssetRelativePath(sourceUrl);

  if (!relativePath) {
    return false;
  }

  const absolutePath = toDashboardAssetAbsolutePath(relativePath);

  if (!absolutePath) {
    return false;
  }

  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  await fs.remove(absolutePath);
  return true;
}

function getDashboardAssetsRoot() {
  return DASHBOARD_ASSETS_ROOT;
}

async function ensureDashboardAsset(sourceUrl, options, behavior) {
  const namespace = safeSegment(options.namespace || "misc");
  const label = normalizeSimpleString(options.label) || "Asset";
  const assetKey = normalizeSimpleString(options.assetKey) || label;

  if (isDashboardAssetPath(sourceUrl)) {
    return ensureLocalDashboardAsset(sourceUrl, options);
  }

  const directoryPath = path.join(DASHBOARD_ASSETS_ROOT, namespace);
  await fs.ensureDir(directoryPath);

  const baseName = buildAssetBaseName(assetKey, sourceUrl || label);
  const existingAsset = findDownloadedAsset(directoryPath, baseName);

  if (existingAsset) {
    return {
      publicPath: toPublicAssetPath(path.join(namespace, existingAsset))
    };
  }

  if (isRemoteImageUrl(sourceUrl)) {
    if (behavior.waitForDownload) {
      const storedFileName = await downloadAsset(sourceUrl, {
        directoryPath,
        namespace,
        baseName
      });

      if (storedFileName) {
        return {
          publicPath: toPublicAssetPath(path.join(namespace, storedFileName))
        };
      }
    } else {
      void downloadAsset(sourceUrl, {
        directoryPath,
        namespace,
        baseName
      });
    }
  }

  const placeholderName = `${baseName}.svg`;
  const placeholderPath = path.join(directoryPath, placeholderName);

  if (!fs.existsSync(placeholderPath)) {
    const svg = buildPlaceholderSvg(label, options.variant || namespace);
    await fs.writeFile(placeholderPath, svg, "utf8");
  }

  return {
    publicPath: toPublicAssetPath(path.join(namespace, placeholderName))
  };
}

async function ensureLocalDashboardAsset(sourceUrl, options = {}) {
  const publicPath = normalizeDashboardAssetPath(sourceUrl);
  const relativePath = getDashboardAssetRelativePath(publicPath);

  if (!relativePath) {
    return { publicPath };
  }

  const absolutePath = toDashboardAssetAbsolutePath(relativePath);

  if (!absolutePath) {
    return { publicPath };
  }

  if (fs.existsSync(absolutePath)) {
    return { publicPath };
  }

  const directoryPath = path.dirname(absolutePath);
  const extension = path.extname(relativePath).toLowerCase();
  const baseName = path.basename(relativePath, extension);
  const namespace = relativePath.split(/[\\/]/)[0] || safeSegment(options.namespace || "misc");
  await fs.ensureDir(directoryPath);

  const existingSibling = findAssetSibling(directoryPath, baseName);

  if (existingSibling) {
    return {
      publicPath: toPublicAssetPath(path.join(path.dirname(relativePath), existingSibling))
    };
  }

  const placeholderName = `${baseName}.svg`;
  const placeholderPath = path.join(directoryPath, placeholderName);

  if (!fs.existsSync(placeholderPath)) {
    const label = normalizeSimpleString(options.label) || baseName || "Asset";
    const svg = buildPlaceholderSvg(label, options.variant || namespace);
    await fs.writeFile(placeholderPath, svg, "utf8");
  }

  return {
    publicPath: toPublicAssetPath(path.join(path.dirname(relativePath), placeholderName))
  };
}

async function downloadAsset(sourceUrl, { directoryPath, namespace, baseName }) {
  const existingAsset = findDownloadedAsset(directoryPath, baseName);

  if (existingAsset) {
    return existingAsset;
  }

  const inflightKey = `${namespace}:${baseName}`;
  const lastFailureAt = failedDownloads.get(inflightKey);

  if (lastFailureAt && Date.now() - lastFailureAt < FAILED_RETRY_DELAY_MS) {
    return null;
  }

  if (inflightDownloads.has(inflightKey)) {
    return inflightDownloads.get(inflightKey);
  }

  const promise = (async () => {
    const releaseSlot = await acquireDownloadSlot();

    try {
      logDebug(`Dashboard asset download ${sourceUrl}`, "DashboardAssets");

      const response = await axios.get(sourceUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
        maxContentLength: 6 * 1024 * 1024,
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (compatible; HavokDashboard/1.0; +https://localhost)"
        },
        validateStatus: (status) => status >= 200 && status < 400
      });

      const extension = resolveExtension(sourceUrl, response.headers["content-type"]);
      const fileName = `${baseName}${extension}`;
      const filePath = path.join(directoryPath, fileName);

      await fs.writeFile(filePath, response.data);
      failedDownloads.delete(inflightKey);
      return fileName;
    } catch (error) {
      failedDownloads.set(inflightKey, Date.now());
      logWarning(`Dashboard asset impossible a telecharger: ${sourceUrl}`, "DashboardAssets");
      return null;
    } finally {
      releaseSlot();
      inflightDownloads.delete(inflightKey);
    }
  })();

  inflightDownloads.set(inflightKey, promise);
  return promise;
}

async function acquireDownloadSlot() {
  if (activeDownloadCount < MAX_CONCURRENT_REMOTE_DOWNLOADS) {
    activeDownloadCount += 1;
    return releaseDownloadSlot;
  }

  return new Promise((resolve) => {
    downloadQueue.push(() => {
      activeDownloadCount += 1;
      resolve(releaseDownloadSlot);
    });
  });
}

function releaseDownloadSlot() {
  activeDownloadCount = Math.max(0, activeDownloadCount - 1);
  const nextDownload = downloadQueue.shift();

  if (nextDownload) {
    nextDownload();
  }
}

function findDownloadedAsset(directoryPath, baseName) {
  if (!fs.existsSync(directoryPath)) {
    return null;
  }

  const files = fs.readdirSync(directoryPath);

  return (
    files.find((fileName) => fileName.startsWith(`${baseName}.`) && !fileName.endsWith(".svg")) ||
    null
  );
}

function findAssetSibling(directoryPath, baseName) {
  if (!fs.existsSync(directoryPath)) {
    return null;
  }

  const files = fs.readdirSync(directoryPath);

  return files.find((fileName) => fileName.startsWith(`${baseName}.`)) || null;
}

function buildAssetBaseName(assetKey, seed) {
  const slug = slugify(assetKey || "asset");
  const hash = crypto.createHash("sha1").update(String(seed || assetKey || "asset")).digest("hex").slice(0, 10);
  return `${slug}-${hash}`;
}

function buildPlaceholderSvg(label, variant) {
  const palette = getVariantPalette(variant);
  const initials = getInitials(label);
  const safeLabel = escapeXml(label);
  const safeInitials = escapeXml(initials);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-label="${safeLabel}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.start}" />
      <stop offset="100%" stop-color="${palette.end}" />
    </linearGradient>
  </defs>
  <rect width="640" height="640" rx="52" fill="url(#bg)" />
  <circle cx="520" cy="120" r="88" fill="${palette.glow}" opacity="0.24" />
  <circle cx="130" cy="520" r="120" fill="${palette.glow}" opacity="0.12" />
  <text x="320" y="298" fill="${palette.text}" font-family="Sora, Manrope, sans-serif" font-size="176" font-weight="800" text-anchor="middle">${safeInitials}</text>
  <text x="320" y="382" fill="${palette.textSoft}" font-family="Manrope, sans-serif" font-size="34" font-weight="700" text-anchor="middle">${safeLabel}</text>
</svg>`.trim();
}

function getVariantPalette(variant) {
  if (variant === "events") {
    return {
      start: "#171b24",
      end: "#3f4c64",
      glow: "#d8b173",
      text: "#f7f2e8",
      textSoft: "#d8cdbd"
    };
  }

  if (variant === "players") {
    return {
      start: "#18222b",
      end: "#365468",
      glow: "#89d0ff",
      text: "#f2f8fb",
      textSoft: "#d2e8f2"
    };
  }

  if (variant === "flags") {
    return {
      start: "#312114",
      end: "#735130",
      glow: "#ffdc99",
      text: "#fff4de",
      textSoft: "#f1dfbc"
    };
  }

  if (variant === "actu") {
    return {
      start: "#241a12",
      end: "#8a5f34",
      glow: "#ffd39c",
      text: "#fff5e8",
      textSoft: "#ecd8be"
    };
  }

  return {
    start: "#1a1f29",
    end: "#4e5c74",
    glow: "#d8b173",
    text: "#f5f2ea",
    textSoft: "#d6cfbf"
  };
}

function resolveExtension(sourceUrl, contentType) {
  const extensionFromUrl = getExtensionFromUrl(sourceUrl);

  if (extensionFromUrl) {
    return extensionFromUrl;
  }

  const mimeType = normalizeSimpleString(contentType).split(";")[0];

  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/svg+xml") return ".svg";

  return ".jpg";
}

function getExtensionFromUrl(value) {
  try {
    const pathname = new URL(String(value)).pathname;
    const extension = path.extname(pathname).toLowerCase();
    return isKnownImageExtension(extension) ? extension : "";
  } catch (error) {
    return "";
  }
}

function isKnownImageExtension(value) {
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(value);
}

function isRemoteImageUrl(value) {
  const normalizedValue = normalizeSimpleString(value);
  return normalizedValue.startsWith("http://") || normalizedValue.startsWith("https://");
}

function isDashboardAssetPath(value) {
  const normalizedValue = normalizeSimpleString(value).replaceAll("\\", "/");

  return (
    normalizedValue.startsWith(PUBLIC_ASSETS_PREFIX) ||
    normalizedValue.startsWith("dashboard-assets/") ||
    normalizedValue.includes("/dashboard-assets/") ||
    normalizedValue.includes("server/data/dashboard-assets/")
  );
}

function normalizeDashboardAssetPath(value) {
  const normalizedValue = normalizeSimpleString(value).replaceAll("\\", "/");

  if (normalizedValue.startsWith(PUBLIC_ASSETS_PREFIX)) {
    return normalizedValue;
  }

  const dashboardAssetsIndex = normalizedValue.indexOf("dashboard-assets/");

  if (dashboardAssetsIndex >= 0) {
    return `/${normalizedValue.slice(dashboardAssetsIndex)}`;
  }

  return toPublicAssetPath(normalizedValue);
}

function getDashboardAssetRelativePath(value) {
  const normalizedValue = normalizeDashboardAssetPath(value).replaceAll("\\", "/");
  const dashboardAssetsIndex = normalizedValue.indexOf("dashboard-assets/");

  if (dashboardAssetsIndex < 0) {
    return "";
  }

  return normalizedValue.slice(dashboardAssetsIndex + "dashboard-assets/".length).replace(/^\/+/, "");
}

function toDashboardAssetAbsolutePath(relativePath) {
  const normalizedRelativePath = String(relativePath || "").replaceAll("/", path.sep).trim();

  if (!normalizedRelativePath) {
    return "";
  }

  const absolutePath = path.resolve(DASHBOARD_ASSETS_ROOT, normalizedRelativePath);
  const normalizedRoot = path.resolve(DASHBOARD_ASSETS_ROOT);

  if (!absolutePath.startsWith(normalizedRoot)) {
    return "";
  }

  return absolutePath;
}

function toPublicAssetPath(relativePath) {
  return `${PUBLIC_ASSETS_PREFIX}${String(relativePath).replaceAll("\\", "/").replace(/^\/+/, "")}`;
}

function safeSegment(value) {
  return String(value || "misc")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "misc";
}

function slugify(value) {
  return String(value || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
}

function getInitials(value) {
  return String(value || "HV")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "HV";
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeSimpleString(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  getDashboardAssetsRoot,
  removeDashboardAsset,
  resolveDashboardImage,
  storeDashboardImage
};
