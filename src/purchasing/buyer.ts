/** Deep link to Vinted item — opens in browser/app */
export function buildDeepLink(vintedUrl: string): string {
  return vintedUrl;
}

/**
 * Check if an item is still available on Vinted.
 * Uses a simple HEAD request to the item URL.
 */
export async function isItemAvailable(vintedUrl: string): Promise<boolean> {
  try {
    const response = await fetch(vintedUrl, {
      method: "HEAD",
      redirect: "follow",
    });
    // 200 = available, 404 = sold/removed
    return response.ok;
  } catch {
    return false;
  }
}
