import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminRole, isNamedTrainerAdmin, isTrainerAdminEmail } from "@/lib/adminAccess";

export function useTrainerAdmin(userEmail: string | undefined | null, userId: string | undefined | null) {
  const [isTrainerAdmin, setIsTrainerAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!userId || !isTrainerAdminEmail(userEmail)) {
        setIsTrainerAdmin(false);
        setChecking(false);
        return;
      }

      if (isNamedTrainerAdmin(userEmail)) {
        setIsTrainerAdmin(true);
        setChecking(false);
        return;
      }

      setChecking(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1);
      setIsTrainerAdmin(!error && hasAdminRole(data));
      setChecking(false);
    };

    void check();
  }, [userEmail, userId]);

  return { isTrainerAdmin, checkingTrainerAdmin: checking };
}
