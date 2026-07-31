import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ResponseChannel = Database["public"]["Enums"]["response_channel"];
type LocaleCode = Database["public"]["Enums"]["locale_code"];

const RESPONSE_CHANNELS: readonly ResponseChannel[] = [
  "kiosk",
  "tablet",
  "qr",
  "email",
  "web",
  "walk_in",
  "website",
  "phone",
  "whatsapp",
  "sms",
];

const LOCALES: readonly LocaleCode[] = ["en", "ar"];

const UNIQUE_VIOLATION = "23505";

function parseChannel(value: unknown): ResponseChannel | null {
  return typeof value === "string" && (RESPONSE_CHANNELS as readonly string[]).includes(value)
    ? (value as ResponseChannel)
    : null;
}

function parseLocale(value: unknown): LocaleCode {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
    ? (value as LocaleCode)
    : "en";
}

/**
 * Accepts a rating only when it is an integer within the 1-5 scale.
 * `0` and non-integers are rejected rather than silently coerced.
 */
function parseRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 5 ? value : null;
}

interface AnswerInput {
  questionId: string;
  ratingValue?: number | null;
  textValue?: string | null;
}

function parseAnswers(value: unknown): AnswerInput[] {
  if (!Array.isArray(value)) return [];
  const parsed: AnswerInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const questionId = item.questionId ?? item.question_id;
    if (typeof questionId !== "string" || questionId.length === 0) continue;
    const ratingValue = item.ratingValue ?? item.rating_value;
    const textValue = item.textValue ?? item.text_value;
    parsed.push({
      questionId,
      ratingValue:
        typeof ratingValue === "number" && Number.isInteger(ratingValue) ? ratingValue : null,
      textValue: typeof textValue === "string" && textValue.trim().length > 0 ? textValue.trim() : null,
    });
  }
  return parsed;
}

/**
 * POST /api/feedback
 *
 * Persists a survey response together with its per-question answers and,
 * when a kiosk access token is supplied, attributes the response to that
 * device. The handler never reports success before the response row is
 * durably persisted, and it rolls back the response when the dependent
 * answer rows cannot be written.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const surveyId = typeof body.surveyId === "string" ? body.surveyId : null;
    const locationId = typeof body.locationId === "string" ? body.locationId : null;
    const kioskToken = typeof body.kioskToken === "string" ? body.kioskToken : null;
    const comment =
      typeof body.comment === "string" && body.comment.trim().length > 0
        ? body.comment.trim()
        : null;
    const idempotencyKey =
      typeof body.idempotencyKey === "string" &&
      body.idempotencyKey.length >= 8 &&
      body.idempotencyKey.length <= 128
        ? body.idempotencyKey
        : null;
    const rating = parseRating(body.rating);
    const locale = parseLocale(body.language ?? body.locale);
    const answers = parseAnswers(body.answers);

    if (!surveyId) {
      return NextResponse.json({ error: "surveyId is required" }, { status: 400 });
    }
    if (rating === null) {
      return NextResponse.json(
        { error: "rating is required and must be an integer between 1 and 5" },
        { status: 400 },
      );
    }

    // ---- Resolve trusted attribution -------------------------------------
    // organization_id is never taken from the client. It is derived from the
    // survey, and the caller-supplied location is validated against it.
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("id, organization_id, status")
      .eq("id", surveyId)
      .maybeSingle();

    if (surveyError) {
      console.error("Survey lookup error:", surveyError);
      return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
    }
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const organizationId = survey.organization_id;

    // A kiosk token, when present, is the authoritative source of the device's
    // location/survey binding and must belong to the same organization.
    let resolvedLocationId = locationId;
    let channel: ResponseChannel = parseChannel(body.channel) ?? "web";

    if (kioskToken) {
      const { data: attribution, error: kioskError } = await supabase.rpc(
        "resolve_kiosk_attribution",
        { p_access_token: kioskToken },
      );

      if (kioskError) {
        console.error("Kiosk attribution lookup error:", kioskError);
        return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
      }

      const device = Array.isArray(attribution) ? attribution[0] : attribution;
      if (!device) {
        return NextResponse.json({ error: "Invalid kiosk token" }, { status: 401 });
      }
      if (device.status !== "active") {
        return NextResponse.json(
          { error: "Kiosk is not accepting responses", status: device.status },
          { status: 409 },
        );
      }
      if (device.organization_id !== organizationId) {
        return NextResponse.json({ error: "Kiosk is not bound to this survey" }, { status: 403 });
      }

      resolvedLocationId = device.location_id;
      channel = parseChannel(device.channel) ?? channel;
    }

    if (!resolvedLocationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    // Validate the location belongs to the same tenant as the survey.
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, organization_id")
      .eq("id", resolvedLocationId)
      .maybeSingle();

    if (locationError) {
      console.error("Location lookup error:", locationError);
      return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
    }
    if (!location || location.organization_id !== organizationId) {
      return NextResponse.json({ error: "Location does not belong to this survey" }, { status: 403 });
    }

    // ---- Persist the response --------------------------------------------
    const { data: response, error: responseError } = await supabase
      .from("survey_responses")
      .insert({
        survey_id: surveyId,
        organization_id: organizationId,
        location_id: resolvedLocationId,
        overall_rating: rating,
        locale,
        channel,
        idempotency_key: idempotencyKey,
        submitted_at: new Date().toISOString(),
      })
      .select("id, organization_id")
      .single();

    if (responseError || !response) {
      // Duplicate submissions resolve to the original response instead of
      // creating a second row or reporting a false failure.
      if (responseError?.code === UNIQUE_VIOLATION && idempotencyKey) {
        const { data: existing } = await supabase
          .from("survey_responses")
          .select("id")
          .eq("survey_id", surveyId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ success: true, responseId: existing.id, duplicate: true });
        }
      }

      console.error("Response insert error:", responseError);
      return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
    }

    // ---- Persist per-question answers ------------------------------------
    const answerRows = answers.map((answer) => ({
      response_id: response.id,
      survey_id: surveyId,
      organization_id: organizationId,
      question_id: answer.questionId,
      rating_value: answer.ratingValue,
      text_value: answer.textValue,
    }));

    if (answerRows.length > 0) {
      const { error: answersError } = await supabase.from("survey_answers").insert(answerRows);

      if (answersError) {
        console.error("Answer insert error:", answersError);
        // Do not leave a partially persisted response behind, and never report
        // success for an incomplete write.
        await supabase.from("survey_responses").delete().eq("id", response.id);
        return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
      }
    }

    // ---- Low-rating alert (non-fatal) ------------------------------------
    if (rating <= 2) {
      const { error: alertError } = await supabase.from("alerts").insert({
        organization_id: organizationId,
        location_id: resolvedLocationId,
        response_id: response.id,
        alert_type: "low_rating",
        rating_value: rating,
        threshold_value: 2,
        message: comment,
      });

      if (alertError) {
        // Alerting is advisory; a failure here must not discard a persisted response.
        console.error("Alert insert error:", alertError);
      }
    }

    // ---- Kiosk attribution (non-fatal) -----------------------------------
    if (kioskToken) {
      const { error: attributionError } = await supabase.rpc("record_kiosk_response", {
        p_access_token: kioskToken,
      });
      if (attributionError) {
        console.error("Kiosk attribution error:", attributionError);
      }
    }

    return NextResponse.json({ success: true, responseId: response.id });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/feedback
 *
 * Returns recent responses with bilingual survey/location labels. Row level
 * security scopes the result set to the caller's organization.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);

    const locationId = searchParams.get("locationId");
    const channel = parseChannel(searchParams.get("channel"));
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

    let query = supabase
      .from("survey_responses")
      .select(
        `
        *,
        survey:surveys(title_en, title_ar),
        location:locations(name_en, name_ar),
        answers:survey_answers(*)
      `,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit);

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Feedback fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 });
    }

    const rows = data ?? [];
    const rated = rows.filter(
      (row): row is (typeof rows)[number] & { overall_rating: number } =>
        typeof row.overall_rating === "number",
    );

    const total = rows.length;
    const averageRating =
      rated.length > 0
        ? rated.reduce((sum, row) => sum + row.overall_rating, 0) / rated.length
        : 0;
    const satisfactionRate =
      rated.length > 0
        ? (rated.filter((row) => row.overall_rating >= 4).length / rated.length) * 100
        : 0;

    return NextResponse.json({
      responses: rows,
      stats: {
        total,
        rated: rated.length,
        averageRating,
        satisfactionRate,
      },
    });
  } catch (error) {
    console.error("Feedback GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
