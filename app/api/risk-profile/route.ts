import { createRiskProfileResponse } from "@/lib/risk-profile-api";

export async function POST(request: Request) {
  const body = await request.json();

  return Response.json(createRiskProfileResponse(body));
}
