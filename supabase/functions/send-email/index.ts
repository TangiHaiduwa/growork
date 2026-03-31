import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type SendEmailPayload = {
  to?: string;
  subject?: string;
  html?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    const emailFromName = Deno.env.get("EMAIL_FROM_NAME") || "Growork";
    const replyTo = Deno.env.get("EMAIL_REPLY_TO");

    if (!resendApiKey || !emailFrom) {
      return json(500, {
        success: false,
        error: "Missing email provider configuration",
      });
    }

    const payload = (await req.json()) as SendEmailPayload;
    const to = payload.to?.trim();
    const subject = payload.subject?.trim();
    const html = payload.html?.trim();

    if (!to || !subject || !html) {
      return json(400, {
        success: false,
        error: "Fields 'to', 'subject', and 'html' are required",
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${emailFromName} <${emailFrom}>`,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const resendResult = await resendResponse.json().catch(() => null);

    if (!resendResponse.ok) {
      return json(resendResponse.status, {
        success: false,
        error:
          resendResult?.message ||
          resendResult?.error ||
          "Email provider request failed",
        provider: resendResult,
      });
    }

    return json(200, {
      success: true,
      id: resendResult?.id ?? null,
    });
  } catch (error) {
    return json(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected server error",
    });
  }
});
