import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_status')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
    retry: 2,
  });
}

export function useAgentLogs(limit = 30) {
  return useQuery({
    queryKey: ['agent-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
    retry: 2,
  });
}
