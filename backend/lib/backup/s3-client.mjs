// Minimal S3-compatible client (AWS S3, Cloudflare R2, Backblaze B2, MinIO)
// for off-site SQLite backups: PUT / HEAD / GET / ListObjectsV2 with AWS
// Signature V4. Hand-rolled on node:crypto + fetch to avoid pulling the
// whole AWS SDK into the production image for four requests.
//
// Integrity: every PUT sends Content-MD5 (the store rejects a body that
// doesn't match) and a signed x-amz-content-sha256 of the exact payload,
// and records the SHA-256 as object metadata so a later HEAD/GET can be
// verified end to end (see uploadVerified / downloadVerified).

import { createHash, createHmac } from "node:crypto";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

// RFC 3986 encoding as SigV4 requires (encodeURIComponent leaves !'()* alone).
function uriEncode(value, encodeSlash = true) {
  const encoded = encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return encodeSlash ? encoded : encoded.replace(/%2F/g, "/");
}

export function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * Computes SigV4 headers for one request. Pure (date injectable) so it can
 * be checked against AWS's published test vector.
 */
export function signRequest({
  method, url, headers = {}, payloadHash = EMPTY_SHA256,
  accessKeyId, secretAccessKey, region, service = "s3", date = new Date(),
}) {
  const u = new URL(url);
  const stamp = amzDate(date);
  const day = stamp.slice(0, 8);
  const allHeaders = { ...headers, host: u.host, "x-amz-content-sha256": payloadHash, "x-amz-date": stamp };
  const lower = Object.fromEntries(Object.entries(allHeaders).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const signedHeaderNames = Object.keys(lower).sort();
  const canonicalHeaders = signedHeaderNames.map((k) => `${k}:${lower[k]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalQuery = [...u.searchParams.entries()]
    .map(([k, v]) => [uriEncode(k), uriEncode(v)])
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : (a < b ? -1 : 1)))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonicalPath = u.pathname.split("/").map((seg) => uriEncode(decodeURIComponent(seg))).join("/") || "/";
  const canonicalRequest = [method, canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), service), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    headers: {
      ...allHeaders,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    signature,
  };
}

export function isOffsiteConfigured(config) {
  return Boolean(config?.endpoint && config?.bucket && config?.accessKeyId && config?.secretAccessKey);
}

export function createS3Client(config, { fetchImpl = fetch } = {}) {
  if (!isOffsiteConfigured(config)) throw new Error("off-site backup storage is not configured");
  const base = config.endpoint.replace(/\/+$/, "");
  const objectUrl = (key) => `${base}/${uriEncode(config.bucket)}/${uriEncode(key, false)}`;

  async function send(method, url, { body, headers = {} } = {}) {
    const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;
    const { headers: signed } = signRequest({
      method, url, headers, payloadHash,
      accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: config.region || "auto",
    });
    // fetch sets host and content-length itself (to the same values that
    // were signed); passing them explicitly is rejected by undici.
    delete signed.host;
    delete signed["content-length"];
    const res = await fetchImpl(url, { method, headers: signed, body });
    return res;
  }

  async function expectOk(res, what) {
    if (res.ok) return res;
    const text = await res.text().catch(() => "");
    // Never echo credentials; the S3 error XML contains none.
    throw new Error(`${what} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  return {
    async putObject(key, body, { metadata = {} } = {}) {
      const headers = {
        "content-type": "application/vnd.sqlite3",
        "content-length": String(body.length),
        "content-md5": createHash("md5").update(body).digest("base64"),
      };
      for (const [k, v] of Object.entries(metadata)) headers[`x-amz-meta-${k}`] = v;
      await expectOk(await send("PUT", objectUrl(key), { body, headers }), `PUT ${key}`);
    },
    async headObject(key) {
      const res = await expectOk(await send("HEAD", objectUrl(key)), `HEAD ${key}`);
      return {
        size: Number(res.headers.get("content-length")),
        sha256: res.headers.get("x-amz-meta-sha256"),
      };
    },
    async getObject(key) {
      const res = await expectOk(await send("GET", objectUrl(key)), `GET ${key}`);
      return {
        body: Buffer.from(await res.arrayBuffer()),
        sha256: res.headers.get("x-amz-meta-sha256"),
      };
    },
    async listKeys(prefix) {
      const keys = [];
      let token = null;
      do {
        const url = new URL(`${base}/${uriEncode(config.bucket)}`);
        url.searchParams.set("list-type", "2");
        url.searchParams.set("prefix", prefix);
        if (token) url.searchParams.set("continuation-token", token);
        const res = await expectOk(await send("GET", url.toString()), "LIST");
        const xml = await res.text();
        for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, "&"));
        const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
        token = truncated ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null) : null;
      } while (token);
      return keys.sort();
    },
  };
}

/** Uploads a buffer and proves the stored object matches (size + SHA-256). */
export async function uploadVerified(client, key, body) {
  const sha256 = sha256Hex(body);
  await client.putObject(key, body, { metadata: { sha256 } });
  const head = await client.headObject(key);
  if (head.size !== body.length) throw new Error(`off-site verify failed for ${key}: size ${head.size} != ${body.length}`);
  if (head.sha256 !== sha256) throw new Error(`off-site verify failed for ${key}: recorded sha256 ${head.sha256 ?? "missing"} != ${sha256}`);
  return { key, size: body.length, sha256 };
}

/** Downloads an object and checks it against its recorded SHA-256. */
export async function downloadVerified(client, key) {
  const { body, sha256 } = await client.getObject(key);
  const actual = sha256Hex(body);
  if (!sha256) throw new Error(`${key} has no recorded sha256 -- refusing to trust it`);
  if (actual !== sha256) throw new Error(`${key} is corrupt: sha256 ${actual} != recorded ${sha256}`);
  return { body, sha256 };
}
