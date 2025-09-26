import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuizData, Quiz, Question } from "@/hooks/useQuizData";
import { useToast } from "@/hooks/use-toast";
import AdminSetup from "@/components/AdminSetup";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  Settings,
  Users,
  BarChart3,
  BookOpen,
  Clock,
  Target,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const AdminPanel = () => {
  const {
    quizzes,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    results,
    fetchAllQuizzes,
  } = useQuizData();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editingQuizData, setEditingQuizData] = useState<{
    title: string;
    description: string;
    difficulty: "Easy" | "Medium" | "Hard";
    category: string;
    timeLimit: number; // seconds
    isPublished: boolean;
    questions: Question[]; // keep ids
  } | null>(null);

  // When a quiz is selected for editing, populate local editable state
  useEffect(() => {
    if (editingQuiz) {
      setEditingQuizData({
        title: editingQuiz.title,
        description: editingQuiz.description,
        difficulty: editingQuiz.difficulty,
        category: editingQuiz.category,
        timeLimit: editingQuiz.time_limit,
        isPublished: editingQuiz.is_published,
        questions: editingQuiz.questions.map((q) => ({ ...q })),
      });
    } else {
      setEditingQuizData(null);
    }
  }, [editingQuiz]);
  const [newQuiz, setNewQuiz] = useState({
    title: "",
    description: "",
    difficulty: "Medium" as "Easy" | "Medium" | "Hard",
    category: "",
    timeLimit: 300,
    isPublished: false,
    questions: [] as Omit<Question, "id">[],
  });

  const [newQuestion, setNewQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });

  const handleCreateQuiz = async () => {
    if (!newQuiz.title || !newQuiz.description || !newQuiz.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (newQuiz.questions.length === 0) {
      toast({
        title: "No Questions",
        description: "Please add at least one question to the quiz",
        variant: "destructive",
      });
      return;
    }

    const questionsWithIds = newQuiz.questions.map((q, index) => ({
      ...q,
      id: (Date.now() + index).toString(),
    }));

    try {
      await createQuiz({
        title: newQuiz.title,
        description: newQuiz.description,
        category: newQuiz.category,
        difficulty: newQuiz.difficulty,
        time_limit: newQuiz.timeLimit,
        is_published: newQuiz.isPublished,
        questions: questionsWithIds,
      });

      toast({
        title: "Quiz Created",
        description: `${newQuiz.title} has been created successfully`,
      });

      // Reset form
      setNewQuiz({
        title: "",
        description: "",
        difficulty: "Medium",
        category: "",
        timeLimit: 300,
        isPublished: false,
        questions: [],
      });
      setIsCreateModalOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quiz",
        variant: "destructive",
      });
    }
  };

  const addQuestion = () => {
    if (
      !newQuestion.question ||
      newQuestion.options.some((opt) => !opt.trim())
    ) {
      toast({
        title: "Incomplete Question",
        description: "Please fill in the question and all options",
        variant: "destructive",
      });
      return;
    }

    setNewQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, { ...newQuestion }],
    }));

    setNewQuestion({
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    });

    toast({
      title: "Question Added",
      description: "Question has been added to the quiz",
    });
  };

  // Editing helpers
  const addEditingQuestion = () => {
    if (!editingQuizData) return;
    setEditingQuizData((prev) =>
      prev
        ? {
            ...prev,
            questions: [
              ...prev.questions,
              {
                id: (Date.now() + prev.questions.length).toString(),
                question: "",
                options: ["", "", "", ""],
                correctAnswer: 0,
              },
            ],
          }
        : prev
    );
  };

  const updateEditingQuestionField = (
    index: number,
    field: keyof Question,
    value: any
  ) => {
    setEditingQuizData((prev) => {
      if (!prev) return prev;
      const questions = [...prev.questions];
      const target = { ...questions[index] };
      (target as any)[field] = value;
      questions[index] = target;
      return { ...prev, questions };
    });
  };

  const updateEditingOption = (
    qIndex: number,
    optIndex: number,
    value: string
  ) => {
    setEditingQuizData((prev) => {
      if (!prev) return prev;
      const questions = [...prev.questions];
      const target = { ...questions[qIndex] };
      const opts = [...target.options];
      opts[optIndex] = value;
      target.options = opts;
      questions[qIndex] = target;
      return { ...prev, questions };
    });
  };

  const removeEditingQuestion = (index: number) => {
    setEditingQuizData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.filter((_, i) => i !== index),
      };
    });
  };

  const handleUpdateQuiz = async () => {
    if (!editingQuiz || !editingQuizData) return;
    if (
      !editingQuizData.title ||
      !editingQuizData.description ||
      !editingQuizData.category
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    if (editingQuizData.questions.length === 0) {
      toast({
        title: "No Questions",
        description: "Add at least one question",
        variant: "destructive",
      });
      return;
    }
    // Basic validation for each question
    for (const q of editingQuizData.questions) {
      if (!q.question.trim() || q.options.some((o) => !o.trim())) {
        toast({
          title: "Incomplete Question",
          description: "All questions and options must be filled",
          variant: "destructive",
        });
        return;
      }
    }
    try {
      await updateQuiz(editingQuiz.id, {
        title: editingQuizData.title,
        description: editingQuizData.description,
        difficulty: editingQuizData.difficulty,
        category: editingQuizData.category,
        time_limit: editingQuizData.timeLimit,
        is_published: editingQuizData.isPublished,
        questions: editingQuizData.questions as any,
      });
      toast({
        title: "Quiz Updated",
        description: `${editingQuizData.title} saved successfully`,
      });
      setEditingQuiz(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quiz",
        variant: "destructive",
      });
    }
  };

  const removeQuestion = (index: number) => {
    setNewQuiz((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handlePublishToggle = async (quizId: string) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    try {
      await updateQuiz(quizId, { is_published: !quiz.is_published });
      toast({
        title: quiz.is_published ? "Quiz Unpublished" : "Quiz Published",
        description: quiz.is_published
          ? "Quiz is now hidden from users"
          : "Quiz is now available to users",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quiz status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    try {
      await deleteQuiz(quizId);
      toast({
        title: "Quiz Deleted",
        description: `${quiz.title} has been deleted`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete quiz",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  const getQuizStats = (quizId: string) => {
    const quizResults = results.filter((result) => result.quiz_id === quizId);
    const averageScore =
      quizResults.length > 0
        ? quizResults.reduce(
            (acc, result) =>
              acc + (result.score / result.total_questions) * 100,
            0
          ) / quizResults.length
        : 0;

    return {
      attempts: quizResults.length,
      averageScore: Math.round(averageScore),
    };
  };

  const totalQuizzes = quizzes.length;
  const publishedQuizzes = quizzes.filter((q) => q.is_published).length;
  const totalAttempts = results.length;
  const averageScore =
    results.length > 0
      ? Math.round(
          results.reduce(
            (acc, result) =>
              acc + (result.score / result.total_questions) * 100,
            0
          ) / results.length
        )
      : 0;

  useEffect(() => {
    fetchAllQuizzes();
  }, []);

  return (
    <div className="min-h-screen px-3 sm:px-4 pb-16 sm:pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold gradient-text mb-2 leading-tight">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Manage quizzes, monitor performance, and control platform
                settings
              </p>
            </div>

            <Dialog
              open={isCreateModalOpen}
              onOpenChange={setIsCreateModalOpen}
            >
              <DialogTrigger asChild>
                <Button className="btn-hero">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto glass p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl gradient-text">
                    Create New Quiz
                  </DialogTitle>
                  <DialogDescription>
                    Build a comprehensive quiz with multiple questions and
                    customizable settings
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Quiz Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Quiz Title</Label>
                      <Input
                        id="title"
                        value={newQuiz.title}
                        onChange={(e) =>
                          setNewQuiz((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Enter quiz title"
                        className="glass"
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={newQuiz.category}
                        onChange={(e) =>
                          setNewQuiz((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        placeholder="e.g., Maritime, Logistics"
                        className="glass"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newQuiz.description}
                      onChange={(e) =>
                        setNewQuiz((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe what this quiz covers"
                      className="glass"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Select
                        value={newQuiz.difficulty}
                        onValueChange={(value: "Easy" | "Medium" | "Hard") =>
                          setNewQuiz((prev) => ({ ...prev, difficulty: value }))
                        }
                      >
                        <SelectTrigger className="glass">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                      <Input
                        id="timeLimit"
                        type="number"
                        value={newQuiz.timeLimit / 60}
                        onChange={(e) =>
                          setNewQuiz((prev) => ({
                            ...prev,
                            timeLimit: parseInt(e.target.value) * 60,
                          }))
                        }
                        min="1"
                        max="120"
                        className="glass"
                      />
                    </div>
                  </div>

                  {/* Questions Section */}
                  <div className="border-t pt-6">
                    <h3 className="font-heading text-xl font-bold mb-4">
                      Questions
                    </h3>

                    {/* Add Question Form */}
                    <Card className="glass-card mb-4">
                      <CardHeader>
                        <CardTitle className="text-lg">Add Question</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="question">Question</Label>
                          <Textarea
                            id="question"
                            value={newQuestion.question}
                            onChange={(e) =>
                              setNewQuestion((prev) => ({
                                ...prev,
                                question: e.target.value,
                              }))
                            }
                            placeholder="Enter your question here"
                            className="glass"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Answer Options</Label>
                          {newQuestion.options.map((option, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-2"
                            >
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name="correctAnswer"
                                  checked={newQuestion.correctAnswer === index}
                                  onChange={() =>
                                    setNewQuestion((prev) => ({
                                      ...prev,
                                      correctAnswer: index,
                                    }))
                                  }
                                  className="text-maersk-blue"
                                />
                                <Label className="text-sm">
                                  {String.fromCharCode(65 + index)}
                                </Label>
                              </div>
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...newQuestion.options];
                                  newOptions[index] = e.target.value;
                                  setNewQuestion((prev) => ({
                                    ...prev,
                                    options: newOptions,
                                  }));
                                }}
                                placeholder={`Option ${String.fromCharCode(
                                  65 + index
                                )}`}
                                className="glass"
                              />
                            </div>
                          ))}
                        </div>

                        <Button onClick={addQuestion} className="btn-hero">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Question
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Questions List */}
                    {newQuiz.questions.length > 0 && (
                      <div className="space-y-2">
                        <Label>
                          Added Questions ({newQuiz.questions.length})
                        </Label>
                        {newQuiz.questions.map((question, index) => (
                          <Card key={index} className="glass-card">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-foreground mb-2">
                                    {index + 1}. {question.question}
                                  </h4>
                                  <div className="text-sm text-muted-foreground">
                                    Correct:{" "}
                                    {String.fromCharCode(
                                      65 + question.correctAnswer
                                    )}{" "}
                                    - {question.options[question.correctAnswer]}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeQuestion(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-end gap-4 sm:space-x-4 border-t pt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="btn-glass"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateQuiz} className="btn-hero">
                      <Save className="h-4 w-4 mr-2" />
                      Create Quiz
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Quizzes
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalQuizzes}
                  </p>
                </div>
                <div className="p-3 bg-maersk-gradient rounded-xl">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Published
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {publishedQuizzes}
                  </p>
                </div>
                <div className="p-3 bg-green-500 rounded-xl">
                  <Eye className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Attempts
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalAttempts}
                  </p>
                </div>
                <div className="p-3 bg-blue-500 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Avg. Score
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {averageScore}%
                  </p>
                </div>
                <div className="p-3 bg-purple-500 rounded-xl">
                  <Target className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Database Setup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <AdminSetup />
        </motion.div>

        {/* Quiz Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-maersk-blue" />
                <span>Quiz Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quizzes.map((quiz) => {
                  const stats = getQuizStats(quiz.id);

                  return (
                    <div
                      key={quiz.id}
                      className="p-6 bg-background/50 rounded-xl"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-heading text-lg font-bold text-foreground">
                              {quiz.title}
                            </h3>
                            <Badge
                              className={
                                quiz.difficulty === "Easy"
                                  ? "bg-green-500/20 text-green-700 border-green-500/30"
                                  : quiz.difficulty === "Medium"
                                  ? "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"
                                  : "bg-red-500/20 text-red-700 border-red-500/30"
                              }
                            >
                              {quiz.difficulty}
                            </Badge>
                            <Badge
                              variant={
                                quiz.is_published ? "default" : "secondary"
                              }
                            >
                              {quiz.is_published ? "Published" : "Draft"}
                            </Badge>
                          </div>

                          <p className="text-muted-foreground mb-3">
                            {quiz.description}
                          </p>

                          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <BookOpen className="h-4 w-4" />
                              <span>{quiz.questions.length} questions</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{formatTime(quiz.time_limit)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{stats.attempts} attempts</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <BarChart3 className="h-4 w-4" />
                              <span>{stats.averageScore}% avg</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePublishToggle(quiz.id)}
                            className="btn-glass"
                          >
                            {quiz.is_published ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingQuiz(quiz)}
                            className="btn-glass"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="btn-glass text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {quizzes.length === 0 && (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                      No Quizzes Created
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first quiz to get started
                    </p>
                    <Button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="btn-hero"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Quiz
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Quiz Dialog */}
        <Dialog
          open={!!editingQuiz}
          onOpenChange={(open) => !open && setEditingQuiz(null)}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto glass">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl gradient-text">
                Edit Quiz
              </DialogTitle>
              <DialogDescription>
                Update quiz details, questions and publishing status
              </DialogDescription>
            </DialogHeader>
            {editingQuizData && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editTitle">Quiz Title</Label>
                    <Input
                      id="editTitle"
                      value={editingQuizData.title}
                      onChange={(e) =>
                        setEditingQuizData((prev) =>
                          prev ? { ...prev, title: e.target.value } : prev
                        )
                      }
                      className="glass"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editCategory">Category</Label>
                    <Input
                      id="editCategory"
                      value={editingQuizData.category}
                      onChange={(e) =>
                        setEditingQuizData((prev) =>
                          prev ? { ...prev, category: e.target.value } : prev
                        )
                      }
                      className="glass"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editDesc">Description</Label>
                  <Textarea
                    id="editDesc"
                    value={editingQuizData.description}
                    onChange={(e) =>
                      setEditingQuizData((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev
                      )
                    }
                    className="glass"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <Label>Difficulty</Label>
                    <Select
                      value={editingQuizData.difficulty}
                      onValueChange={(val: "Easy" | "Medium" | "Hard") =>
                        setEditingQuizData((prev) =>
                          prev ? { ...prev, difficulty: val } : prev
                        )
                      }
                    >
                      <SelectTrigger className="glass">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Time Limit (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={Math.round(editingQuizData.timeLimit / 60)}
                      onChange={(e) =>
                        setEditingQuizData((prev) =>
                          prev
                            ? {
                                ...prev,
                                timeLimit: parseInt(e.target.value) * 60,
                              }
                            : prev
                        )
                      }
                      className="glass"
                    />
                  </div>
                  <div className="flex items-center space-x-3 pt-6">
                    <Switch
                      checked={editingQuizData.isPublished}
                      onCheckedChange={(c) =>
                        setEditingQuizData((prev) =>
                          prev ? { ...prev, isPublished: !!c } : prev
                        )
                      }
                    />
                    <span className="text-sm">
                      {editingQuizData.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading text-xl font-bold">
                      Questions ({editingQuizData.questions.length})
                    </h3>
                    <Button
                      onClick={addEditingQuestion}
                      className="btn-hero"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Question
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {editingQuizData.questions.map((q, qIdx) => (
                      <Card key={q.id || qIdx} className="glass-card">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 mr-4">
                              <Label className="text-sm mb-1 block">
                                Question {qIdx + 1}
                              </Label>
                              <Textarea
                                value={q.question}
                                onChange={(e) =>
                                  updateEditingQuestionField(
                                    qIdx,
                                    "question",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter question"
                                className="glass"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEditingQuestion(qIdx)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">
                              Options (select correct)
                            </Label>
                            {q.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={q.correctAnswer === optIdx}
                                  onChange={() =>
                                    updateEditingQuestionField(
                                      qIdx,
                                      "correctAnswer",
                                      optIdx
                                    )
                                  }
                                />
                                <Label className="text-sm w-5">
                                  {String.fromCharCode(65 + optIdx)}
                                </Label>
                                <Input
                                  value={opt}
                                  onChange={(e) =>
                                    updateEditingOption(
                                      qIdx,
                                      optIdx,
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Option ${String.fromCharCode(
                                    65 + optIdx
                                  )}`}
                                  className="glass"
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {editingQuizData.questions.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No questions yet. Add one to get started.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-4 border-t pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setEditingQuiz(null)}
                    className="btn-glass"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateQuiz} className="btn-hero">
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminPanel;
