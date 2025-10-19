import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Scale, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Index() {
  const [issue, setIssue] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!issue.trim()) {
      toast.error("Please describe your legal issue");
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke("legal-assist", {
        body: { issue },
      });

      if (error) {
        console.error("Function error:", error);
        toast.error("Failed to get legal guidance. Please try again.");
        return;
      }

      if (data?.advice) {
        setResponse(data.advice);
      } else {
        toast.error("No advice received. Please try again.");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIssue("");
    setResponse("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="w-full max-w-3xl space-y-6 animate-in fade-in duration-700">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-elegant mb-4">
            <Scale className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Legal Assist Jamaica
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Get instant guidance on your legal issues. Understand your rights and the right path forward.
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-2 shadow-elegant hover:shadow-glow transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-primary">Describe Your Legal Issue</CardTitle>
            <CardDescription className="text-base">
              Tell us what's happening, and we'll guide you on the right steps to take
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Textarea
              placeholder="For example: My landlord refuses to return my deposit after I moved out last month. I gave proper notice and left the apartment in good condition..."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="min-h-[160px] text-base resize-none border-2 focus:border-primary transition-colors"
              disabled={loading}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSubmit}
                disabled={loading || !issue.trim()}
                size="lg"
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Analyzing Your Issue...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Get Legal Guidance
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                size="lg"
                className="sm:w-32 border-2 hover:bg-secondary/50"
              >
                Reset
              </Button>
            </div>

            {response && (
              <div className="mt-6 p-6 bg-gradient-to-br from-secondary/50 to-secondary/30 border-2 border-primary/20 rounded-xl space-y-4 animate-in slide-in-from-bottom duration-500">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Scale className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold text-lg text-primary">Legal Guidance</h3>
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line leading-relaxed">
                      {response}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Important:</strong> Legal Assist provides general information and guidance based on Jamaican law. This is not a substitute for professional legal advice. For specific legal matters, please consult with a qualified attorney.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground space-y-2 pt-4">
          <p>Empowering Jamaicans with accessible legal information</p>
        </div>
      </div>
    </div>
  );
}
