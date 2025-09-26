import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name?: string,
    role?: "user" | "admin"
  ) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // If profile doesn't exist, create it
        if (error.code === "PGRST116") {
          return await createProfile(userId);
        }
        return null;
      }
      // Reconcile role with latest auth metadata if needed
      const authUser = (await supabase.auth.getUser()).data.user;
      if (
        authUser?.user_metadata?.role &&
        data.role !== authUser.user_metadata.role
      ) {
        console.log(
          "Reconciling profile role (db=",
          data.role,
          " auth=",
          authUser.user_metadata.role,
          ")"
        );
        const { data: updated, error: updateError } = await supabase
          .from("profiles")
          .update({ role: authUser.user_metadata.role })
          .eq("user_id", userId)
          .select()
          .single();
        if (!updateError && updated) {
          return updated as Profile;
        }
      }
      return data as Profile;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  };

  const createProfile = async (userId: string) => {
    try {
      // Get user data from auth
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Create profile with role directly from user metadata or fallback to email check
      const userRole =
        user.user_metadata?.role ||
        (user.email?.includes("admin") ? "admin" : "user");

      console.log(
        "Creating profile with role:",
        userRole,
        "from metadata:",
        user.user_metadata
      );

      const { data, error } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          email: user.email || "",
          name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
          role: userRole,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating profile:", error);
        return null;
      }

      console.log("Profile created successfully with role:", data.role);
      return data as Profile;
    } catch (error) {
      console.error("Error creating profile:", error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch profile data
        setTimeout(async () => {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          setLoading(false);
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    name?: string,
    role?: "user" | "admin"
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const userRole = role || (email.includes("admin") ? "admin" : "user");
    console.log("Signing up with role:", userRole);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name || email,
          role: userRole,
        },
      },
    });
    // Best-effort immediate profile upsert (covers cases where metadata not read yet in listener)
    if (!error && data.user) {
      try {
        const { error: upsertError } = await supabase.from("profiles").upsert(
          {
            user_id: data.user.id,
            email,
            name: name || email.split("@")[0] || "User",
            role: userRole,
          },
          { onConflict: "user_id" }
        );
        if (upsertError) {
          console.warn("Profile upsert (signup) warning:", upsertError.message);
        } else {
          console.log("Profile upserted with role", userRole);
        }
      } catch (e) {
        console.warn("Profile upsert threw exception", e);
      }
    }
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
    return { error };
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
