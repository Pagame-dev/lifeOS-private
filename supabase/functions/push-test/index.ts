import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webPush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getVapidKeys(supabase: ReturnType<typeof createClient>): Promise<{ public: string; private: string }> {
  const { data } = await supabase
    .from("app_secrets")
    .select("key, value")
    .in("key", ["vapid_public_key", "vapid_private_key"]);
  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.key] = row.value;
  }
  return { public: map.vapid_public_key, private: map.vapid_private_key };
}

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: Record<string, unknown>,
  vapidPublic: string,
  vapidPrivate: string
): Promise<boolean> {
  try {
    const result = await webPush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: "mailto:lifeos@example.com",
          publicKey: vapidPublic,
          privateKey: vapidPrivate,
        },
      }
    );
    return result.statusCode === 200 || result.statusCode === 201;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const vapid = await getVapidKeys(supabase);
    if (!vapid.public || !vapid.private) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ error: "No active push subscriptions" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      title: "Life OS",
      body: "Life OS notifications are working ✓",
      tag: "lifeos-test",
      data: { url: "/", type: "test" },
    };

    const results = await Promise.all(
      subs.map(async (sub) => {
        const success = await sendPush(sub, payload, vapid.public, vapid.private);
        if (!success) {
          await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
        }
        return success;
      })
    );

    const sentCount = results.filter(Boolean).length;

    return new Response(JSON.stringify({ success: true, sent: sentCount, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
