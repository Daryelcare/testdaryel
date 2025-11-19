-- Create storage bucket for applicant documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('applicant-documents', 'applicant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for applicant documents storage
CREATE POLICY "Public upload access for applicant documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'applicant-documents'
);

CREATE POLICY "Public read access for applicant documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'applicant-documents'
);

CREATE POLICY "Admins can view all applicant documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'applicant-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Create document upload tokens table
CREATE TABLE IF NOT EXISTS public.document_upload_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES job_applications(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  applicant_email text NOT NULL,
  applicant_name text NOT NULL,
  required_documents jsonb DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  documents_uploaded jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_upload_tokens_token ON document_upload_tokens(token);
CREATE INDEX IF NOT EXISTS idx_document_upload_tokens_application ON document_upload_tokens(application_id);
CREATE INDEX IF NOT EXISTS idx_document_upload_tokens_expires ON document_upload_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.document_upload_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for document upload tokens
CREATE POLICY "Public can read their own token"
ON document_upload_tokens FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all tokens"
ON document_upload_tokens FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_document_upload_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_upload_tokens_updated_at
  BEFORE UPDATE ON document_upload_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_document_upload_tokens_updated_at();