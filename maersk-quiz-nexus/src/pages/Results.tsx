import React, { useEffect, useMemo, useState } from "react";
import { useQuizData } from "@/hooks/useQuizData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Filter, RefreshCw, Search, Users } from "lucide-react";

// Utility to format seconds into mm:ss
const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
};

const Results: React.FC = () => {
  const { profile } = useAuth();
  const { adminResults, fetchAllResults, quizzes, fetchAllQuizzes } =
    useQuizData();
  const [search, setSearch] = useState("");
  const [quizFilter, setQuizFilter] = useState<string>("all");
  const [scoreBand, setScoreBand] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [view, setView] = useState<string>("table");
  const [refreshing, setRefreshing] = useState(false);
  const [profilesMap, setProfilesMap] = useState<
    Record<string, { name: string; email: string; role: string }>
  >({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Ensure only admins can view (route already protected but fallback)
  if (profile?.role !== "admin") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    fetchAllResults();
    fetchAllQuizzes();
  }, []); // initial load

  // Fetch profiles for distinct user_ids in adminResults
  useEffect(() => {
    const loadProfiles = async () => {
      if (adminResults.length === 0) {
        setProfilesMap({});
        return;
      }
      const uniqueIds = Array.from(new Set(adminResults.map((r) => r.user_id)));
      // Avoid refetch if we already have all
      const missing = uniqueIds.filter((id) => !profilesMap[id]);
      if (missing.length === 0) return;
      setLoadingProfiles(true);
      try {
        // Chunk IN queries if large
        const chunkSize = 50;
        const newMap: Record<
          string,
          { name: string; email: string; role: string }
        > = {};
        for (let i = 0; i < missing.length; i += chunkSize) {
          const slice = missing.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from("profiles")
            .select("user_id,name,email,role")
            .in("user_id", slice);
          if (!error && data) {
            data.forEach((p) => {
              newMap[p.user_id] = {
                name: p.name,
                email: p.email,
                role: p.role,
              };
            });
          }
        }
        setProfilesMap((prev) => ({ ...prev, ...newMap }));
      } catch (e) {
        console.warn("Failed loading some profiles", e);
      } finally {
        setLoadingProfiles(false);
      }
    };
    loadProfiles();
  }, [adminResults]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAllQuizzes(), fetchAllResults()]);
    setRefreshing(false);
  };

  const quizMap = useMemo(() => {
    const map: Record<string, string> = {};
    quizzes.forEach((q) => {
      map[q.id] = q.title;
    });
    return map;
  }, [quizzes]);

  const filtered = useMemo(() => {
    return adminResults.filter((r) => {
      if (quizFilter !== "all" && r.quiz_id !== quizFilter) return false;
      if (search) {
        const qTitle = quizMap[r.quiz_id] || "";
        const profileMatch = profilesMap[r.user_id];
        const searchTarget = [
          qTitle,
          r.user_id,
          profileMatch?.name,
          profileMatch?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchTarget.includes(search.toLowerCase())) {
          return false;
        }
      }
      if (scoreBand !== "all") {
        const pct = (r.score / r.total_questions) * 100;
        const [min, max] = scoreBand.split("-").map(Number);
        if (pct < min || pct > max) return false;
      }
      if (roleFilter !== "all") {
        const role = profilesMap[r.user_id]?.role;
        if (!role || role !== roleFilter) return false;
      }
      return true;
    });
  }, [
    adminResults,
    quizFilter,
    search,
    scoreBand,
    roleFilter,
    quizMap,
    profilesMap,
  ]);

  // Global analytics (admins only)
  const stats = useMemo(() => {
    if (adminResults.length === 0)
      return {
        attempts: 0,
        avg: 0,
        avgTime: 0,
        uniqueUsers: 0,
        passRate: 0,
        mostAttemptedQuizId: "",
        mostAttemptedQuizTitle: "",
      };
    const attempts = adminResults.length;
    const scorePercents = adminResults.map(
      (r) => (r.score / r.total_questions) * 100
    );
    const avg = Math.round(
      scorePercents.reduce((a, n) => a + n, 0) / scorePercents.length
    );
    const avgTime = Math.round(
      adminResults.reduce((a, r) => a + r.time_spent, 0) / attempts
    );
    const passThreshold = 70; // unify pass condition
    const passCount = scorePercents.filter((p) => p >= passThreshold).length;
    const passRate = attempts ? Math.round((passCount / attempts) * 100) : 0;
    const uniqueUsers = new Set(adminResults.map((r) => r.user_id)).size;
    // Most attempted quiz
    const quizAttemptCounts: Record<string, number> = {};
    adminResults.forEach((r) => {
      quizAttemptCounts[r.quiz_id] = (quizAttemptCounts[r.quiz_id] || 0) + 1;
    });
    let mostAttemptedQuizId = "";
    let mostAttemptedQuizTitle = "";
    let maxAttempts = 0;
    Object.entries(quizAttemptCounts).forEach(([qid, count]) => {
      if (count > maxAttempts) {
        maxAttempts = count;
        mostAttemptedQuizId = qid;
        mostAttemptedQuizTitle = quizMap[qid] || qid;
      }
    });
    return {
      attempts,
      avg,
      avgTime,
      uniqueUsers,
      passRate,
      mostAttemptedQuizId,
      mostAttemptedQuizTitle,
    };
  }, [adminResults, quizMap]);

  // Aggregated per-user metrics for by-user view and potential export / display
  const userAggregates = useMemo(() => {
    const agg: Array<{
      user_id: string;
      name?: string;
      email?: string;
      role?: string;
      attempts: number;
      averagePercent: number;
      bestPercent: number;
      lastCompleted: string;
      totalTime: number;
      passRate: number; // percent of attempts passing threshold
      passedAttempts: number;
    }> = [];
    if (adminResults.length === 0) return agg;
    const passThreshold = 70;
    const grouped: Record<string, typeof adminResults> = {};
    adminResults.forEach((r) => {
      (grouped[r.user_id] ||= []).push(r);
    });
    Object.entries(grouped).forEach(([uid, list]) => {
      const percents = list.map((r) => (r.score / r.total_questions) * 100);
      const attempts = list.length;
      const averagePercent = Math.round(
        percents.reduce((a, n) => a + n, 0) / attempts
      );
      const bestPercent = Math.round(Math.max(...percents));
      const passedAttempts = percents.filter((p) => p >= passThreshold).length;
      const passRate = Math.round((passedAttempts / attempts) * 100);
      const lastCompleted = list
        .map((r) => r.completed_at)
        .sort()
        .reverse()[0];
      const totalTime = list.reduce((a, r) => a + r.time_spent, 0);
      const prof = profilesMap[uid];
      agg.push({
        user_id: uid,
        name: prof?.name,
        email: prof?.email,
        role: prof?.role,
        attempts,
        averagePercent,
        bestPercent,
        lastCompleted,
        totalTime,
        passRate,
        passedAttempts,
      });
    });
    // sort by best performance then attempts
    agg.sort((a, b) => b.bestPercent - a.bestPercent || b.attempts - a.attempts);
    return agg;
  }, [adminResults, profilesMap]);

  const exportCSV = () => {
    const header = [
      "result_id",
      "quiz_id",
      "quiz_title",
      "user_id",
      "score",
      "total_questions",
      "percent",
      "time_spent_seconds",
      "completed_at",
    ];
    const rows = filtered.map((r) => {
      const pct = ((r.score / r.total_questions) * 100).toFixed(2);
      return [
        r.id,
        r.quiz_id,
        quizMap[r.quiz_id] || "",
        r.user_id,
        r.score,
        r.total_questions,
        pct,
        r.time_spent,
        r.completed_at,
      ];
    });
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz_results_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-3 sm:px-4 pb-16 sm:pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold gradient-text leading-tight">
              Results
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Comprehensive overview of all quiz attempts
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="btn-glass"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </Button>
            <Button
              onClick={exportCSV}
              className="btn-hero"
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
          <Card className="glass-card">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Total Attempts
              </p>
              <p className="text-2xl font-bold mt-1">{stats.attempts}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Average Score
              </p>
              <p className="text-2xl font-bold mt-1">{stats.avg}%</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Avg. Time Spent
              </p>
              <p className="text-2xl font-bold mt-1">
                {formatDuration(stats.avgTime)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Unique Users
              </p>
              <p className="text-2xl font-bold mt-1">{stats.uniqueUsers}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Pass Rate
              </p>
              <p className="text-2xl font-bold mt-1">{stats.passRate}%</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Most Attempted
              </p>
              <p className="text-sm font-semibold mt-1 truncate" title={stats.mostAttemptedQuizTitle}>
                {stats.mostAttemptedQuizTitle || "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="col-span-2 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by quiz title or user id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass"
              />
            </div>
            <Select value={quizFilter} onValueChange={setQuizFilter}>
              <SelectTrigger className="glass">
                <SelectValue placeholder="Quiz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quizzes</SelectItem>
                {quizzes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scoreBand} onValueChange={setScoreBand}>
              <SelectTrigger className="glass">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="0-49">0 - 49%</SelectItem>
                <SelectItem value="50-69">50 - 69%</SelectItem>
                <SelectItem value="70-84">70 - 84%</SelectItem>
                <SelectItem value="85-100">85 - 100%</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="glass">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User Only</SelectItem>
                <SelectItem value="admin">Admin Only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs value={view} onValueChange={setView} className="mb-4">
          <TabsList className="glass">
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="by-quiz">By Quiz</TabsTrigger>
            <TabsTrigger value="by-user">By User</TabsTrigger>
            <TabsTrigger value="users-table">Users Table</TabsTrigger>
          </TabsList>
          <TabsContent value="table" className="mt-4">
            <Card className="glass-card">
              <CardContent className="p-0 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                      <th className="py-3 px-4">Quiz</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const pct = Math.round(
                        (r.score / r.total_questions) * 100
                      );
                      const difficultyClass =
                        pct >= 85
                          ? "bg-green-500/20 text-green-700"
                          : pct >= 70
                          ? "bg-blue-500/20 text-blue-700"
                          : pct >= 50
                          ? "bg-yellow-500/20 text-yellow-700"
                          : "bg-red-500/20 text-red-700";
                      const prof = profilesMap[r.user_id];
                      return (
                        <tr
                          key={r.id}
                          className="border-b last:border-b-0 hover:bg-background/60 transition-colors"
                        >
                          <td className="py-2 px-4 max-w-[240px]">
                            <div className="flex flex-col">
                              <span
                                className="font-medium truncate"
                                title={quizMap[r.quiz_id]}
                              >
                                {quizMap[r.quiz_id] || r.quiz_id}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {r.quiz_id}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span
                                  className="text-xs font-medium truncate"
                                  title={prof?.name || r.user_id}
                                >
                                  {prof?.name || r.user_id.slice(0, 10) + "…"}
                                </span>
                                {prof?.role && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                                      prof.role === "admin"
                                        ? "bg-maersk-blue/20 text-maersk-blue border-maersk-blue/40"
                                        : "bg-maersk-light-blue/30 text-maersk-navy border-maersk-light-blue/40"
                                    }`}
                                  >
                                    {prof.role}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[10px] text-muted-foreground font-mono truncate"
                                title={prof?.email}
                              >
                                {prof?.email || r.user_id}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <Badge className={`text-xs ${difficultyClass}`}>
                              {r.score}/{r.total_questions} ({pct}%)
                            </Badge>
                          </td>
                          <td className="py-2 px-4 text-xs text-muted-foreground">
                            {formatDuration(r.time_spent)}
                          </td>
                          <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.completed_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground text-sm"
                        >
                          No results match current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            {loadingProfiles && (
              <p className="mt-2 text-xs text-muted-foreground">
                Loading user details…
              </p>
            )}
          </TabsContent>
          <TabsContent value="by-quiz" className="mt-4 space-y-4">
            {quizzes.map((q) => {
              const qResults = filtered.filter((r) => r.quiz_id === q.id);
              if (qResults.length === 0) return null;
              const percentages = qResults.map(
                (r) => (r.score / r.total_questions) * 100
              );
              const attempts = qResults.length;
              const users = new Set(qResults.map((r) => r.user_id)).size;
              const avg = Math.round(
                percentages.reduce((a, b) => a + b, 0) / attempts
              );
              const highest = Math.round(Math.max(...percentages));
              const lowest = Math.round(Math.min(...percentages));
              const sorted = [...percentages].sort((a, b) => a - b);
              const median = Math.round(
                sorted.length % 2 === 1
                  ? sorted[(sorted.length - 1) / 2]
                  : (sorted[sorted.length / 2 - 1] +
                      sorted[sorted.length / 2]) /
                      2
              );
              const passThreshold = 70; // configurable
              const passCount = percentages.filter(
                (p) => p >= passThreshold
              ).length;
              const passRate = attempts
                ? Math.round((passCount / attempts) * 100)
                : 0;
              const distributionBuckets = [
                { label: "0-49", range: [0, 49] },
                { label: "50-69", range: [50, 69] },
                { label: "70-84", range: [70, 84] },
                { label: "85-100", range: [85, 100] },
              ].map((b) => ({
                ...b,
                count: percentages.filter(
                  (p) => p >= b.range[0] && p <= b.range[1]
                ).length,
              }));
              return (
                <Card key={q.id} className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <span>{q.title}</span>
                      <div className="flex flex-wrap gap-2 text-[11px] font-normal">
                        <Badge variant="secondary" className="bg-background/60">
                          Attempts: {attempts}
                        </Badge>
                        <Badge variant="secondary" className="bg-background/60">
                          Users: {users}
                        </Badge>
                        <Badge className="bg-blue-500/20 text-blue-700">
                          Avg {avg}%
                        </Badge>
                        <Badge className="bg-green-500/20 text-green-700">
                          High {highest}%
                        </Badge>
                        <Badge className="bg-red-500/20 text-red-700">
                          Low {lowest}%
                        </Badge>
                        <Badge className="bg-purple-500/20 text-purple-700">
                          Median {median}%
                        </Badge>
                        <Badge
                          className={
                            passRate >= 70
                              ? "bg-emerald-500/20 text-emerald-700"
                              : "bg-yellow-500/20 text-yellow-700"
                          }
                        >
                          Pass {passRate}%
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {/* Distribution Bars */}
                    <div className="flex flex-wrap gap-3">
                      {distributionBuckets.map((b) => {
                        const pctOfAttempts = attempts
                          ? Math.round((b.count / attempts) * 100)
                          : 0;
                        return (
                          <div
                            key={b.label}
                            className="flex flex-col items-start"
                          >
                            <div className="text-[10px] text-muted-foreground mb-1">
                              {b.label}
                            </div>
                            <div className="w-28 h-2 rounded-full bg-border/50 overflow-hidden">
                              <div
                                className={`h-full ${
                                  b.label === "0-49"
                                    ? "bg-red-500/60"
                                    : b.label === "50-69"
                                    ? "bg-yellow-500/60"
                                    : b.label === "70-84"
                                    ? "bg-blue-500/60"
                                    : "bg-green-500/60"
                                }`}
                                style={{ width: pctOfAttempts + "%" }}
                              />
                            </div>
                            <div className="text-[10px] mt-0.5 font-medium">
                              {b.count} ({pctOfAttempts}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Compact badge cloud */}
                    <div className="flex flex-wrap gap-1.5">
                      {qResults.slice(0, 80).map((r) => {
                        const pct = Math.round(
                          (r.score / r.total_questions) * 100
                        );
                        const cls =
                          pct >= 85
                            ? "bg-green-500/20 text-green-700"
                            : pct >= 70
                            ? "bg-blue-500/20 text-blue-700"
                            : pct >= 50
                            ? "bg-yellow-500/20 text-yellow-700"
                            : "bg-red-500/20 text-red-700";
                        return (
                          <Badge key={r.id} className={`text-[9px] ${cls}`}>
                            {pct}%
                          </Badge>
                        );
                      })}
                      {qResults.length > 80 && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          +{qResults.length - 80} more
                        </span>
                      )}
                    </div>
                    {/* Expandable Attempts Table */}
                    <details className="group mt-2">
                      <summary className="cursor-pointer text-xs text-maersk-blue hover:underline list-none flex items-center gap-1">
                        <span className="font-medium">
                          View all attempts ({attempts})
                        </span>
                        <span className="transition-transform group-open:rotate-180 inline-block">
                          ▾
                        </span>
                      </summary>
                      <div className="mt-3 overflow-x-auto border border-border/60 rounded-lg">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                              <th className="py-2 px-2">User</th>
                              <th className="py-2 px-2">Score</th>
                              <th className="py-2 px-2">Percent</th>
                              <th className="py-2 px-2">Time</th>
                              <th className="py-2 px-2">Completed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qResults.map((r) => {
                              const pct = Math.round(
                                (r.score / r.total_questions) * 100
                              );
                              const prof = profilesMap[r.user_id];
                              return (
                                <tr
                                  key={r.id}
                                  className="border-b last:border-b-0 hover:bg-background/50"
                                >
                                  <td className="py-1.5 px-2 max-w-[160px]">
                                    <div className="flex flex-col">
                                      <span
                                        className="truncate"
                                        title={prof?.name || r.user_id}
                                      >
                                        {prof?.name ||
                                          r.user_id.slice(0, 12) + "…"}
                                      </span>
                                      <span
                                        className="text-[9px] text-muted-foreground truncate"
                                        title={prof?.email}
                                      >
                                        {prof?.email || r.user_id}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2 font-medium">
                                    {r.score}/{r.total_questions}
                                  </td>
                                  <td className="py-1.5 px-2">{pct}%</td>
                                  <td className="py-1.5 px-2">
                                    {formatDuration(r.time_spent)}
                                  </td>
                                  <td className="py-1.5 px-2 whitespace-nowrap">
                                    {new Date(r.completed_at).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
            {quizzes.every(
              (q) => filtered.filter((r) => r.quiz_id === q.id).length === 0
            ) && (
              <p className="text-sm text-muted-foreground">
                No quiz result data for current filters.
              </p>
            )}
          </TabsContent>
          <TabsContent value="by-user" className="mt-4 space-y-4">
            {userAggregates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No user data for current filters.
              </p>
            )}
            {userAggregates.map((u) => {
              const list = filtered.filter((r) => r.user_id === u.user_id);
              if (list.length === 0) return null; // filtered out by filters
              return (
                <Card key={u.user_id} className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{u.user_id.slice(0, 16)}…</span>
                        {u.role && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                            u.role === "admin"
                              ? "bg-maersk-blue/20 text-maersk-blue border-maersk-blue/40"
                              : "bg-maersk-light-blue/30 text-maersk-navy border-maersk-light-blue/40"
                          }`}>{u.role}</span>
                        )}
                      </div>
                      <span className="text-xs font-normal text-muted-foreground">
                        {u.attempts} attempts • {u.averagePercent}% avg • Best {u.bestPercent}% • Pass {u.passRate}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {list.slice(0, 80).map((r) => {
                        const pct = Math.round(
                          (r.score / r.total_questions) * 100
                        );
                        const cls =
                          pct >= 85
                            ? "bg-green-500/20 text-green-700"
                            : pct >= 70
                            ? "bg-blue-500/20 text-blue-700"
                            : pct >= 50
                            ? "bg-yellow-500/20 text-yellow-700"
                            : "bg-red-500/20 text-red-700";
                        return (
                          <Badge key={r.id} className={`text-[10px] ${cls}`}>
                            {pct}%
                          </Badge>
                        );
                      })}
                      {list.length > 80 && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          +{list.length - 80} more
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
          <TabsContent value="users-table" className="mt-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Users Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                      <th className="py-2 px-3">User</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3">Attempts</th>
                      <th className="py-2 px-3">Avg %</th>
                      <th className="py-2 px-3">Best %</th>
                      <th className="py-2 px-3">Pass %</th>
                      <th className="py-2 px-3">Total Time</th>
                      <th className="py-2 px-3">Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userAggregates
                      .filter((u) =>
                        filtered.some((r) => r.user_id === u.user_id)
                      )
                      .map((u) => (
                        <tr
                          key={u.user_id}
                          className="border-b last:border-b-0 hover:bg-background/60"
                        >
                          <td className="py-1.5 px-3 max-w-[160px]">
                            <div className="flex flex-col">
                              <span className="truncate font-medium" title={u.name || u.user_id}>
                                {u.name || u.user_id.slice(0, 12) + "…"}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono truncate">
                                {u.user_id}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap max-w-[180px] truncate" title={u.email}>
                            {u.email || "—"}
                          </td>
                          <td className="py-1.5 px-3">
                            {u.role ? (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                                u.role === "admin"
                                  ? "bg-maersk-blue/20 text-maersk-blue border-maersk-blue/40"
                                  : "bg-maersk-light-blue/30 text-maersk-navy border-maersk-light-blue/40"
                              }`}>{u.role}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 font-medium">{u.attempts}</td>
                          <td className="py-1.5 px-3">{u.averagePercent}%</td>
                          <td className="py-1.5 px-3">{u.bestPercent}%</td>
                          <td className="py-1.5 px-3">{u.passRate}%</td>
                          <td className="py-1.5 px-3">{formatDuration(u.totalTime)}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {new Date(u.lastCompleted).toLocaleDateString()} {" "}
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(u.lastCompleted).toLocaleTimeString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {userAggregates.filter((u) =>
                      filtered.some((r) => r.user_id === u.user_id)
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-6 text-center text-muted-foreground"
                        >
                          No users match current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Results;
