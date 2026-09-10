import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user's token to check admin role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") throw new Error("Unauthorized: admin only");

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action, ...body } = await req.json();

    if (action === "create") {
      const { email, password, role } = body;
      if (!email || !password) throw new Error("Email and password required");

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      // Update role if not default user
      if (role === "admin" && newUser.user) {
        await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", newUser.user.id);
      }

      return new Response(JSON.stringify({ user: newUser.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) throw new Error("userId required");
      if (userId === user.id) throw new Error("Cannot delete yourself");

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_blocked") {
      const { userId, blocked } = body;
      if (!userId) throw new Error("userId required");
      if (userId === user.id) throw new Error("Cannot block yourself");

      // Update blocked flag
      const { error: updErr } = await adminClient
        .from("user_roles")
        .update({ blocked: !!blocked })
        .eq("user_id", userId);
      if (updErr) throw updErr;

      // If blocking, sign the user out of all sessions immediately
      if (blocked) {
        await adminClient.auth.admin.signOut(userId, "global").catch(() => {});
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers();
      if (error) throw error;

      return new Response(JSON.stringify({ users: users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
