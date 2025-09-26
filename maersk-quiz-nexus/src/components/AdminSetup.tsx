import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { seedDatabase } from "@/utils/seedDatabase";
import { createAdminUser } from "@/utils/createAdminUser";
import { Loader2, Database, CheckCircle, UserPlus } from "lucide-react";

const AdminSetup = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminCreated, setAdminCreated] = useState(false);
  const { toast } = useToast();

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
      setIsSeeded(true);
      toast({
        title: "Database Seeded",
        description: "Demo data has been successfully added to the database",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to seed database",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCreateAdmin = async () => {
    setIsCreatingAdmin(true);
    try {
      await createAdminUser();
      setAdminCreated(true);
      toast({
        title: "Admin User Created",
        description:
          "Admin user (admin@gmail.com / admin123) has been created",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create admin user",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-maersk-blue" />
          <span>Database Setup</span>
        </CardTitle>
        <CardDescription>
          Initialize the database with demo quizzes and sample data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set up the database with demo content and create admin user for
            testing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleCreateAdmin}
              disabled={isCreatingAdmin || adminCreated}
              className="btn-hero"
            >
              {isCreatingAdmin ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Admin...
                </>
              ) : adminCreated ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Admin Created
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Admin User
                </>
              )}
            </Button>

            <Button
              onClick={handleSeedDatabase}
              disabled={isSeeding || isSeeded}
              className="btn-hero"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Seeding Database...
                </>
              ) : isSeeded ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Database Seeded
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Seed Database
                </>
              )}
            </Button>
          </div>

          {adminCreated && (
            <p className="text-sm text-green-600">
              Admin user created!
            </p>
          )}

          {isSeeded && (
            <p className="text-sm text-green-600">
              Database has been successfully seeded with demo data!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminSetup;
