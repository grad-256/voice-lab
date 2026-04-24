CREATE TABLE weekly_recaps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  summary text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own weekly recaps"
  ON weekly_recaps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
