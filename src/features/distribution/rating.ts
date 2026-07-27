/** Client-callable helper to submit a rating to the public rating endpoint. */
export async function submitRating(input: {
  token: string;
  rating: number;
  nonce: string;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("/api/feedback/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean };
  } catch {
    return { ok: false };
  }
}
