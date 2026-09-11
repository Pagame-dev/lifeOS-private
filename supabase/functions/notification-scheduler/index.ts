import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webPush from "npm:web-push@3.6.7";

// Notification scheduler — called by pg_cron every minute.
// Processes pending notification_jobs and sends Web Push to all active device subscriptions.

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

function isQuietHours(quietStart: string, quietEnd: string, now: Date): boolean {
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const [qsH, qsM] = quietStart.split(":").map(Number);
  const [qeH, qeM] = quietEnd.split(":").map(Number);
  const quietStartMin = qsH * 60 + qsM;
  const quietEndMin = qeH * 60 + qeM;

  if (quietStartMin <= quietEndMin) {
    return currentMin >= quietStartMin && currentMin < quietEndMin;
  }
  return currentMin >= quietStartMin || currentMin < quietEndMin;
}

function isCategoryEnabled(category: string, prefs: Record<string, unknown>): boolean {
  const categoryMap: Record<string, string> = {
    event: "events_enabled",
    homework: "homework_enabled",
    test: "tests_enabled",
    routine: "routines_enabled",
    workout: "workout_enabled",
    briefing: "daily_briefing_enabled",
    bedtime: "bedtime_preview_enabled",
    ai: "ai_intervention_enabled",
  };
  const prefKey = categoryMap[category];
  if (!prefKey) return true;
  return prefs[prefKey] !== false;
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

    const vapid = await getVapidKeys(supabase);
    if (!vapid.public || !vapid.private) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const { data: jobs, error: jobsError } = await supabase
      .from("notification_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let cancelled = 0;

    for (const job of jobs) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", job.user_id)
        .maybeSingle();

      const userPrefs = (prefs as Record<string, unknown>) || {};

      if (userPrefs.notifications_master_enabled === false) {
        await supabase.from("notification_jobs").update({ status: "cancelled", updated_at: now }).eq("id", job.id);
        cancelled++;
        continue;
      }

      if (userPrefs.quiet_hours_enabled === true && userPrefs.quiet_hours_start && userPrefs.quiet_hours_end) {
        if (isQuietHours(userPrefs.quiet_hours_start as string, userPrefs.quiet_hours_end as string, new Date())) {
          continue;
        }
      }

      if (!isCategoryEnabled(job.category, userPrefs)) {
        await supabase.from("notification_jobs").update({ status: "cancelled", updated_at: now }).eq("id", job.id);
        cancelled++;
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", job.user_id)
        .eq("is_active", true);

      if (!subs || subs.length === 0) {
        await supabase.from("notification_jobs").update({ status: "sent", sent_at: now, updated_at: now }).eq("id", job.id);
        continue;
      }

      const payload = {
        title: job.title,
        body: job.body,
        tag: job.dedup_key || job.id,
        data: {
          url: job.deep_link || "/",
          type: job.notification_type,
          category: job.category,
          entityId: job.related_entity_id,
          entityType: job.related_entity_type,
        },
        vibrate: [50, 30, 50],
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

      const anySent = results.some(Boolean);
      await supabase.from("notification_jobs").update({
        status: anySent ? "sent" : "failed",
        sent_at: now,
        updated_at: now,
      }).eq("id", job.id);

      if (anySent) {
        sent++;

        // Insert into in-app notification feed
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", job.user_id)
          .eq("title", job.title)
          .eq("message", job.body)
          .gte("created_at", new Date(Date.now() - 3600000).toISOString())
          .maybeSingle();

        if (!existingNotif) {
          await supabase.from("notifications").insert({
            user_id: job.user_id,
            type: job.notification_type,
            title: job.title,
            message: job.body,
            related_entity_type: job.related_entity_type,
            related_entity_id: job.related_entity_id,
            is_read: false,
            is_acted_upon: false,
            scheduled_for: job.scheduled_for,
          });
        }
      }
    }

    return new Response(JSON.stringify({ processed: jobs.length, sent, cancelled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
