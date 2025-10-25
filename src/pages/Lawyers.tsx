import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface LawType {
  id: string;
  name: string;
  description: string;
}

interface Lawyer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  years_experience: number | null;
  specialties: LawType[];
}

const Lawyers = () => {
  const navigate = useNavigate();
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [lawTypes, setLawTypes] = useState<LawType[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch law types
      const { data: typesData, error: typesError } = await supabase
        .from("law_types")
        .select("*")
        .order("name");

      if (typesError) throw typesError;
      setLawTypes(typesData || []);

      // Fetch lawyers with their specialties
      const { data: lawyersData, error: lawyersError } = await supabase
        .from("lawyers")
        .select(`
          *,
          lawyer_specialties (
            law_types (*)
          )
        `)
        .order("name");

      if (lawyersError) throw lawyersError;

      // Transform data to include specialties
      const transformedLawyers = lawyersData?.map((lawyer: any) => ({
        ...lawyer,
        specialties: lawyer.lawyer_specialties?.map((ls: any) => ls.law_types) || [],
      })) || [];

      setLawyers(transformedLawyers);
    } catch (error) {
      console.error("Error fetching lawyers:", error);
      toast.error("Failed to load lawyers directory");
    } finally {
      setLoading(false);
    }
  };

  const filteredLawyers = selectedType
    ? lawyers.filter((lawyer) =>
        lawyer.specialties.some((specialty) => specialty.id === selectedType)
      )
    : lawyers;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-12 w-96 mb-2" />
          <Skeleton className="h-6 w-64 mb-8" />
          
          <div className="mb-8">
            <Skeleton className="h-6 w-48 mb-3" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-32" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Legal Assistant
          </Button>
          <h1 className="text-4xl font-bold mb-2">Lawyers Directory</h1>
          <p className="text-muted-foreground">
            Find experienced attorneys by their area of practice
          </p>
        </div>

        {/* Law Type Filters */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Filter by Practice Area</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === null ? "default" : "outline"}
              onClick={() => setSelectedType(null)}
              size="sm"
            >
              All Lawyers
            </Button>
            {lawTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedType === type.id ? "default" : "outline"}
                onClick={() => setSelectedType(type.id)}
                size="sm"
              >
                {type.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Lawyers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLawyers.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                <Mail className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No lawyers found</h3>
              <p className="text-muted-foreground mb-4">
                {selectedType 
                  ? "No lawyers found for this practice area. Try selecting a different category."
                  : "No lawyers available in the directory yet."}
              </p>
              {selectedType && (
                <Button variant="outline" onClick={() => setSelectedType(null)}>
                  View All Lawyers
                </Button>
              )}
            </div>
          ) : (
            filteredLawyers.map((lawyer) => (
              <Card key={lawyer.id}>
                <CardHeader>
                  <CardTitle>{lawyer.name}</CardTitle>
                  <CardDescription>
                    {lawyer.years_experience
                      ? `${lawyer.years_experience} years of experience`
                      : "Experienced attorney"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lawyer.bio && (
                    <p className="text-sm text-muted-foreground">{lawyer.bio}</p>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Practice Areas:</h3>
                    <div className="flex flex-wrap gap-1">
                      {lawyer.specialties.map((specialty) => (
                        <Badge key={specialty.id} variant="secondary">
                          {specialty.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <a
                      href={`mailto:${lawyer.email}`}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      {lawyer.email}
                    </a>
                    {lawyer.phone && (
                      <a
                        href={`tel:${lawyer.phone}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        {lawyer.phone}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Lawyers;
