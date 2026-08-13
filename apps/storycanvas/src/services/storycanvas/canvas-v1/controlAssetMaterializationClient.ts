import {
  assertCanvasAssetMaterializationMatchesRequest,
  parseCanvasAssetMaterializationRequestV01,
  parseCanvasAssetMaterializationV01,
  type CanvasAssetMaterializationRequestV01,
  type CanvasAssetMaterializationV01,
} from "@/contracts/canvas-v1/workspaceMaterialization";

const PATH = "/api/v1/internal/canvas-assets/materializations";

export type CanvasAssetMaterializationFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

export class CanvasAssetMaterializationClientError extends Error {
  constructor(
    public readonly code:
      | "CANVAS_MATERIALIZATION_CONFIGURATION_INVALID"
      | "CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE"
      | "CANVAS_MATERIALIZATION_INVALID_RESPONSE",
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super("Canvas asset materialization is unavailable.");
    this.name = "CanvasAssetMaterializationClientError";
  }
}

export interface CanvasAssetMaterializationPort {
  materialize(request: CanvasAssetMaterializationRequestV01): Promise<CanvasAssetMaterializationV01>;
}

export interface ControlCanvasAssetMaterializationClientOptions {
  controlApiBaseUrl: string;
  internalToken: string;
  fetch?: CanvasAssetMaterializationFetch;
}

function validBaseUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) return null;
    return parsed;
  } catch { return null; }
}

export class ControlCanvasAssetMaterializationClient implements CanvasAssetMaterializationPort {
  private readonly baseUrl: URL;
  private readonly fetchImpl: CanvasAssetMaterializationFetch;

  constructor(private readonly options: ControlCanvasAssetMaterializationClientOptions) {
    const baseUrl = validBaseUrl(options.controlApiBaseUrl);
    if (!baseUrl || Buffer.byteLength(options.internalToken, "utf8") < 32) {
      throw new CanvasAssetMaterializationClientError("CANVAS_MATERIALIZATION_CONFIGURATION_INVALID", 503, false);
    }
    this.baseUrl = baseUrl;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async materialize(raw: CanvasAssetMaterializationRequestV01): Promise<CanvasAssetMaterializationV01> {
    let request: CanvasAssetMaterializationRequestV01;
    try { request = parseCanvasAssetMaterializationRequestV01(raw); }
    catch { throw new CanvasAssetMaterializationClientError("CANVAS_MATERIALIZATION_INVALID_RESPONSE", 422, false); }
    const body = JSON.stringify(request);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(new URL(PATH, this.baseUrl).toString(), {
          method: "POST",
          headers: {
            accept: "application/json",
            "cache-control": "no-store",
            "content-type": "application/json",
            "x-production-plane-internal-token": this.options.internalToken,
            "x-request-id": request.requestId,
          },
          body,
        });
      } catch {
        if (attempt === 0) continue;
        throw new CanvasAssetMaterializationClientError("CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE", 503, true);
      }
      if (response.status === 503 && attempt === 0) continue;
      if (!response.ok) {
        throw new CanvasAssetMaterializationClientError(
          response.status === 503 ? "CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE" : "CANVAS_MATERIALIZATION_INVALID_RESPONSE",
          response.status,
          response.status === 503,
        );
      }
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        throw new CanvasAssetMaterializationClientError("CANVAS_MATERIALIZATION_INVALID_RESPONSE", 502, false);
      }
      try {
        const parsed = parseCanvasAssetMaterializationV01(await response.json());
        assertCanvasAssetMaterializationMatchesRequest(parsed, request);
        return parsed;
      } catch {
        throw new CanvasAssetMaterializationClientError("CANVAS_MATERIALIZATION_INVALID_RESPONSE", 502, false);
      }
    }
    throw new CanvasAssetMaterializationClientError("CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE", 503, true);
  }
}
