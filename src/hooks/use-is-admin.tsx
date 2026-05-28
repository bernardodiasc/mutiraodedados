import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./use-auth";
import { getAdminStatus } from "@/lib/admin.functions";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const checkAdmin = useServerFn(getAdminStatus);

  React.useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    checkAdmin()
      .then(({ isAdmin }) => {
        if (!cancelled) {
          setIsAdmin(isAdmin);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}