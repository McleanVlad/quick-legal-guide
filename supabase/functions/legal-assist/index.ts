import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GooglePlaceResult {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication (JWT is verified automatically by Supabase when verify_jwt = true)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please log in" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user ID from JWT token
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Decode JWT to get user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check rate limiting - allow 10 requests per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('api_rate_limits')
      .select('request_count, window_start')
      .eq('user_id', userId)
      .eq('endpoint', 'legal-assist')
      .gte('window_start', oneHourAgo)
      .single();

    if (!rateLimitError && rateLimitData) {
      if (rateLimitData.request_count >= 10) {
        console.log(`Rate limit exceeded for user ${userId}`);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in an hour. Maximum 10 requests per hour allowed." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Increment request count
      await supabase
        .from('api_rate_limits')
        .update({ request_count: rateLimitData.request_count + 1 })
        .eq('user_id', userId)
        .eq('endpoint', 'legal-assist')
        .gte('window_start', oneHourAgo);
    } else {
      // Create new rate limit record
      await supabase
        .from('api_rate_limits')
        .insert({
          user_id: userId,
          endpoint: 'legal-assist',
          request_count: 1,
          window_start: new Date().toISOString()
        });
    }

    const { issue, conversationHistory = [], location } = await req.json();
    // Sanitized logging - only log metadata, not sensitive content
    console.log(`Processing legal issue - length: ${issue.length}, has location: ${!!location}, user: ${userId}`);

    // Validate input length
    if (!issue || issue.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide a legal issue description" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (issue.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Issue description too long. Please keep it under 2000 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conversationHistory.length > 20) {
      return new Response(
        JSON.stringify({ error: "Conversation history too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get legal advice and determine search query
    const systemPrompt = `You're a friendly legal assistant helping people in Jamaica navigate their legal concerns. Think of yourself as a knowledgeable friend who genuinely cares and wants to help.

When someone shares their legal issue with you:
- Start by acknowledging their situation with empathy - let them know you understand this might be stressful
- Chat naturally about what type of legal matter this sounds like (employment issues, landlord troubles, family matters, etc.)
- Share practical steps they can take, but in a conversational way - like you're talking to a friend over coffee
- Point them toward helpful Jamaican government agencies or resources, with contact details if you know them
- Remind them gently that while you're here to guide them, this is general information and not formal legal advice
- If this is a follow-up question in an ongoing conversation, refer back to what was discussed earlier and build on that context

Keep your tone warm and supportive. Use everyday language instead of legal jargon when possible. You can use emojis naturally if they fit the conversation, but don't force them.

At the very end of your response, on a new line, add: "SEARCH_QUERY: [appropriate search term]"${location ? ` - make sure to include "${location}" in the search query` : ''} - for example "SEARCH_QUERY: employment lawyer Kingston Jamaica" or "SEARCH_QUERY: family law attorney Jamaica". This helps find the right legal professionals.

Aim for around 250 words - enough to be helpful without overwhelming them.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: issue },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let advice = data.choices?.[0]?.message?.content;

    if (!advice) {
      console.error("No advice in response:", data);
      return new Response(
        JSON.stringify({ error: "No advice received from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Extract search query and clean advice
    let searchQuery = "lawyer Jamaica";
    const searchMatch = advice.match(/SEARCH_QUERY:\s*(.+?)(?:\n|$)/i);
    if (searchMatch) {
      searchQuery = searchMatch[1].trim();
      advice = advice.replace(/SEARCH_QUERY:.+/i, "").trim();
    }

    // Sanitized logging - only log length, not the actual query
    console.log(`Generated search query - length: ${searchQuery.length}`);

    // Step 3: Search Google Places for legal professionals
    let recommendations: GooglePlaceResult[] = [];
    
    if (GOOGLE_PLACES_API_KEY) {
      try {
        // First, search for places
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_PLACES_API_KEY}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.status === "OK" && searchData.results) {
          // Get details for top 3 results
          const topPlaces = searchData.results.slice(0, 3);
          
          for (const place of topPlaces) {
            try {
              const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours&key=${GOOGLE_PLACES_API_KEY}`;
              const detailsResponse = await fetch(detailsUrl);
              const detailsData = await detailsResponse.json();
              
              if (detailsData.status === "OK" && detailsData.result) {
                recommendations.push(detailsData.result);
              }
            } catch (err) {
              console.error("Error fetching place details:", err);
            }
          }
        } else {
          console.log("Google Places search returned:", searchData.status);
        }
      } catch (err) {
        console.error("Error searching Google Places:", err);
        // Continue without recommendations if Places API fails
      }
    }

    console.log(`Successfully generated legal advice with ${recommendations.length} recommendations`);
    return new Response(
      JSON.stringify({ 
        advice,
        recommendations: recommendations.length > 0 ? recommendations : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in legal-assist function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
