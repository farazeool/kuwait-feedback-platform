import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";
import { KioskConfiguration, KioskConfigurationStatus, KioskMode } from "@/features/kiosk/types";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function determineConfigurationStatus(
  desiredVersion: number,
  appliedVersion: number,
  lastError: string | null
): KioskConfigurationStatus {
  if (appliedVersion < desiredVersion) {
    return lastError ? "failed" : "pending";
  }
  return "current";
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const credential = cookieStore.get("kiosk_credential")?.value;

  if (!credential) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("get_kiosk_desired_configuration", {
    p_raw_credential: credential,
  });

  if (error) {
    console.error("Error fetching kiosk configuration:", error);
    return NextResponse.json({ error: "Invalid credential or device not found" }, { status: 404 });
  }

  // The RPC returns an empty row set for unknown or revoked credentials. We
  // treat that the same as the error branch so the device never sees a
  // partial payload.
  if (!data || data.length === 0 || !data[0]) {
    return NextResponse.json({ error: "Kiosk configuration not found." }, { status: 404 });
  }

  const config = data[0];

  const response: KioskConfiguration = {
    desiredConfigVersion: config.desired_config_version,
    appliedConfigVersion: config.applied_config_version,
    desiredSurveyId: config.desired_survey_id,
    appliedSurveyId: config.applied_survey_id,
    desiredMode: config.desired_mode as KioskMode,
    appliedMode: config.applied_mode as KioskMode,
    configurationStatus: determineConfigurationStatus(
      config.desired_config_version,
      config.applied_config_version,
      config.configuration_error
    ),
    configurationUpdatedAt: config.configuration_updated_at,
    configurationAppliedAt: config.configuration_applied_at,
    configurationError: config.configuration_error,
  };

  return NextResponse.json(response);
}
