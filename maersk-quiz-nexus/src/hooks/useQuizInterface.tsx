import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuizData, Quiz } from "./useQuizData";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

/*
  Quiz Interface Hook Enhancements:
  - Persistent attempt state (answers, current question, start time) stored in sessionStorage
    so a page reload does not reset progress or timer.
  - Timer based on absolute start timestamp, eliminating drift from throttled intervals / tab switching.
  - Accurate timeRemaining recomputed each tick from Date.now - startTime (no cumulative drift).
  - Automatic finishing when time expires, including after a reload where time has already elapsed.
  - Double submission guard using isSubmitting ref/state.
*/

export const useQuizInterface = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { getQuizById, submitQuizResult } = useQuizData();

  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef<number | null>(null); // epoch ms
  const finishedRef = useRef(false);

  const attemptStorageKey =
    quizId && user ? `quizAttempt_${quizId}_${user.id}` : null;

  const persistAttempt = useCallback(
    (
      partial?: Partial<{
        answers: number[];
        currentQuestionIndex: number;
        startTime: number;
      }>
    ) => {
      if (!attemptStorageKey) return;
      try {
        const existing = attemptStorageKey
          ? sessionStorage.getItem(attemptStorageKey)
          : null;
        const parsed = existing ? JSON.parse(existing) : {};
        const merged = { ...parsed, ...partial };
        sessionStorage.setItem(attemptStorageKey, JSON.stringify(merged));
      } catch (e) {
        // Non-fatal: storage may be unavailable (private mode, etc.)
        console.warn("Persist attempt failed", e);
      }
    },
    [attemptStorageKey]
  );

  useEffect(() => {
    if (!quizId) return;
    const quiz = getQuizById(quizId);
    if (!quiz) return;
    setCurrentQuiz(quiz);

    // Attempt restoration
    if (attemptStorageKey) {
      try {
        const stored = sessionStorage.getItem(attemptStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed.answers)) {
            setAnswers(parsed.answers);
          }
          if (typeof parsed.currentQuestionIndex === "number") {
            setCurrentQuestionIndex(parsed.currentQuestionIndex);
          }
          if (typeof parsed.startTime === "number") {
            startTimeRef.current = parsed.startTime;
          }
        }
      } catch (e) {
        console.warn("Failed to restore attempt", e);
      }
    }

    // Initialise startTime if missing
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
      persistAttempt({ startTime: startTimeRef.current });
    }

    setIsQuizActive(true);
  }, [quizId, getQuizById, attemptStorageKey, persistAttempt]);

  useEffect(() => {
    if (currentQuiz && answers[currentQuestionIndex] !== undefined) {
      setSelectedAnswer(answers[currentQuestionIndex]);
    } else {
      setSelectedAnswer(null);
    }
  }, [currentQuestionIndex, answers, currentQuiz]);

  // Timer effect using absolute time to avoid drift & throttling issues
  useEffect(() => {
    if (!currentQuiz || !isQuizActive || showResults) return;
    const tick = () => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, currentQuiz.time_limit - elapsed);
      setTimeRemaining(remaining);
      if (remaining <= 0 && !finishedRef.current) {
        handleFinishQuiz();
      }
    };
    // Run immediately
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentQuiz, isQuizActive, showResults]);

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQuestionIndex] = answerIndex;
      persistAttempt({ answers: next, currentQuestionIndex });
      return next;
    });
  };

  const handleNext = () => {
    if (!currentQuiz) return;
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => {
        const next = prev + 1;
        persistAttempt({ currentQuestionIndex: next });
        return next;
      });
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    if (!currentQuiz || !user || finishedRef.current) return;
    finishedRef.current = true;
    if (isSubmitting) return; // guard
    setIsSubmitting(true);

    const score = calculateScore();
    const elapsed = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;
    const timeSpent = Math.min(elapsed, currentQuiz.time_limit);

    try {
      await submitQuizResult({
        quiz_id: currentQuiz.id,
        user_id: user.id,
        answers,
        score,
        total_questions: currentQuiz.questions.length,
        time_spent: timeSpent,
      });
      setIsQuizActive(false);
      setShowResults(true);
      if (attemptStorageKey) {
        sessionStorage.removeItem(attemptStorageKey);
      }
      const percentage = (score / currentQuiz.questions.length) * 100;
      toast({
        title: "Quiz Completed!",
        description: `You scored ${score}/${
          currentQuiz.questions.length
        } (${Math.round(percentage)}%)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit quiz results",
        variant: "destructive",
      });
      finishedRef.current = false; // allow retry on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateScore = () => {
    if (!currentQuiz) return 0;
    let score = 0;
    currentQuiz.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        score++;
      }
    });
    return score;
  };

  const startNewQuiz = () => {
    if (!currentQuiz) return;
    finishedRef.current = false;
    startTimeRef.current = Date.now();
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setIsQuizActive(true);
    setShowResults(false);
    setSelectedAnswer(null);
    persistAttempt({
      startTime: startTimeRef.current,
      answers: [],
      currentQuestionIndex: 0,
    });
  };

  return {
    currentQuiz,
    currentQuestionIndex,
    answers,
    timeRemaining,
    isQuizActive,
    selectedAnswer,
    showResults,
    setShowResults,
    setTimeRemaining,
    handleAnswerSelect,
    handleNext,
    handleFinishQuiz,
    calculateScore,
    startNewQuiz,
    navigate,
    isSubmitting,
  };
};
