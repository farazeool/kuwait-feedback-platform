/** Client-callable helper to submit a rating to the public rating endpoint. */
export async function submitRating(input: {
  token: string;
  rating: number;
  nonce: string;
}): Promise<{ ok: boolean; continuationToken?: string; ratingLabel?: string; ratingEmoji?: string }> {
  try {
    const res = await fetch("/api/feedback/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, website: "" }),
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean; continuationToken?: string; ratingLabel?: string; ratingEmoji?: string };
  } catch {
    return { ok: false };
  }
}

/** Client-callable helper to submit follow-up details for a public rating. */
export async function submitRatingFollowup(input: {
  token: string;
  continuationToken: string;
  rating?: number;
  customerName?: string;
  customerEmail?: string;
  comment?: string;
  contactRequested?: boolean;
  skip?: boolean;
}): Promise<{
  ok: boolean;
  followUpStatus?: string;
  contactStatus?: string;
  identityStatus?: string;
  ratingValue?: number;
  ratingLabel?: string;
  ratingEmoji?: string;
}> {
  try {
    const res = await fetch("/api/feedback/follow-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, website: "" }),
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as {
      ok: boolean;
      followUpStatus?: string;
      contactStatus?: string;
      identityStatus?: string;
      ratingValue?: number;
      ratingLabel?: string;
      ratingEmoji?: string;
    };
  } catch {
    return { ok: false };
  }
}
