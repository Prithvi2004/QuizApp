-- Cleanup stray tables that were inadvertently recreated
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.quiz_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;

-- Helper function to determine whether the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = uid
      AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- Update RLS policies so that admins can see global data
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users or admins can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view their own results" ON public.quiz_results;
CREATE POLICY "Users or admins can view results"
ON public.quiz_results
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Anyone can view published quizzes" ON public.quizzes;
CREATE POLICY "Users or admins can view quizzes"
ON public.quizzes
FOR SELECT
USING (
  is_published = true
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);
