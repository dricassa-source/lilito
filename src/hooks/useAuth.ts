import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "master" | "consultor";

export interface AuthUser {
  user: User;
  roles: Role[];
  isMaster: boolean;
  profile: { nome: string; email: string; ativo: boolean } | null;
}

export function useAuth() {
  const [state, setState] = useState<{ loading: boolean; auth: AuthUser | null }>({ loading: true, auth: null });

  useEffect(() => {
    let mounted = true;

    async function load(user: User | null) {
      if (!user) {
        if (mounted) setState({ loading: false, auth: null });
        return;
      }
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("nome,email,ativo").eq("id", user.id).maybeSingle(),
      ]);
      const r = (roles ?? []).map((x: { role: Role }) => x.role);
      if (mounted) {
        setState({
          loading: false,
          auth: { user, roles: r, isMaster: r.includes("master"), profile: profile ?? null },
        });
      }
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
