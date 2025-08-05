import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TestWelcomeEmail() {
  const [email, setEmail] = useState("sandro.alves.leao@gmail.com");
  const [isLoading, setIsLoading] = useState(false);

  const testWelcomeEmail = async () => {
    if (!email) {
      toast.error("Digite um email válido");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Testing welcome email for:", email);
      
      const { data, error } = await supabase.functions.invoke("test-welcome-email", {
        body: { email }
      });

      if (error) {
        console.error("Error testing welcome email:", error);
        toast.error(`Erro: ${error.message}`);
        return;
      }

      console.log("Welcome email test result:", data);
      toast.success("Email de teste enviado com sucesso!");
      
    } catch (err: any) {
      console.error("Error calling test function:", err);
      toast.error(`Erro ao testar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Testar Email de Boas-vindas</h3>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Digite o email para teste"
          className="flex-1"
        />
        <Button 
          onClick={testWelcomeEmail}
          disabled={isLoading}
        >
          {isLoading ? "Enviando..." : "Testar Email"}
        </Button>
      </div>
    </div>
  );
}