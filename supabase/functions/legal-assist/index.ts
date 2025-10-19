import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { issue } = await req.json();
    console.log("Processing legal issue:", issue);

    if (!issue || issue.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide a legal issue description" }),
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
    const systemPrompt = `You are a helpful legal assistant for Jamaica. Your role is to:
1. Analyze the user's legal issue
2. Identify what type of legal matter it is (e.g., employment, landlord-tenant, family law, consumer rights, personal injury, etc.)
3. Provide practical, actionable steps they can take
4. Recommend the appropriate Jamaican government agency or legal resource
5. Suggest a search query for finding relevant legal professionals (e.g., "personal injury lawyer Jamaica", "family law attorney Jamaica")

Be empathetic, clear, and concise. Use numbered steps and emojis for clarity.
Always include:
- The type of legal issue
- 3-5 actionable steps
- Relevant Jamaican agency/resource with contact info when possible
- A reminder that this is general guidance, not legal advice
- At the end, add a line: "SEARCH_QUERY: [your suggested search term]" (e.g., "SEARCH_QUERY: personal injury lawyer Jamaica")

Keep responses under 300 words.`;

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

    console.log("Search query for businesses:", searchQuery);

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
