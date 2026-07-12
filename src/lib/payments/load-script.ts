/**
 * PropertyPro - External Script Loader
 *
 * Loads a third-party gateway SDK (Razorpay Checkout, Paystack Inline) on demand,
 * caching the in-flight promise per src so repeated clicks don't inject duplicate
 * <script> tags. Resolves once the script has loaded, rejects if it fails.
 */

const loaders = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadScript called outside the browser"));
  }

  const existing = loaders.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const prior = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (prior && prior.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = prior ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      loaders.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };
    if (!prior) document.body.appendChild(script);
  });

  loaders.set(src, promise);
  return promise;
}
