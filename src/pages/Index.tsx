import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Scale, AlertCircle, Star, Phone, Globe, MapPin, ExternalLink, MessageSquare, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const issueSchema = z.string()
  .trim()
  .min(10, "Please provide more details (at least 10 characters)")
  .max(2000, "Please keep your issue under 2000 characters");

interface Recommendation {
  name: string;
  formatted_address: string;
  rating: number;
  user_ratings_total: number;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now: boolean;
  };
  place_id: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: Recommendation[];
  created_at: string;
}

const JAMAICAN_PARISHES = [
  "Kingston",
  "St. Andrew",
  "St. Catherine",
  "Clarendon",
  "Manchester",
  "St. Elizabeth",
  "Westmoreland",
  "Hanover",
  "St. James",
  "Trelawny",
  "St. Ann",
  "St. Mary",
  "Portland",
  "St. Thomas"
];

export default function Index() {
  const [issue, setIssue] = useState("");
  const [location, setLocation] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const navigate = useNavigate();

  // Get user email and load conversation
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversation');
    
    if (convId) {
      loadConversation(convId);
    }
  }, []);

  const loadConversation = async (convId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (messagesData) {
        setMessages(messagesData.map(msg => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          recommendations: msg.recommendations ? JSON.parse(JSON.stringify(msg.recommendations)) as Recommendation[] : undefined,
          created_at: msg.created_at
        })));
        setConversationId(convId);
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
      toast.error("Failed to load conversation");
    }
  };

  const handleSubmit = async () => {
    // Validate input
    const validationResult = issueSchema.safeParse(issue);
    if (!validationResult.success) {
      toast.error(validationResult.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Authentication required");
        navigate("/auth");
        return;
      }

      // Create new conversation if needed
      let currentConvId = conversationId;
      if (!currentConvId) {
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            title: issue.substring(0, 100),
            location: location || null
          })
          .select()
          .single();

        if (convError) throw convError;
        currentConvId = convData.id;
        setConversationId(currentConvId);
        
        // Update URL
        window.history.pushState({}, '', `?conversation=${currentConvId}`);
      }

      // Save user message
      const { data: userMsgData, error: userMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConvId,
          role: 'user',
          content: issue
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Add user message to UI
      const userMessage: Message = {
        id: userMsgData.id,
        role: 'user',
        content: issue,
        created_at: userMsgData.created_at
      };
      setMessages(prev => [...prev, userMessage]);
      setIssue("");

      // Prepare conversation history for AI
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call edge function
      const { data, error } = await supabase.functions.invoke("legal-assist", {
        body: { 
          issue,
          conversationHistory,
          location: location || undefined
        },
      });

      if (error) {
        console.error("Function error:", error);
        toast.error("Failed to get legal guidance. Please try again.");
        return;
      }

      if (data?.advice) {
        // Save assistant message
        const { data: assistantMsgData, error: assistantMsgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: currentConvId,
            role: 'assistant',
            content: data.advice,
            recommendations: data.recommendations || null
          })
          .select()
          .single();

        if (assistantMsgError) throw assistantMsgError;

        // Add assistant message to UI
        const assistantMessage: Message = {
          id: assistantMsgData.id,
          role: 'assistant',
          content: data.advice,
          recommendations: data.recommendations,
          created_at: assistantMsgData.created_at
        };
        setMessages(prev => [...prev, assistantMessage]);
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

  const handleNewConversation = () => {
    setIssue("");
    setMessages([]);
    setConversationId(null);
    setLocation("");
    window.history.pushState({}, '', '/');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-6 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="w-full max-w-3xl space-y-6 animate-in fade-in duration-700">
        {/* Header with User Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{userEmail}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-2"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
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

        {/* Conversation History */}
        {messages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Conversation
              </h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleNewConversation}
                className="border-2"
              >
                New Conversation
              </Button>
            </div>

            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="animate-in slide-in-from-bottom duration-300">
                  {msg.role === 'user' ? (
                    <div className="bg-secondary/50 border-2 border-primary/20 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-muted-foreground mb-1">You asked:</p>
                          <p className="text-foreground whitespace-pre-line">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-6 bg-gradient-to-br from-secondary/50 to-secondary/30 border-2 border-primary/20 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                            <Scale className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <h3 className="font-semibold text-lg text-primary">Legal Guidance</h3>
                            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recommended Professionals */}
                      {msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                            <Star className="w-5 h-5" />
                            Recommended Legal Professionals
                          </h3>
                          <div className="grid gap-4">
                            {msg.recommendations.map((rec, index) => (
                              <Card key={rec.place_id} className="border-2 hover:border-primary/30 transition-colors">
                                <CardContent className="p-5 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-lg text-foreground">{rec.name}</h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex items-center gap-1">
                                          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                          <span className="font-medium text-foreground">{rec.rating}</span>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                          ({rec.user_ratings_total} reviews)
                                        </span>
                                        {rec.opening_hours?.open_now && (
                                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                            Open now
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-primary/20">
                                      #{index + 1}
                                    </div>
                                  </div>

                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2 text-muted-foreground">
                                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                      <span>{rec.formatted_address}</span>
                                    </div>

                                    {rec.formatted_phone_number && (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="w-4 h-4 flex-shrink-0" />
                                        <a 
                                          href={`tel:${rec.formatted_phone_number}`}
                                          className="hover:text-primary transition-colors"
                                        >
                                          {rec.formatted_phone_number}
                                        </a>
                                      </div>
                                    )}

                                    {rec.website && (
                                      <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                        <a
                                          href={rec.website}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline flex items-center gap-1"
                                        >
                                          Visit Website
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Card */}
        <Card className="border-2 shadow-elegant hover:shadow-glow transition-all duration-300 sticky bottom-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-primary">
              {messages.length > 0 ? "Ask a Follow-up Question" : "Describe Your Legal Issue"}
            </CardTitle>
            <CardDescription className="text-base">
              {messages.length > 0 
                ? "Continue the conversation with more questions about your legal matter"
                : "Tell us what's happening, and we'll guide you on the right steps to take"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location Selector */}
            {!conversationId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Location (Optional)
                </label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Select your parish..." />
                  </SelectTrigger>
                  <SelectContent>
                    {JAMAICAN_PARISHES.map((parish) => (
                      <SelectItem key={parish} value={parish}>
                        {parish}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecting a location helps us find legal professionals near you
                </p>
              </div>
            )}

            <Textarea
              placeholder={messages.length > 0 
                ? "Ask your follow-up question here..."
                : "For example: My landlord refuses to return my deposit after I moved out last month. I gave proper notice and left the apartment in good condition..."
              }
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="min-h-[120px] text-base resize-none border-2 focus:border-primary transition-colors"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !loading && issue.trim()) {
                  handleSubmit();
                }
              }}
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
                    {messages.length > 0 ? "Getting Answer..." : "Analyzing Your Issue..."}
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    {messages.length > 0 ? "Send Question" : "Get Legal Guidance"}
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Press Ctrl+Enter (or Cmd+Enter on Mac) to submit
            </p>

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
        <div className="text-center text-sm text-muted-foreground space-y-2 pb-8">
          <p>Empowering Jamaicans with accessible legal information</p>
        </div>
      </div>
    </div>
  );
}