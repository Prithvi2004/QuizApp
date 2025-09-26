import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  time_limit: number;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  created_at: string;
  is_published: boolean;
  created_by: string;
}

export interface QuizResult {
  id: string;
  quiz_id: string;
  user_id: string;
  answers: number[];
  score: number;
  total_questions: number;
  time_spent: number;
  completed_at: string;
}

export const useQuizData = () => {
  const { user, profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper to coerce a raw DB row into the strongly typed Quiz interface
  const sanitizeQuizRow = (row: any): Quiz => {
    const allowedDifficulties = ["Easy", "Medium", "Hard"] as const;
    const difficultyCandidate = row.difficulty || "Easy";
    const difficulty = (
      allowedDifficulties.includes(difficultyCandidate)
        ? difficultyCandidate
        : "Easy"
    ) as Quiz["difficulty"];

    return {
      id: row.id,
      title: row.title ?? "Untitled Quiz",
      description: row.description ?? "",
      questions: Array.isArray(row.questions)
        ? (row.questions as Question[])
        : [],
      time_limit: typeof row.time_limit === "number" ? row.time_limit : 0,
      difficulty,
      category: row.category ?? "General",
      created_at: row.created_at,
      is_published: !!row.is_published,
      created_by: row.created_by,
    };
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedQuizzes: Quiz[] = (data || []).map(sanitizeQuizRow);
      setQuizzes(formattedQuizzes);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllQuizzes = async () => {
    if (!user || profile?.role !== "admin") return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedQuizzes: Quiz[] = (data || []).map(sanitizeQuizRow);
      setQuizzes(formattedQuizzes);
    } catch (error) {
      console.error("Error fetching all quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserResults = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("quiz_results")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      setResults(
        (data || []).map((result) => ({
          ...result,
          answers: Array.isArray(result.answers)
            ? (result.answers as number[])
            : [],
        }))
      );
    } catch (error) {
      console.error("Error fetching results:", error);
    }
  };

  const createQuiz = async (
    quizData: Omit<Quiz, "id" | "created_at" | "created_by">
  ) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const { data, error } = await supabase
        .from("quizzes")
        .insert({
          ...quizData,
          created_by: user.id,
          questions: quizData.questions as any,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh quizzes if it's published
      if (data.is_published) {
        await fetchQuizzes();
      }

      return data;
    } catch (error) {
      console.error("Error creating quiz:", error);
      throw error;
    }
  };

  const updateQuiz = async (quizId: string, updates: Partial<Quiz>) => {
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .update(updates as any)
        .eq("id", quizId)
        .select()
        .single();

      if (error) throw error;

      // Refresh quizzes
      await fetchQuizzes();

      return data;
    } catch (error) {
      console.error("Error updating quiz:", error);
      throw error;
    }
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);

      if (error) throw error;

      // Refresh quizzes
      await fetchQuizzes();
    } catch (error) {
      console.error("Error deleting quiz:", error);
      throw error;
    }
  };

  const submitQuizResult = async (
    result: Omit<QuizResult, "id" | "completed_at">
  ) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const { data, error } = await supabase
        .from("quiz_results")
        .insert({
          ...result,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh user results
      await fetchUserResults();

      return data;
    } catch (error) {
      console.error("Error submitting quiz result:", error);
      throw error;
    }
  };

  const getQuizById = (quizId: string) => {
    return quizzes.find((quiz) => quiz.id === quizId);
  };

  const getUserResults = () => {
    return results;
  };

  // Initial fetch (published quizzes for users; admin panels typically call fetchAllQuizzes separately)
  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Real-time subscription for quizzes table
  useEffect(() => {
    // Only establish a single channel instance per hook instance
    const channel = supabase
      .channel("realtime-quizzes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quizzes" },
        (payload: any) => {
          setQuizzes((current) => {
            const next = [...current];
            const newRecord: Quiz | undefined = payload.new
              ? sanitizeQuizRow(payload.new)
              : undefined;
            const oldRecord: Quiz | undefined = payload.old
              ? sanitizeQuizRow(payload.old)
              : undefined;

            const isAdmin = profile?.role === "admin";

            switch (payload.eventType) {
              case "INSERT": {
                if (!newRecord) return next;
                // Users: only add if published; Admins: add all
                if (isAdmin || newRecord.is_published) {
                  // Avoid duplicates
                  if (!next.find((q) => q.id === newRecord.id)) {
                    next.unshift(newRecord); // newest first
                  }
                }
                return next;
              }
              case "UPDATE": {
                if (!newRecord) return next;
                const idx = next.findIndex((q) => q.id === newRecord.id);
                const wasInList = idx !== -1;
                if (isAdmin) {
                  // Always reflect latest for admin
                  if (wasInList) {
                    next[idx] = newRecord;
                  } else {
                    next.unshift(newRecord);
                  }
                } else {
                  // User view: maintain only published quizzes
                  if (newRecord.is_published) {
                    if (wasInList) {
                      next[idx] = newRecord;
                    } else {
                      next.unshift(newRecord);
                    }
                  } else if (wasInList) {
                    // Became unpublished; remove for users
                    next.splice(idx, 1);
                  }
                }
                return next;
              }
              case "DELETE": {
                if (!oldRecord) return next;
                const idx = next.findIndex((q) => q.id === oldRecord.id);
                if (idx !== -1) {
                  next.splice(idx, 1);
                }
                return next;
              }
              default:
                return next;
            }
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Optionally re-fetch to reconcile (esp. when switching roles mid-session)
          if (profile?.role === "admin") {
            fetchAllQuizzes();
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.role]);

  useEffect(() => {
    if (user) {
      fetchUserResults();
    }
  }, [user]);

  return {
    quizzes,
    results,
    loading,
    fetchQuizzes,
    fetchAllQuizzes,
    fetchUserResults,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    submitQuizResult,
    getQuizById,
    getUserResults,
  };
};
