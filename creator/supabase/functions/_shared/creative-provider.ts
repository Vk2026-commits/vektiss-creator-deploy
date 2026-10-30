import { PublicError } from "./avatar-contract.ts";
export class CreativeProvider {
  constructor(
    private key: string,
    private transport: typeof fetch = fetch,
  ) {}
  async request(
    path: string,
    method = "GET",
    body?: unknown,
    idempotency?: string,
  ): Promise<any> {
    let response: Response;
    try {
      response = await this.transport(`https://api.heygen.com${path}`, {
        method,
        headers: {
          "X-Api-Key": this.key,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new PublicError(
        "OUTCOME_UNKNOWN",
        "HeyGen did not respond in time. Refresh this saved job before starting another generation.",
        504,
      );
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Reconnect HeyGen in Avatar Library; the API key is invalid or expired.",
        402: "Add funds to your HeyGen API balance before generating.",
        403: "Your HeyGen key or plan does not allow this feature. Check its image, asset, brand and video permissions.",
        404: "This HeyGen resource is no longer available in the connected workspace.",
        409: "HeyGen is still processing this request. Refresh its status shortly.",
        429: `HeyGen is rate limiting requests. Wait ${Math.min(300, Math.max(5, Number(response.headers.get("retry-after")) || 30))} seconds before refreshing.`,
      };
      throw new PublicError(
        response.status >= 500 ? "OUTCOME_UNKNOWN" : "PROVIDER_REJECTED",
        messages[response.status] ??
          (response.status >= 500
            ? "HeyGen could not confirm this request. Refresh the saved job before retrying."
            : "HeyGen rejected these settings. Check your images, brand kit, avatar and script."),
        response.status,
      );
    }
    return response.json();
  }
  async data(path: string, method = "GET", body?: unknown, key?: string) {
    return (await this.request(path, method, body, key)).data;
  }
}
