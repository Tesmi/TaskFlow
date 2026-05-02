import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  const json = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Invalid session" }, 401);
    }

    const body = (await req.json()) as {
      project_id?: string;
      email?: string;
      role?: "admin" | "member";
    };

    const projectId = body.project_id;
    const email = body.email?.trim().toLowerCase();
    const role = body.role === "admin" ? "admin" : "member";

    if (!projectId || !email) {
      return json({ error: "project_id and email required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: memberRow, error: memErr } = await adminClient
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr || memberRow?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: listData, error: listErr } =
      await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listErr) {
      return json({ error: listErr.message }, 500);
    }

    const target = listData.users.find(
      (u) => u.email?.toLowerCase() === email,
    );

    if (!target) {
      return json(
        {
          error:
            "No user found with that email. They must sign up before you can add them.",
        },
        404,
      );
    }

    if (target.id === user.id) {
      return json({ error: "You are already in this project" }, 400);
    }

    const { error: insErr } = await adminClient.from("project_members").insert({
      project_id: projectId,
      user_id: target.id,
      role,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return json({ error: "User is already a member" }, 409);
      }
      return json({ error: insErr.message }, 500);
    }

    return json({ ok: true, user_id: target.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
