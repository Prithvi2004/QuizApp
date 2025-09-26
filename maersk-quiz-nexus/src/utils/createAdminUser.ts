import { supabase } from "@/integrations/supabase/client";

export const createAdminUser = async () => {
  try {
    // First, sign up the admin user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: "admin@gmail.com",
      password: "admin123",
      options: {
        data: {
          name: "Admin User",
          role: "admin", // Explicitly set role in user metadata
        },
      },
    });

    if (authError) {
      console.error("Error creating admin user:", authError);
      return { error: authError };
    }

    if (authData.user) {
      // Create admin profile
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: authData.user.id,
        email: "admin@gmail.com",
        name: "Admin User",
        role: "admin",
      });

      if (profileError) {
        console.error("Error creating admin profile:", profileError);
        return { error: profileError };
      }

      console.log("Admin user created successfully!");
      return { success: true };
    }

    return { error: new Error("User creation failed") };
  } catch (error) {
    console.error("Error creating admin user:", error);
    return { error };
  }
};
