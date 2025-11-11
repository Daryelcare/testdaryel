


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."adjust_employee_leave_balance"("p_employee_id" "uuid", "p_days" numeric, "p_operation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_employee_record RECORD;
    v_previous_taken NUMERIC;
    v_previous_remaining NUMERIC;
    v_new_taken NUMERIC;
    v_new_remaining NUMERIC;
    v_allowance NUMERIC;
BEGIN
    -- Get employee record with row lock and explicit column selection
    SELECT 
        id,
        leave_taken,
        remaining_leave_days,
        leave_allowance
    INTO v_employee_record
    FROM employees 
    WHERE id = p_employee_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Employee not found',
            'employee_id', p_employee_id
        );
    END IF;
    
    -- Use explicit record field references to avoid ambiguity
    v_previous_taken := COALESCE(v_employee_record.leave_taken, 0);
    v_previous_remaining := COALESCE(v_employee_record.remaining_leave_days, 28);
    v_allowance := COALESCE(v_employee_record.leave_allowance, 28);
    
    -- Apply the operation
    IF p_operation = 'add' THEN
        v_new_taken := v_previous_taken + p_days;
        v_new_remaining := v_previous_remaining - p_days;
    ELSIF p_operation = 'subtract' THEN
        v_new_taken := v_previous_taken - p_days;
        v_new_remaining := v_previous_remaining + p_days;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid operation. Must be add or subtract',
            'operation', p_operation
        );
    END IF;
    
    -- Update employee balances
    UPDATE employees 
    SET 
        leave_taken = v_new_taken,
        remaining_leave_days = v_new_remaining
    WHERE id = p_employee_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'employee_id', p_employee_id,
        'operation', p_operation,
        'days_adjusted', p_days,
        'previous_taken', v_previous_taken,
        'new_taken', v_new_taken,
        'previous_remaining', v_previous_remaining,
        'new_remaining', v_new_remaining
    );
END;
$$;


ALTER FUNCTION "public"."adjust_employee_leave_balance"("p_employee_id" "uuid", "p_days" numeric, "p_operation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_annual_appraisal_responses"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  record_count INTEGER := 0;
  appraisal_rec RECORD;
  questionnaire_id UUID;
  response_id UUID;
  question_mapping JSONB;
BEGIN
  -- Get the Annual Appraisal questionnaire ID
  SELECT id INTO questionnaire_id
  FROM compliance_questionnaires 
  WHERE name = 'Annual Appraisal Form' AND is_active = true
  LIMIT 1;
  
  IF questionnaire_id IS NULL THEN
    RAISE NOTICE 'No active Annual Appraisal questionnaire found';
    RETURN 0;
  END IF;

  -- Map legacy annual_appraisals fields to questionnaire questions
  -- This creates a mapping between old fields and new question IDs
  SELECT jsonb_object_agg(cq.question_text, cqq.question_id) INTO question_mapping
  FROM compliance_questionnaire_questions cqq
  JOIN compliance_questions cq ON cqq.question_id = cq.id
  WHERE cqq.questionnaire_id = questionnaire_id;

  -- Process each annual appraisal record
  FOR appraisal_rec IN 
    SELECT * FROM annual_appraisals 
    WHERE NOT EXISTS (
      SELECT 1 FROM compliance_questionnaire_responses cqr
      WHERE cqr.questionnaire_id = questionnaire_id
      AND cqr.employee_id::text = appraisal_rec.id::text -- Adjust based on actual relationship
    )
  LOOP
    -- Create questionnaire response record
    INSERT INTO compliance_questionnaire_responses (
      questionnaire_id,
      employee_id,
      compliance_record_id,
      completed_at,
      completed_by
    ) VALUES (
      questionnaire_id,
      appraisal_rec.id, -- This would need proper employee_id mapping
      NULL, -- Would need to find/create corresponding compliance_period_record
      appraisal_rec.submitted_at,
      NULL
    ) RETURNING id INTO response_id;

    -- Map legacy fields to questionnaire responses
    -- This is where you'd map each field from annual_appraisals to specific questions
    -- Example mappings (would need to match actual questions):
    
    IF appraisal_rec.comments_employee IS NOT NULL AND question_mapping->>'Employee Comments' IS NOT NULL THEN
      INSERT INTO compliance_responses (
        questionnaire_response_id,
        question_id,
        response_value
      ) VALUES (
        response_id,
        (question_mapping->>'Employee Comments')::UUID,
        appraisal_rec.comments_employee
      );
    END IF;

    IF appraisal_rec.comments_manager IS NOT NULL AND question_mapping->>'Manager Comments' IS NOT NULL THEN
      INSERT INTO compliance_responses (
        questionnaire_response_id,
        question_id,
        response_value
      ) VALUES (
        response_id,
        (question_mapping->>'Manager Comments')::UUID,
        appraisal_rec.comments_manager
      );
    END IF;

    -- Map ratings JSONB to individual rating questions
    IF appraisal_rec.ratings IS NOT NULL THEN
      -- Process each rating in the JSONB
      -- This would iterate through ratings and map to corresponding questions
      -- Implementation would depend on the structure of the ratings JSONB
    END IF;

    record_count := record_count + 1;
  END LOOP;

  RETURN record_count;
END;
$$;


ALTER FUNCTION "public"."backfill_annual_appraisal_responses"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."backfill_annual_appraisal_responses"() IS 'Migrates data from annual_appraisals table to questionnaire responses';



CREATE OR REPLACE FUNCTION "public"."backfill_compliance_notes_responses"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  record_count INTEGER := 0;
  compliance_rec RECORD;
  questionnaire_id UUID;
  response_id UUID;
  notes_question_id UUID;
BEGIN
  -- Process compliance period records that have notes but no questionnaire responses
  FOR compliance_rec IN 
    SELECT cpr.*, ct.name as compliance_type_name
    FROM compliance_period_records cpr
    JOIN compliance_types ct ON cpr.compliance_type_id = ct.id
    WHERE cpr.notes IS NOT NULL 
    AND cpr.notes != ''
    AND cpr.completion_method != 'questionnaire' -- Don't migrate records already using questionnaires
    AND NOT EXISTS (
      SELECT 1 FROM compliance_questionnaire_responses cqr
      WHERE cqr.compliance_record_id = cpr.id
    )
  LOOP
    -- Get the questionnaire for this compliance type
    SELECT cq.id INTO questionnaire_id
    FROM compliance_questionnaires cq
    WHERE cq.compliance_type_id = compliance_rec.compliance_type_id
    AND cq.is_active = true
    LIMIT 1;
    
    IF questionnaire_id IS NOT NULL THEN
      -- Create questionnaire response record
      INSERT INTO compliance_questionnaire_responses (
        questionnaire_id,
        employee_id,
        compliance_record_id,
        completed_at,
        completed_by
      ) VALUES (
        questionnaire_id,
        compliance_rec.employee_id,
        compliance_rec.id,
        COALESCE(compliance_rec.updated_at, compliance_rec.created_at),
        compliance_rec.completed_by
      ) RETURNING id INTO response_id;

      -- Find a general notes/comments question to store the notes
      SELECT cqq.question_id INTO notes_question_id
      FROM compliance_questionnaire_questions cqq
      JOIN compliance_questions cq ON cqq.question_id = cq.id
      WHERE cqq.questionnaire_id = questionnaire_id
      AND (
        LOWER(cq.question_text) LIKE '%note%' OR 
        LOWER(cq.question_text) LIKE '%comment%' OR
        LOWER(cq.question_text) LIKE '%additional%'
      )
      ORDER BY cqq.order_index DESC
      LIMIT 1;

      -- Store the notes in the questionnaire response
      IF notes_question_id IS NOT NULL THEN
        INSERT INTO compliance_responses (
          questionnaire_response_id,
          question_id,
          response_value
        ) VALUES (
          response_id,
          notes_question_id,
          compliance_rec.notes
        );
      END IF;

      record_count := record_count + 1;
    END IF;
  END LOOP;

  RETURN record_count;
END;
$$;


ALTER FUNCTION "public"."backfill_compliance_notes_responses"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."backfill_compliance_notes_responses"() IS 'Migrates notes from compliance_period_records to questionnaire responses';



CREATE OR REPLACE FUNCTION "public"."calculate_archive_dates"("frequency" "text", "base_year" integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer) RETURNS TABLE("archive_due_date" "date", "download_available_date" "date")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  retention_years INTEGER;
  archive_date DATE;
BEGIN
  -- Set retention period based on frequency (all keep 6 years worth of data)
  retention_years := 6;
  
  -- Calculate when data should be archived (after retention period)
  archive_date := (base_year + retention_years + 1)::TEXT || '-01-01'::DATE;
  
  RETURN QUERY SELECT 
    archive_date as archive_due_date,
    (archive_date - INTERVAL '3 months')::DATE as download_available_date;
END;
$$;


ALTER FUNCTION "public"."calculate_archive_dates"("frequency" "text", "base_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_leave_days"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.days_requested = (NEW.end_date - NEW.start_date) + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_leave_days"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  -- Check if all compliance records for the type/year are completed or overdue beyond grace period
  RETURN NOT EXISTS (
    SELECT 1 FROM compliance_period_records cpr
    WHERE cpr.compliance_type_id = p_compliance_type_id
    AND EXTRACT(YEAR FROM CASE 
      WHEN cpr.completion_date ~ '^\d{4}-\d{2}-\d{2}$' 
      THEN cpr.completion_date::DATE 
      ELSE CURRENT_DATE 
    END) = p_year
    AND cpr.status IN ('pending', 'in_progress')
    AND (cpr.grace_period_end IS NULL OR cpr.grace_period_end > CURRENT_DATE - INTERVAL '30 days')
  );
END;
$_$;


ALTER FUNCTION "public"."check_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_client_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  -- Check if all client compliance records for the type/year are completed or overdue beyond grace period
  RETURN NOT EXISTS (
    SELECT 1 FROM client_compliance_period_records ccpr
    WHERE ccpr.client_compliance_type_id = p_compliance_type_id
    AND EXTRACT(YEAR FROM CASE 
      WHEN ccpr.completion_date ~ '^\d{4}-\d{2}-\d{2}$' 
      THEN ccpr.completion_date::DATE 
      ELSE CURRENT_DATE 
    END) = p_year
    AND ccpr.status IN ('pending', 'in_progress')
    AND (ccpr.grace_period_end IS NULL OR ccpr.grace_period_end > CURRENT_DATE - INTERVAL '30 days')
  );
END;
$_$;


ALTER FUNCTION "public"."check_client_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_signing_expiration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Mark as expired if accessed after already being signed
  IF NEW.access_count > OLD.access_count AND OLD.status = 'signed' THEN
    NEW.expired_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_signing_expiration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_auth_user_on_role_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- This will be called after user_roles record is deleted
  -- Log the deletion for audit purposes
  RAISE NOTICE 'User role deleted for user_id: %', OLD.user_id;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_auth_user_on_role_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_branch_permissions_table"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if the table already exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_branch_permissions'
  ) THEN
    -- Create the table
    CREATE TABLE public.user_branch_permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      branch_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Add comment
    COMMENT ON TABLE public.user_branch_permissions IS 'Stores branch permissions for users';
  END IF;
END;
$$;


ALTER FUNCTION "public"."create_user_branch_permissions_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_menu_permissions_table"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if the table already exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_menu_permissions'
  ) THEN
    -- Create the table
    CREATE TABLE public.user_menu_permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      menu_path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Add comment
    COMMENT ON TABLE public.user_menu_permissions IS 'Stores menu permissions for users';
  END IF;
END;
$$;


ALTER FUNCTION "public"."create_user_menu_permissions_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_with_role"("email_param" "text", "password_param" "text", "role_param" "text" DEFAULT 'user'::"text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- This function will be called from the client side
  -- The actual user creation will happen via Supabase Auth API
  -- This function just handles role assignment
  RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Use Supabase Auth API for user creation');
END;
$$;


ALTER FUNCTION "public"."create_user_with_role"("email_param" "text", "password_param" "text", "role_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_employee_document"("p_employee_id" "uuid", "p_document_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_documents jsonb;
  v_filtered_documents jsonb;
BEGIN
  -- Get the current documents array
  SELECT documents INTO v_documents
  FROM document_tracker
  WHERE employee_id = p_employee_id;
  
  -- If no documents found, nothing to delete
  IF v_documents IS NULL THEN
    RETURN;
  END IF;
  
  -- Filter out the document with matching id
  SELECT jsonb_agg(doc)
  INTO v_filtered_documents
  FROM jsonb_array_elements(v_documents) AS doc
  WHERE (doc->>'id')::uuid != p_document_id;
  
  -- If no documents remain after filtering, delete the entire row
  IF v_filtered_documents IS NULL OR jsonb_array_length(v_filtered_documents) = 0 THEN
    DELETE FROM document_tracker
    WHERE employee_id = p_employee_id;
  ELSE
    -- Otherwise, update with the filtered documents array
    UPDATE document_tracker
    SET documents = v_filtered_documents,
        updated_at = now()
    WHERE employee_id = p_employee_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_employee_document"("p_employee_id" "uuid", "p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_signed_link_on_access"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If this recipient is already signed and someone is accessing it again, expire it immediately
  IF NEW.access_count > OLD.access_count AND OLD.status = 'signed' THEN
    NEW.expired_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."expire_signed_link_on_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_signing_link_on_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If status changes to 'signed', immediately expire the link
  IF NEW.status = 'signed' AND OLD.status != 'signed' THEN
    NEW.expired_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."expire_signing_link_on_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_client_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  records_created INTEGER := 0;
  client_record RECORD;
  automation_settings RECORD;
  compliance_frequency TEXT;
  period_end_date DATE;
BEGIN
  -- Get automation settings
  SELECT * INTO automation_settings 
  FROM compliance_automation_settings 
  LIMIT 1;
  
  -- Only proceed if auto generation is enabled
  IF NOT automation_settings.auto_generate_records THEN
    RETURN 0;
  END IF;

  -- Get the frequency for this compliance type
  SELECT frequency INTO compliance_frequency
  FROM client_compliance_types
  WHERE id = p_compliance_type_id;

  -- Calculate the period end date
  period_end_date := get_period_end_date(compliance_frequency, p_period_identifier);

  -- Generate records only for clients that existed during or before the period
  FOR client_record IN 
    SELECT id, created_at FROM clients 
    WHERE is_active = true 
    AND created_at::date <= period_end_date
  LOOP
    -- Check if record already exists
    IF NOT EXISTS (
      SELECT 1 FROM client_compliance_period_records 
      WHERE client_compliance_type_id = p_compliance_type_id 
      AND client_id = client_record.id 
      AND period_identifier = p_period_identifier
    ) THEN
      -- Create new client compliance record
      INSERT INTO client_compliance_period_records (
        client_compliance_type_id,
        client_id,
        period_identifier,
        status,
        auto_generated,
        grace_period_end,
        completion_date,
        notes
      ) VALUES (
        p_compliance_type_id,
        client_record.id,
        p_period_identifier,
        'pending',
        true,
        period_end_date,
        '',
        ''
      );
      
      records_created := records_created + 1;
    END IF;
  END LOOP;
  
  RETURN records_created;
END;
$$;


ALTER FUNCTION "public"."generate_client_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_client_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_records', COUNT(*),
    'completed_records', COUNT(*) FILTER (WHERE status = 'completed'),
    'overdue_records', COUNT(*) FILTER (WHERE status = 'overdue'),
    'pending_records', COUNT(*) FILTER (WHERE status = 'pending'),
    'completion_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'average_completion_days', AVG(
      CASE 
        WHEN status = 'completed' AND completion_date ~ '^\d{4}-\d{2}-\d{2}$'
        THEN EXTRACT(DAY FROM completion_date::DATE - created_at::DATE)
        ELSE NULL
      END
    ),
    'unique_clients', COUNT(DISTINCT client_id),
    'period_identifiers', array_agg(DISTINCT period_identifier ORDER BY period_identifier)
  ) INTO stats
  FROM client_compliance_period_records
  WHERE client_compliance_type_id = p_compliance_type_id
  AND EXTRACT(YEAR FROM CASE 
    WHEN completion_date ~ '^\d{4}-\d{2}-\d{2}$' 
    THEN completion_date::DATE 
    ELSE created_at::DATE 
  END) = p_year;
  
  RETURN COALESCE(stats, '{}'::jsonb);
END;
$_$;


ALTER FUNCTION "public"."generate_client_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  records_created INTEGER := 0;
  emp_record RECORD;
  automation_settings RECORD;
  compliance_frequency TEXT;
  period_end_date DATE;
BEGIN
  -- Get automation settings
  SELECT * INTO automation_settings 
  FROM compliance_automation_settings 
  LIMIT 1;
  
  -- Only proceed if auto generation is enabled
  IF NOT automation_settings.auto_generate_records THEN
    RETURN 0;
  END IF;

  -- Get the frequency for this compliance type
  SELECT frequency INTO compliance_frequency
  FROM compliance_types
  WHERE id = p_compliance_type_id;

  -- Calculate the period end date
  period_end_date := get_period_end_date(compliance_frequency, p_period_identifier);

  -- Generate records only for employees that existed during or before the period
  FOR emp_record IN 
    SELECT id, created_at FROM employees 
    WHERE is_active = true 
    AND created_at::date <= period_end_date
  LOOP
    -- Check if record already exists
    IF NOT EXISTS (
      SELECT 1 FROM compliance_period_records 
      WHERE compliance_type_id = p_compliance_type_id 
      AND employee_id = emp_record.id 
      AND period_identifier = p_period_identifier
    ) THEN
      -- Create new compliance record
      INSERT INTO compliance_period_records (
        compliance_type_id,
        employee_id,
        period_identifier,
        status,
        auto_generated,
        grace_period_end,
        completion_date,
        notes
      ) VALUES (
        p_compliance_type_id,
        emp_record.id,
        p_period_identifier,
        'pending',
        true,
        period_end_date,
        '',
        ''
      );
      
      records_created := records_created + 1;
    END IF;
  END LOOP;
  
  RETURN records_created;
END;
$$;


ALTER FUNCTION "public"."generate_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_records', COUNT(*),
    'completed_records', COUNT(*) FILTER (WHERE status = 'completed'),
    'overdue_records', COUNT(*) FILTER (WHERE status = 'overdue'),
    'pending_records', COUNT(*) FILTER (WHERE status = 'pending'),
    'completion_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'average_completion_days', AVG(
      CASE 
        WHEN status = 'completed' AND completion_date ~ '^\d{4}-\d{2}-\d{2}$'
        THEN EXTRACT(DAY FROM completion_date::DATE - created_at::DATE)
        ELSE NULL
      END
    ),
    'unique_employees', COUNT(DISTINCT employee_id),
    'period_identifiers', array_agg(DISTINCT period_identifier ORDER BY period_identifier)
  ) INTO stats
  FROM compliance_period_records
  WHERE compliance_type_id = p_compliance_type_id
  AND EXTRACT(YEAR FROM CASE 
    WHEN completion_date ~ '^\d{4}-\d{2}-\d{2}$' 
    THEN completion_date::DATE 
    ELSE created_at::DATE 
  END) = p_year;
  
  RETURN COALESCE(stats, '{}'::jsonb);
END;
$_$;


ALTER FUNCTION "public"."generate_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_employee_accounts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  emp_record RECORD;
  emp_email TEXT;
  password_hash TEXT;
BEGIN
  -- Default password is '123456' - in production, this should be properly hashed
  password_hash := crypt('123456', gen_salt('bf'));
  
  FOR emp_record IN 
    SELECT id, name, email FROM employees 
    WHERE id NOT IN (SELECT employee_id FROM employee_accounts)
  LOOP
    -- Generate email from employee name if no email exists
    IF emp_record.email IS NULL OR emp_record.email = '' THEN
      emp_email := lower(replace(emp_record.name, ' ', '.')) || '@company.com';
    ELSE
      emp_email := emp_record.email;
    END IF;
    
    -- Insert employee account
    INSERT INTO employee_accounts (employee_id, email, password_hash)
    VALUES (emp_record.id, emp_email, password_hash)
    ON CONFLICT (email) DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_employee_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_compliance_automation_status"() RETURNS TABLE("job_name" "text", "schedule" "text", "active" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    jobname::text as job_name,
    schedule::text,
    active
  FROM cron.job 
  WHERE jobname LIKE '%compliance%'
  ORDER BY jobname;
$$;


ALTER FUNCTION "public"."get_all_compliance_automation_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_compliance_automation_status"() RETURNS TABLE("job_name" "text", "schedule" "text", "active" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT 
    jobname::text as job_name,
    schedule::text,
    active
  FROM cron.job 
  WHERE jobname LIKE '%compliance-automation%'
  ORDER BY jobname;
$$;


ALTER FUNCTION "public"."get_compliance_automation_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_email_settings"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  email_settings jsonb;
BEGIN
  SELECT setting_value INTO email_settings
  FROM system_settings 
  WHERE setting_key = 'email_settings'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Return default values if no settings found
  IF email_settings IS NULL THEN
    email_settings := '{"sender_email": "noreply@yourcompany.com", "sender_name": "Your Company", "admin_email": "admin@yourcompany.com"}'::jsonb;
  END IF;
  
  RETURN email_settings;
END;
$$;


ALTER FUNCTION "public"."get_email_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leave_automation_status"() RETURNS TABLE("job_name" "text", "schedule" "text", "active" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT 
    jobname::text as job_name,
    schedule::text,
    active
  FROM cron.job 
  WHERE jobname LIKE '%leave%' OR command LIKE '%leave-automation%';
$$;


ALTER FUNCTION "public"."get_leave_automation_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leave_settings"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    RETURN get_leave_settings_internal();
END;
$$;


ALTER FUNCTION "public"."get_leave_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leave_settings_internal"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    settings_value json;
BEGIN
    -- Get leave settings from system_settings table
    SELECT setting_value INTO settings_value
    FROM system_settings 
    WHERE setting_key = 'leave_settings'
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Return settings or default values
    IF settings_value IS NOT NULL THEN
        RETURN settings_value;
    ELSE
        RETURN json_build_object(
            'default_leave_days', 28,
            'fiscal_year_start_month', 4,
            'fiscal_year_start_day', 1,
            'enable_auto_reset', true,
            'last_auto_reset_at', null
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_leave_settings_internal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_end_date"("p_frequency" "text", "p_period_identifier" "text") RETURNS "date"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  year_val INT;
  quarter_val INT;
  half_val INT;
  week_val INT;
BEGIN
  CASE p_frequency
    WHEN 'annual' THEN
      -- Period: "2025" -> End: 2025-12-31
      RETURN (p_period_identifier || '-12-31')::DATE;
    
    WHEN 'quarterly' THEN
      -- Period: "2025-Q4" -> End: 2025-12-31
      year_val := SPLIT_PART(p_period_identifier, '-Q', 1)::INT;
      quarter_val := SPLIT_PART(p_period_identifier, '-Q', 2)::INT;
      RETURN (DATE_TRUNC('quarter', MAKE_DATE(year_val, quarter_val * 3, 1)) 
             + INTERVAL '3 months' - INTERVAL '1 day')::DATE;
    
    WHEN 'monthly' THEN
      -- Period: "2025-10" -> End: 2025-10-31
      RETURN (DATE_TRUNC('month', (p_period_identifier || '-01')::DATE) 
              + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    WHEN 'bi-annual' THEN
      -- Period: "2025-H2" -> End: 2025-12-31
      year_val := SPLIT_PART(p_period_identifier, '-H', 1)::INT;
      half_val := SPLIT_PART(p_period_identifier, '-H', 2)::INT;
      IF half_val = 1 THEN
        RETURN MAKE_DATE(year_val, 6, 30);
      ELSE
        RETURN MAKE_DATE(year_val, 12, 31);
      END IF;
    
    WHEN 'weekly' THEN
      -- Period: "2025-W40" -> End: Last day of week 40
      year_val := SPLIT_PART(p_period_identifier, '-W', 1)::INT;
      week_val := SPLIT_PART(p_period_identifier, '-W', 2)::INT;
      -- Calculate the last day of the ISO week
      RETURN (DATE_TRUNC('week', MAKE_DATE(year_val, 1, 4)) 
              + (week_val - 1) * INTERVAL '1 week' 
              + INTERVAL '6 days')::DATE;
    
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."get_period_end_date"("p_frequency" "text", "p_period_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_identifier"("frequency" "text", "target_date" "date" DEFAULT CURRENT_DATE) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  CASE frequency
    WHEN 'annual' THEN
      RETURN EXTRACT(YEAR FROM target_date)::TEXT;
    WHEN 'monthly' THEN
      RETURN TO_CHAR(target_date, 'YYYY-MM');
    WHEN 'quarterly' THEN
      RETURN EXTRACT(YEAR FROM target_date)::TEXT || '-Q' || EXTRACT(QUARTER FROM target_date)::TEXT;
    WHEN 'bi-annual' THEN
      RETURN EXTRACT(YEAR FROM target_date)::TEXT || '-H' || 
             CASE WHEN EXTRACT(MONTH FROM target_date) <= 6 THEN '1' ELSE '2' END;
    WHEN 'weekly' THEN
      RETURN TO_CHAR(target_date, 'YYYY-"W"IW');
    ELSE
      RETURN EXTRACT(YEAR FROM target_date)::TEXT;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."get_period_identifier"("frequency" "text", "target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_columns"("table_name" "text") RETURNS TABLE("column_name" "text", "data_type" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT c.column_name::text, c.data_type::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = table_name;
END;
$$;


ALTER FUNCTION "public"."get_table_columns"("table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_branches"("user_id" "uuid") RETURNS TABLE("branch_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  -- If user is admin, return all branches
  SELECT branches.id
  FROM branches
  WHERE EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = get_user_accessible_branches.user_id 
    AND role = 'admin'
  )
  
  UNION
  
  -- Otherwise return only branches they have access to
  SELECT uba.branch_id
  FROM user_branch_access uba
  WHERE uba.user_id = get_user_accessible_branches.user_id
  AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = get_user_accessible_branches.user_id 
    AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."get_user_accessible_branches"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_name TEXT;
    employee_name TEXT;
BEGIN
    -- First try to get from employees table
    SELECT name INTO employee_name
    FROM employees 
    WHERE id = user_id OR employees.user_id = user_id;
    
    IF employee_name IS NOT NULL THEN
        RETURN employee_name;
    END IF;
    
    -- If not found in employees, try auth.users (for admin users)
    SELECT COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name', 
        email
    ) INTO user_name
    FROM auth.users 
    WHERE id = user_id;
    
    RETURN COALESCE(user_name, 'Unknown User');
END;
$$;


ALTER FUNCTION "public"."get_user_display_name"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("input_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the user's role from the user_roles table with explicit table reference
  SELECT ur.role INTO user_role 
  FROM user_roles ur 
  WHERE ur.user_id = input_user_id 
  LIMIT 1;
  
  -- Return the role or null if not found
  RETURN user_role;
END;
$$;


ALTER FUNCTION "public"."get_user_role"("input_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_password"("password" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$;


ALTER FUNCTION "public"."hash_password"("password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment"("row_id" "uuid", "increment_amount" numeric) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_value NUMERIC;
  new_value NUMERIC;
BEGIN
  -- Get the current value
  SELECT leave_taken INTO current_value FROM employees WHERE id = row_id;
  
  -- Calculate the new value
  new_value := current_value + increment_amount;
  
  -- Update the table
  UPDATE employees SET leave_taken = new_value WHERE id = row_id;
  
  -- Return the new value
  RETURN new_value;
END;
$$;


ALTER FUNCTION "public"."increment"("row_id" "uuid", "increment_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_by_id"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['admin@example.com']; -- Add default admin emails here
  user_email TEXT;
BEGIN
  -- Get the user's email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  -- Check if the user's email is in the admin_emails array
  RETURN user_email = ANY(admin_emails);
END;
$$;


ALTER FUNCTION "public"."is_admin_by_id"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if the current user has admin role
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_application_settings_data"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  migrated_count INTEGER := 0;
  record_count INTEGER;
BEGIN
  -- Migrate emergency settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'emergency' as category,
    setting_type,
    setting_type || '_' || value as setting_key,
    jsonb_build_object(
      'value', value,
      'display_order', display_order,
      'is_active', is_active
    ) as setting_value,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM application_emergency_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate personal settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'personal' as category,
    setting_type,
    setting_type || '_' || value as setting_key,
    jsonb_build_object(
      'value', value,
      'display_order', display_order,
      'is_active', is_active
    ) as setting_value,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM application_personal_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate shift settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'shift' as category,
    'shift' as setting_type,
    name as setting_key,
    jsonb_build_object(
      'name', name,
      'label', label,
      'start_time', start_time,
      'end_time', end_time,
      'display_order', display_order,
      'is_active', is_active
    ) as setting_value,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM application_shift_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate skills
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'skills' as category,
    'skill' as setting_type,
    name as setting_key,
    jsonb_build_object(
      'name', name,
      'category_id', category_id,
      'display_order', display_order,
      'is_active', is_active
    ) as setting_value,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM application_skills;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate skills categories
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'skills' as category,
    'category' as setting_type,
    name as setting_key,
    jsonb_build_object(
      'name', name,
      'description', description,
      'display_order', display_order,
      'is_active', is_active
    ) as setting_value,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM application_skills_categories;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate status settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'status' as category,
    'status' as setting_type,
    status_name as setting_key,
    jsonb_build_object(
      'status_name', status_name,
      'status_label', status_label,
      'status_color', status_color,
      'is_default', is_default,
      'display_order', display_order,
      'is_active', is_active
    ) as setting_value,
    display_order,
    is_active,
    created_at,
    updated_at
  FROM application_status_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate step settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'steps' as category,
    'step' as setting_type,
    step_name as setting_key,
    jsonb_build_object(
      'step_name', step_name,
      'display_name', display_name,
      'description', description,
      'is_enabled', is_enabled,
      'is_required', is_required,
      'step_config', step_config,
      'display_order', display_order
    ) as setting_value,
    display_order,
    is_enabled as is_active,
    created_at,
    updated_at
  FROM application_step_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate field settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'fields' as category,
    step_name as setting_type,
    field_name as setting_key,
    jsonb_build_object(
      'step_name', step_name,
      'field_name', field_name,
      'field_label', field_label,
      'is_visible', is_visible,
      'is_required', is_required,
      'validation_rules', validation_rules,
      'help_text', help_text,
      'display_order', display_order
    ) as setting_value,
    display_order,
    is_visible as is_active,
    created_at,
    updated_at
  FROM application_field_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  -- Migrate reference settings
  INSERT INTO job_application_settings (category, setting_type, setting_key, setting_value, display_order, is_active, created_at, updated_at)
  SELECT 
    'reference' as category,
    setting_key as setting_type,
    setting_key as setting_key,
    setting_value as setting_value,
    0 as display_order,
    true as is_active,
    created_at,
    updated_at
  FROM application_reference_settings;
  
  GET DIAGNOSTICS record_count = ROW_COUNT;
  migrated_count := migrated_count + record_count;

  RETURN migrated_count;
END;
$$;


ALTER FUNCTION "public"."migrate_application_settings_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_documents_to_jsonb"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  employee_record RECORD;
  document_record RECORD;
  documents_array JSONB;
  rows_processed INTEGER := 0;
BEGIN
  -- For each unique employee
  FOR employee_record IN 
    SELECT DISTINCT employee_id, country, nationality_status, branch_id
    FROM document_tracker
    ORDER BY employee_id
  LOOP
    documents_array := '[]'::JSONB;
    
    -- Collect all documents for this employee
    FOR document_record IN 
      SELECT id, document_type_id, document_number, issue_date, 
             expiry_date, status, notes, created_at, updated_at
      FROM document_tracker
      WHERE employee_id = employee_record.employee_id
      ORDER BY created_at
    LOOP
      documents_array := documents_array || jsonb_build_object(
        'id', document_record.id,
        'document_type_id', document_record.document_type_id,
        'document_number', document_record.document_number,
        'issue_date', document_record.issue_date,
        'expiry_date', document_record.expiry_date,
        'status', document_record.status,
        'notes', document_record.notes,
        'created_at', document_record.created_at,
        'updated_at', document_record.updated_at
      );
    END LOOP;
    
    -- Keep the first row for this employee, update it with the JSONB array
    UPDATE document_tracker
    SET documents = documents_array
    WHERE id = (
      SELECT id FROM document_tracker
      WHERE employee_id = employee_record.employee_id
      ORDER BY created_at
      LIMIT 1
    );
    
    rows_processed := rows_processed + 1;
  END LOOP;
  
  RETURN rows_processed;
END;
$$;


ALTER FUNCTION "public"."migrate_documents_to_jsonb"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins"("p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_reference_table" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_table)
  SELECT 
    ur.user_id,
    p_title,
    p_message,
    p_type,
    p_reference_id,
    p_reference_table
  FROM user_roles ur
  WHERE ur.role = 'admin';
END;
$$;


ALTER FUNCTION "public"."notify_admins"("p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_compliance_overdue"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  employee_user_id UUID;
  employee_name TEXT;
  compliance_name TEXT;
BEGIN
  IF OLD.is_overdue = false AND NEW.is_overdue = true THEN
    SELECT e.user_id, e.name INTO employee_user_id, employee_name 
    FROM employees e WHERE e.id = NEW.employee_id;
    
    SELECT ct.name INTO compliance_name 
    FROM compliance_types ct WHERE ct.id = NEW.compliance_type_id;
    
    -- Notify employee
    IF employee_user_id IS NOT NULL THEN
      PERFORM notify_user(
        employee_user_id,
        'Compliance Task Overdue',
        'Your ' || compliance_name || ' task is now overdue',
        'compliance',
        NEW.id,
        'compliance_period_records'
      );
    END IF;
    
    -- Notify admins
    PERFORM notify_admins(
      'Compliance Overdue',
      employee_name || ' has an overdue ' || compliance_name || ' task',
      'compliance',
      NEW.id,
      'compliance_period_records'
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_compliance_overdue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_document_expiring"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  employee_user_id UUID;
  employee_name TEXT;
  doc_type_name TEXT;
  days_until_expiry INTEGER;
  expiry_date_value DATE;
BEGIN
  -- Only process if expiry_date is a valid date format
  IF NEW.expiry_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    BEGIN
      expiry_date_value := NEW.expiry_date::DATE;
      days_until_expiry := expiry_date_value - CURRENT_DATE;
      
      -- Notify when 7 days before expiry
      IF days_until_expiry = 7 THEN
        SELECT e.user_id, e.name INTO employee_user_id, employee_name 
        FROM employees e WHERE e.id = NEW.employee_id;
        
        SELECT dt.name INTO doc_type_name 
        FROM document_types dt WHERE dt.id = NEW.document_type_id;
        
        -- Notify employee
        IF employee_user_id IS NOT NULL THEN
          PERFORM notify_user(
            employee_user_id,
            'Document Expiring Soon',
            'Your ' || doc_type_name || ' will expire in 7 days (' || NEW.expiry_date || ')',
            'document',
            NEW.id,
            'document_tracker'
          );
        END IF;
        
        -- Notify admins
        PERFORM notify_admins(
          'Document Expiring',
          employee_name || '''s ' || doc_type_name || ' expires in 7 days',
          'document',
          NEW.id,
          'document_tracker'
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Skip notification if date conversion fails
        NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."notify_on_document_expiring"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_leave_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  employee_name TEXT;
BEGIN
  SELECT name INTO employee_name FROM employees WHERE id = NEW.employee_id;
  
  PERFORM notify_admins(
    'New Leave Request',
    employee_name || ' submitted a leave request from ' || NEW.start_date || ' to ' || NEW.end_date,
    'leave',
    NEW.id,
    'leave_requests'
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_leave_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_leave_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  employee_user_id UUID;
BEGIN
  IF OLD.status != NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO employee_user_id FROM employees WHERE id = NEW.employee_id;
    
    IF employee_user_id IS NOT NULL THEN
      PERFORM notify_user(
        employee_user_id,
        'Leave Request ' || INITCAP(NEW.status),
        'Your leave request from ' || NEW.start_date || ' to ' || NEW.end_date || ' has been ' || NEW.status,
        'leave',
        NEW.id,
        'leave_requests'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_leave_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_new_employee"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM notify_admins(
    'New Employee Added',
    NEW.name || ' has been added to the system',
    'employee',
    NEW.id,
    'employees'
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_new_employee"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_user"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_reference_table" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_table)
  VALUES (p_user_id, p_title, p_message, p_type, p_reference_id, p_reference_table);
END;
$$;


ALTER FUNCTION "public"."notify_user"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_all_leave_balances"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    updated_count integer := 0;
    settings_data json;
    default_days integer := 28;
    existing_settings_id uuid;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get default leave days from settings
    SELECT get_leave_settings_internal() INTO settings_data;
    IF settings_data IS NOT NULL AND settings_data->>'default_leave_days' IS NOT NULL THEN
        default_days := (settings_data->>'default_leave_days')::integer;
    END IF;

    -- Update all active employees' leave balances
    -- Fix: Remove updated_at since employees table doesn't have this column
    UPDATE employees 
    SET 
        remaining_leave_days = default_days,
        leave_taken = 0
    WHERE is_active = true OR is_active IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Update last_auto_reset_at in settings
    -- First check if record exists
    SELECT id INTO existing_settings_id
    FROM system_settings 
    WHERE setting_key = 'leave_settings'
    LIMIT 1;

    IF existing_settings_id IS NOT NULL THEN
        -- Update existing record
        UPDATE system_settings 
        SET 
            setting_value = jsonb_set(
                COALESCE(setting_value::jsonb, '{}'::jsonb),
                '{last_auto_reset_at}',
                to_jsonb(NOW()::text)
            ),
            updated_at = NOW()
        WHERE id = existing_settings_id;
    ELSE
        -- Insert new record
        INSERT INTO system_settings (setting_key, setting_value, description, created_at, updated_at)
        VALUES (
            'leave_settings',
            jsonb_set(
                COALESCE(settings_data::jsonb, '{}'::jsonb),
                '{last_auto_reset_at}',
                to_jsonb(NOW()::text)
            ),
            'Leave management settings',
            NOW(),
            NOW()
        );
    END IF;

    RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."reset_all_leave_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_historical_data_backfill"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  results JSONB;
  annual_count INTEGER;
  notes_count INTEGER;
BEGIN
  -- Run all backfill functions
  annual_count := backfill_annual_appraisal_responses();
  notes_count := backfill_compliance_notes_responses();
  
  -- Return summary
  results := jsonb_build_object(
    'annual_appraisals_migrated', annual_count,
    'compliance_notes_migrated', notes_count,
    'total_migrated', annual_count + notes_count,
    'migration_completed_at', NOW()
  );
  
  RETURN results;
END;
$$;


ALTER FUNCTION "public"."run_historical_data_backfill"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."run_historical_data_backfill"() IS 'Migrates historical compliance data from legacy tables to the unified questionnaire system. Safe to run multiple times.';



CREATE OR REPLACE FUNCTION "public"."run_leave_annual_reset_if_needed"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    settings_data json;
    fiscal_month integer := 4;
    fiscal_day integer := 1;
    enable_auto boolean := true;
    last_reset_date date;
    current_fiscal_start date;
    reset_count integer;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get fiscal year settings
    SELECT get_leave_settings_internal() INTO settings_data;
    
    IF settings_data IS NOT NULL THEN
        fiscal_month := COALESCE((settings_data->>'fiscal_year_start_month')::integer, 4);
        fiscal_day := COALESCE((settings_data->>'fiscal_year_start_day')::integer, 1);
        enable_auto := COALESCE((settings_data->>'enable_auto_reset')::boolean, true);
        
        IF settings_data->>'last_auto_reset_at' IS NOT NULL THEN
            last_reset_date := (settings_data->>'last_auto_reset_at')::date;
        END IF;
    END IF;

    -- If auto reset is disabled, return early
    IF NOT enable_auto THEN
        RETURN 'auto_reset_disabled';
    END IF;

    -- Calculate current fiscal year start date
    current_fiscal_start := make_date(
        CASE 
            WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= fiscal_month 
                 AND (EXTRACT(MONTH FROM CURRENT_DATE) > fiscal_month 
                      OR EXTRACT(DAY FROM CURRENT_DATE) >= fiscal_day)
            THEN EXTRACT(YEAR FROM CURRENT_DATE)::integer
            ELSE EXTRACT(YEAR FROM CURRENT_DATE)::integer - 1
        END,
        fiscal_month,
        fiscal_day
    );

    -- Check if reset is needed
    -- Reset if: current date >= fiscal start AND (no previous reset OR last reset was before current fiscal year)
    IF CURRENT_DATE >= current_fiscal_start 
       AND (last_reset_date IS NULL OR last_reset_date < current_fiscal_start) THEN
        
        -- Perform the reset
        SELECT reset_all_leave_balances() INTO reset_count;
        
        RETURN 'reset_performed';
    ELSE
        RETURN 'no_reset_needed';
    END IF;
END;
$$;


ALTER FUNCTION "public"."run_leave_annual_reset_if_needed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_client_compliance_statuses"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  records_updated INTEGER := 0;
  automation_settings RECORD;
BEGIN
  -- Get automation settings
  SELECT * INTO automation_settings 
  FROM compliance_automation_settings 
  LIMIT 1;
  
  -- Update overdue status for pending client records
  UPDATE client_compliance_period_records
  SET 
    is_overdue = true,
    status = 'overdue'
  WHERE 
    status = 'pending' 
    AND grace_period_end < CURRENT_DATE
    AND is_overdue = false;
    
  GET DIAGNOSTICS records_updated = ROW_COUNT;
  
  RETURN records_updated;
END;
$$;


ALTER FUNCTION "public"."update_client_compliance_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_compliance_automation_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_compliance_automation_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_compliance_statuses"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  records_updated INTEGER := 0;
  automation_settings RECORD;
BEGIN
  -- Get automation settings
  SELECT * INTO automation_settings 
  FROM compliance_automation_settings 
  LIMIT 1;
  
  -- Update overdue status for pending records
  UPDATE compliance_period_records
  SET 
    is_overdue = true,
    status = 'overdue'
  WHERE 
    status = 'pending' 
    AND grace_period_end < CURRENT_DATE
    AND is_overdue = false;
    
  GET DIAGNOSTICS records_updated = ROW_COUNT;
  
  RETURN records_updated;
END;
$$;


ALTER FUNCTION "public"."update_compliance_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_document_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  -- Only calculate status if expiry_date looks like a date (YYYY-MM-DD format)
  IF NEW.expiry_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    DECLARE 
      days_until_expiry INTEGER;
      expiry_date_value DATE;
    BEGIN
      -- Try to convert to date and calculate days until expiry
      expiry_date_value := NEW.expiry_date::DATE;
      days_until_expiry := expiry_date_value - CURRENT_DATE;
      
      -- Set status based on days until expiry
      IF days_until_expiry < 0 THEN
        NEW.status := 'expired';
      ELSIF days_until_expiry <= 30 THEN
        NEW.status := 'expiring';
      ELSE
        NEW.status := 'valid';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- If date conversion fails, set to valid
        NEW.status := 'valid';
    END;
  ELSE
    -- For text values, set status to valid
    NEW.status := 'valid';
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."update_document_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leave_status_with_balance"("p_leave_id" "uuid", "p_new_status" "text", "p_manager_notes" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    leave_record RECORD;
    leave_type_record RECORD;
    balance_result JSONB;
    final_result JSONB;
BEGIN
    -- Get leave details and lock the row
    SELECT * INTO leave_record
    FROM leave_requests 
    WHERE id = p_leave_id
    FOR UPDATE;
    
    -- Check if leave exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Leave request not found',
            'leave_id', p_leave_id
        );
    END IF;
    
    -- Get leave type details
    SELECT * INTO leave_type_record
    FROM leave_types
    WHERE id = leave_record.leave_type_id;
    
    -- Update leave status first
    UPDATE leave_requests
    SET 
        status = p_new_status,
        manager_notes = COALESCE(p_manager_notes, manager_notes),
        approved_date = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_date END,
        rejected_date = CASE WHEN p_new_status = 'rejected' THEN NOW() ELSE rejected_date END,
        approved_by = CASE WHEN p_new_status = 'approved' THEN COALESCE(p_user_id, approved_by) ELSE approved_by END,
        rejected_by = CASE WHEN p_new_status = 'rejected' THEN COALESCE(p_user_id, rejected_by) ELSE rejected_by END
    WHERE id = p_leave_id;
    
    -- Handle balance adjustments only for leave types that reduce balance
    IF leave_type_record.reduces_balance THEN
        -- Status change logic
        IF leave_record.status = 'approved' AND p_new_status != 'approved' THEN
            -- Was approved, now not approved - restore balance
            SELECT adjust_employee_leave_balance(
                leave_record.employee_id,
                leave_record.days_requested,
                'subtract'
            ) INTO balance_result;
        ELSIF leave_record.status != 'approved' AND p_new_status = 'approved' THEN
            -- Was not approved, now approved - deduct balance
            SELECT adjust_employee_leave_balance(
                leave_record.employee_id,
                leave_record.days_requested,
                'add'
            ) INTO balance_result;
        END IF;
    END IF;
    
    -- Build final result
    final_result := jsonb_build_object(
        'success', true,
        'leave_id', p_leave_id,
        'previous_status', leave_record.status,
        'new_status', p_new_status,
        'reduces_balance', COALESCE(leave_type_record.reduces_balance, false)
    );
    
    -- Add balance adjustment info if it occurred
    IF balance_result IS NOT NULL THEN
        final_result := final_result || jsonb_build_object('balance_adjustment', balance_result);
    END IF;
    
    RETURN final_result;
END;
$$;


ALTER FUNCTION "public"."update_leave_status_with_balance"("p_leave_id" "uuid", "p_new_status" "text", "p_manager_notes" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_employee_document"("p_employee_id" "uuid", "p_document" "jsonb", "p_country" "text" DEFAULT NULL::"text", "p_nationality_status" "text" DEFAULT NULL::"text", "p_branch_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tracker_id UUID;
  v_document_id TEXT;
  v_result JSONB;
BEGIN
  -- Check if document tracker exists for this employee
  SELECT id INTO v_tracker_id
  FROM document_tracker
  WHERE employee_id = p_employee_id;
  
  -- Handle metadata-only update (when p_document is NULL)
  IF p_document IS NULL THEN
    IF v_tracker_id IS NULL THEN
      -- Create new tracker with no documents, just metadata
      INSERT INTO document_tracker (
        employee_id,
        branch_id,
        country,
        nationality_status,
        documents,
        created_at,
        updated_at
      ) VALUES (
        p_employee_id,
        p_branch_id,
        p_country,
        p_nationality_status,
        '[]'::jsonb,
        now(),
        now()
      ) RETURNING id INTO v_tracker_id;
    ELSE
      -- Update only metadata fields
      UPDATE document_tracker
      SET 
        country = COALESCE(p_country, country),
        nationality_status = COALESCE(p_nationality_status, nationality_status),
        branch_id = COALESCE(p_branch_id, branch_id),
        updated_at = now()
      WHERE id = v_tracker_id;
    END IF;
    
    v_result := jsonb_build_object(
      'tracker_id', v_tracker_id,
      'document', NULL
    );
    
    RETURN v_result;
  END IF;
  
  -- Handle document upsert (when p_document is NOT NULL)
  -- Generate a document ID if not provided
  IF p_document->>'id' IS NULL THEN
    v_document_id := gen_random_uuid()::TEXT;
    p_document := jsonb_set(p_document, '{id}', to_jsonb(v_document_id));
  ELSE
    v_document_id := p_document->>'id';
  END IF;
  
  -- Add timestamps if not present
  IF p_document->>'created_at' IS NULL THEN
    p_document := jsonb_set(p_document, '{created_at}', to_jsonb(now()::TEXT));
  END IF;
  p_document := jsonb_set(p_document, '{updated_at}', to_jsonb(now()::TEXT));
  
  IF v_tracker_id IS NULL THEN
    -- Create new tracker with the document
    INSERT INTO document_tracker (
      employee_id,
      branch_id,
      country,
      nationality_status,
      documents,
      created_at,
      updated_at
    ) VALUES (
      p_employee_id,
      p_branch_id,
      p_country,
      p_nationality_status,
      jsonb_build_array(p_document),
      now(),
      now()
    ) RETURNING id INTO v_tracker_id;
  ELSE
    -- Check if document with this ID already exists
    IF EXISTS (
      SELECT 1 FROM document_tracker dt,
      jsonb_array_elements(dt.documents) AS doc
      WHERE dt.id = v_tracker_id
      AND doc->>'id' = v_document_id
    ) THEN
      -- Update existing document
      UPDATE document_tracker
      SET 
        documents = (
          SELECT jsonb_agg(
            CASE 
              WHEN doc->>'id' = v_document_id THEN p_document
              ELSE doc
            END
          )
          FROM jsonb_array_elements(documents) AS doc
        ),
        updated_at = now(),
        country = COALESCE(p_country, country),
        nationality_status = COALESCE(p_nationality_status, nationality_status),
        branch_id = COALESCE(p_branch_id, branch_id)
      WHERE id = v_tracker_id;
    ELSE
      -- Add new document to array
      UPDATE document_tracker
      SET 
        documents = documents || p_document,
        updated_at = now(),
        country = COALESCE(p_country, country),
        nationality_status = COALESCE(p_nationality_status, nationality_status),
        branch_id = COALESCE(p_branch_id, branch_id)
      WHERE id = v_tracker_id;
    END IF;
  END IF;
  
  -- Return the result
  v_result := jsonb_build_object(
    'tracker_id', v_tracker_id,
    'document', p_document
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."upsert_employee_document"("p_employee_id" "uuid", "p_document" "jsonb", "p_country" "text", "p_nationality_status" "text", "p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_permission"("user_id" "uuid", "perm_type" "text", "perm_key" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT granted FROM user_permissions 
     WHERE user_permissions.user_id = user_has_permission.user_id 
     AND permission_type = perm_type 
     AND permission_key = perm_key),
    true -- Default to true if no specific permission is set
  );
$$;


ALTER FUNCTION "public"."user_has_permission"("user_id" "uuid", "perm_type" "text", "perm_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_password"("password_input" "text", "password_hash" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (password_hash = crypt(password_input, password_hash));
END;
$$;


ALTER FUNCTION "public"."verify_password"("password_input" "text", "password_hash" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."annual_appraisals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_title" "text" NOT NULL,
    "appraisal_date" "date" NOT NULL,
    "year" integer NOT NULL,
    "ratings" "jsonb" NOT NULL,
    "comments_manager" "text",
    "comments_employee" "text",
    "signature_manager" "text" NOT NULL,
    "signature_employee" "text" NOT NULL,
    "action_training" "text",
    "action_career" "text",
    "action_plan" "text"
);


ALTER TABLE "public"."annual_appraisals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid",
    "document_type" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."application_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."care_worker_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "care_worker_name" "text" NOT NULL,
    "client_name" "text" NOT NULL,
    "client_address" "text" NOT NULL,
    "report_date" "date" NOT NULL,
    "statement" "text",
    "person_completing_report" "text",
    "position" "text",
    "digital_signature" "text",
    "completion_date" "date",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "assigned_employee_id" "uuid",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid",
    "updated_by" "uuid",
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."care_worker_statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_compliance_period_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_compliance_type_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "period_identifier" "text" NOT NULL,
    "completion_date" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "notes" "text",
    "completion_method" "text" DEFAULT 'spotcheck'::"text",
    "auto_generated" boolean DEFAULT false,
    "is_overdue" boolean DEFAULT false,
    "grace_period_end" "date",
    "next_due_date" "date",
    "completed_by" "uuid",
    "last_notification_sent" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."client_compliance_period_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_compliance_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "frequency" "text" DEFAULT 'quarterly'::"text" NOT NULL,
    "has_questionnaire" boolean DEFAULT false,
    "questionnaire_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_compliance_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_spot_check_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "compliance_record_id" "uuid",
    "service_user_name" "text" NOT NULL,
    "care_workers" "text" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone,
    "performed_by" "text" NOT NULL,
    "observations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."client_spot_check_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "branch_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "tagline" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "logo" "text"
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_automation_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_generate_records" boolean DEFAULT true NOT NULL,
    "grace_period_days" integer DEFAULT 7 NOT NULL,
    "notification_days_before" integer DEFAULT 14 NOT NULL,
    "escalation_days" integer DEFAULT 30 NOT NULL,
    "auto_archive_completed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."compliance_automation_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_data_retention" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compliance_type_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "period_type" "text" NOT NULL,
    "period_identifier" "text" NOT NULL,
    "data_summary" "jsonb",
    "archive_due_date" "date",
    "download_available_date" "date",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retention_policy_years" integer DEFAULT 6,
    "archival_status" "text" DEFAULT 'pending'::"text",
    "archival_started_at" timestamp with time zone,
    "archival_completed_at" timestamp with time zone,
    "download_requested_at" timestamp with time zone,
    "total_records_archived" integer DEFAULT 0,
    "completion_statistics" "jsonb" DEFAULT '{}'::"jsonb",
    "archival_notes" "text",
    CONSTRAINT "compliance_data_retention_archival_status_check" CHECK (("archival_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'archived'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."compliance_data_retention" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_period_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compliance_type_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "period_identifier" "text" NOT NULL,
    "completion_date" "text" NOT NULL,
    "next_due_date" "date",
    "completed_by" "uuid",
    "notes" "text",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completion_method" "text" DEFAULT 'date_entry'::"text",
    "is_overdue" boolean DEFAULT false,
    "grace_period_end" "date",
    "auto_generated" boolean DEFAULT false,
    "last_notification_sent" timestamp with time zone,
    "form_data" "jsonb",
    "created_by" "uuid",
    "updated_by" "uuid",
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."compliance_period_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."compliance_period_records"."form_data" IS 'Structured form payload (e.g., medication competency). Notes should remain free-text.';



CREATE TABLE IF NOT EXISTS "public"."compliance_questionnaire_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "questionnaire_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compliance_questionnaire_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_questionnaire_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compliance_record_id" "uuid" NOT NULL,
    "questionnaire_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compliance_questionnaire_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_questionnaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "compliance_type_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."compliance_questionnaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_text" "text" NOT NULL,
    "question_type" "text" DEFAULT 'yes_no'::"text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "options" "jsonb",
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comment_required_for_yes" boolean DEFAULT false,
    "comment_required_for_no" boolean DEFAULT false,
    "requires_comment_on_yes" boolean DEFAULT false,
    "requires_comment_on_no" boolean DEFAULT false,
    "comment_prompt" "text",
    "allow_multiple_selection" boolean DEFAULT false,
    "conditional_logic" "jsonb",
    "is_template" boolean DEFAULT false,
    "template_group" "text",
    "is_trigger_question" boolean DEFAULT false,
    "repeating_template_id" "uuid",
    "trigger_entity_label" "text" DEFAULT 'Entity'::"text",
    "max_entities" integer DEFAULT 10,
    "section" "text",
    "help_text" "text",
    "dynamic_generation_rule" "jsonb",
    "repeatable" boolean DEFAULT false
);


ALTER TABLE "public"."compliance_questions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."compliance_questions"."comment_required_for_yes" IS 'Whether a comment is required when user selects Yes for yes_no questions';



COMMENT ON COLUMN "public"."compliance_questions"."comment_required_for_no" IS 'Whether a comment is required when user selects No for yes_no questions';



COMMENT ON COLUMN "public"."compliance_questions"."requires_comment_on_yes" IS 'Whether selecting "Yes" for this yes/no question requires a comment';



COMMENT ON COLUMN "public"."compliance_questions"."requires_comment_on_no" IS 'Whether selecting "No" for this yes/no question requires a comment';



COMMENT ON COLUMN "public"."compliance_questions"."comment_prompt" IS 'Custom prompt text for the comment field (optional)';



COMMENT ON COLUMN "public"."compliance_questions"."allow_multiple_selection" IS 'Whether multiple choice questions allow selecting multiple options';



COMMENT ON COLUMN "public"."compliance_questions"."conditional_logic" IS 'JSON object defining conditions for when this question should appear';



COMMENT ON COLUMN "public"."compliance_questions"."is_template" IS 'Whether this question is a template that gets repeated for multiple entities';



COMMENT ON COLUMN "public"."compliance_questions"."template_group" IS 'Group identifier for questions that belong to the same template set';



COMMENT ON COLUMN "public"."compliance_questions"."is_trigger_question" IS 'Whether this question triggers dynamic entity collection';



COMMENT ON COLUMN "public"."compliance_questions"."repeating_template_id" IS 'ID of the repeating template to use when this trigger is activated';



COMMENT ON COLUMN "public"."compliance_questions"."trigger_entity_label" IS 'Label for entities (e.g., "Service User", "Location")';



COMMENT ON COLUMN "public"."compliance_questions"."max_entities" IS 'Maximum number of entities allowed for this trigger';



CREATE TABLE IF NOT EXISTS "public"."compliance_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_id" "uuid" NOT NULL,
    "compliance_task_id" "uuid" NOT NULL,
    "completion_date" "date" NOT NULL,
    "next_due_date" "date" NOT NULL,
    "completed_by" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."compliance_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "questionnaire_response_id" "uuid" NOT NULL,
    "question_id" "text" NOT NULL,
    "response_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dynamic_question_key" "text",
    "entity_reference" "text",
    CONSTRAINT "check_question_id_format" CHECK ((("question_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") OR ("question_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_comment$'::"text")))
);


ALTER TABLE "public"."compliance_responses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."compliance_responses"."question_id" IS 'Question ID - can be a UUID for regular questions or UUID_comment for comment responses';



COMMENT ON COLUMN "public"."compliance_responses"."dynamic_question_key" IS 'Key for dynamically generated questions (e.g., serviceuser_1_question_123)';



COMMENT ON COLUMN "public"."compliance_responses"."entity_reference" IS 'Reference to the entity this response relates to (e.g., service user name)';



CREATE TABLE IF NOT EXISTS "public"."compliance_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_generate_periods" boolean DEFAULT true NOT NULL,
    "reminder_days_before" integer DEFAULT 7 NOT NULL,
    "email_notifications" boolean DEFAULT true NOT NULL,
    "archive_completed_records" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."compliance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    CONSTRAINT "compliance_tasks_frequency_check" CHECK (("frequency" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annually'::"text"])))
);


ALTER TABLE "public"."compliance_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "frequency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "questionnaire_id" "uuid",
    "has_questionnaire" boolean DEFAULT false,
    "target_table" "text" DEFAULT 'employees'::"text" NOT NULL,
    "visible_in_employee_portal" boolean DEFAULT true NOT NULL,
    CONSTRAINT "compliance_types_target_table_check" CHECK (("target_table" = ANY (ARRAY['employees'::"text", 'clients'::"text"])))
);


ALTER TABLE "public"."compliance_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."compliance_types" IS 'RLS completely disabled - full CRUD access allowed for development';



COMMENT ON COLUMN "public"."compliance_types"."target_table" IS 'Specifies whether this compliance type applies to employees or clients';



CREATE TABLE IF NOT EXISTS "public"."document_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expiry_threshold_days" integer DEFAULT 30 NOT NULL,
    "email_notifications" boolean DEFAULT true NOT NULL,
    "auto_reminders" boolean DEFAULT true NOT NULL,
    "reminder_frequency" character varying DEFAULT 'weekly'::character varying NOT NULL
);


ALTER TABLE "public"."document_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "file_path" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_tracker" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "document_type_id" "uuid",
    "branch_id" "uuid",
    "issue_date" "text",
    "expiry_date" "text",
    "document_number" character varying(255),
    "status" character varying(50) DEFAULT 'valid'::character varying,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "country" character varying(255),
    "nationality_status" character varying(50),
    "documents" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "expiry_after_issue" CHECK (("expiry_date" > "issue_date"))
);


ALTER TABLE "public"."document_tracker" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_tracker" IS 'Stores employee documents in a JSONB array. Each employee has one row with all their documents in the documents column.';



CREATE TABLE IF NOT EXISTS "public"."document_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL
);


ALTER TABLE "public"."document_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "working_hours" numeric,
    "remaining_leave_days" numeric DEFAULT 28,
    "leave_taken" numeric DEFAULT 0,
    "user_id" "uuid",
    "employee_code" character varying(20) NOT NULL,
    "job_title" character varying(100),
    "branch_id" "uuid",
    "leave_allowance" integer DEFAULT 28,
    "employee_type" character varying(50) DEFAULT 'regular'::character varying,
    "hours_restriction" character varying(50),
    "sponsored" boolean DEFAULT false,
    "twenty_hours" boolean DEFAULT false,
    "password_hash" "text" NOT NULL,
    "must_change_password" boolean DEFAULT true,
    "last_login" timestamp with time zone,
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "is_active" boolean DEFAULT true
);

ALTER TABLE ONLY "public"."employees" REPLICA IDENTITY FULL;


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_application_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "setting_type" "text",
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_application_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "position_id" "uuid",
    "personal_info" "jsonb" NOT NULL,
    "availability" "jsonb",
    "employment_history" "jsonb",
    "skills_experience" "jsonb",
    "declarations" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consent" "jsonb",
    "reference_info" "jsonb",
    "emergency_contact" "jsonb"
);


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_id" "uuid" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_date" timestamp with time zone,
    "rejected_date" timestamp with time zone,
    "manager_notes" "text",
    "approved_by" "uuid",
    "days_requested" integer,
    "rejected_by" "uuid",
    CONSTRAINT "leave_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_leave_days" integer DEFAULT 28 NOT NULL,
    "carry_over_enabled" boolean DEFAULT true NOT NULL,
    "manager_approval_required" boolean DEFAULT true NOT NULL,
    "max_carry_over_days" integer DEFAULT 5
);


ALTER TABLE "public"."leave_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "reduces_balance" boolean DEFAULT true,
    "reduces_allowance" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."leave_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days" integer NOT NULL,
    "notes" "text",
    "manager_notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "approved_by" "text",
    "approved_date" timestamp with time zone,
    "rejected_by" "text",
    "rejected_date" timestamp with time zone
);


ALTER TABLE "public"."leaves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "reference_id" "uuid",
    "reference_table" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['leave'::"text", 'compliance'::"text", 'document'::"text", 'employee'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reference_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "reference_type" "text" DEFAULT 'character'::"text" NOT NULL,
    "applicant_name" "text" NOT NULL,
    "applicant_address" "text" NOT NULL,
    "applicant_postcode" "text" NOT NULL,
    "position_applied_for" "text",
    "reference_email" "text" NOT NULL,
    "reference_name" "text" NOT NULL,
    "reference_company" "text",
    "reference_address" "text",
    "company_name" "text",
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "completed_at" timestamp with time zone,
    "reference_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "form_data" "jsonb",
    "is_expired" boolean DEFAULT false,
    CONSTRAINT "reference_requests_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['employer'::"text", 'character'::"text"]))),
    CONSTRAINT "reference_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."reference_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repeating_question_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."repeating_question_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."repeating_question_templates" IS 'Stores reusable question templates for dynamic forms';



CREATE TABLE IF NOT EXISTS "public"."repeating_template_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."repeating_template_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."repeating_template_questions" IS 'Links questions to templates with ordering';



CREATE TABLE IF NOT EXISTS "public"."signed_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signing_request_id" "uuid" NOT NULL,
    "final_document_path" "text" NOT NULL,
    "completion_data" "jsonb" DEFAULT '{}'::"jsonb",
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."signed_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signing_request_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signing_request_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "recipient_name" "text" NOT NULL,
    "signing_order" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "signed_at" timestamp with time zone,
    "access_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expired_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    CONSTRAINT "signing_request_recipients_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'signed'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."signing_request_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signing_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "created_by" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "signing_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signing_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."signing_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spot_check_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "service_user_name" "text" NOT NULL,
    "care_worker1" "text" NOT NULL,
    "care_worker2" "text",
    "check_date" "date" NOT NULL,
    "time_from" "text" NOT NULL,
    "time_to" "text" NOT NULL,
    "carried_by" "text" NOT NULL,
    "observations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "employee_id" "uuid",
    "compliance_type_id" "uuid",
    "period_identifier" "text"
);


ALTER TABLE "public"."spot_check_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "setting_key" character varying NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "field_name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "x_position" numeric NOT NULL,
    "y_position" numeric NOT NULL,
    "width" numeric NOT NULL,
    "height" numeric NOT NULL,
    "page_number" integer DEFAULT 1 NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "placeholder_text" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "template_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'date'::"text", 'signature'::"text", 'checkbox'::"text"])))
);


ALTER TABLE "public"."template_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_branch_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_branch_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_branch_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_branch_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_menu_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "menu_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_menu_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission_type" "text" NOT NULL,
    "permission_key" "text" NOT NULL,
    "granted" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "email" "text",
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'hr'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."annual_appraisals"
    ADD CONSTRAINT "annual_appraisals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."care_worker_statements"
    ADD CONSTRAINT "care_worker_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_compliance_period_records"
    ADD CONSTRAINT "client_compliance_period_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_compliance_period_records"
    ADD CONSTRAINT "client_compliance_period_records_unique" UNIQUE ("client_compliance_type_id", "client_id", "period_identifier");



ALTER TABLE ONLY "public"."client_compliance_types"
    ADD CONSTRAINT "client_compliance_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_spot_check_records"
    ADD CONSTRAINT "client_spot_check_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_automation_settings"
    ADD CONSTRAINT "compliance_automation_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_data_retention"
    ADD CONSTRAINT "compliance_data_retention_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_period_records"
    ADD CONSTRAINT "compliance_period_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_questionnaire_questions"
    ADD CONSTRAINT "compliance_questionnaire_quest_questionnaire_id_question_id_key" UNIQUE ("questionnaire_id", "question_id");



ALTER TABLE ONLY "public"."compliance_questionnaire_questions"
    ADD CONSTRAINT "compliance_questionnaire_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_questionnaire_responses"
    ADD CONSTRAINT "compliance_questionnaire_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_questionnaires"
    ADD CONSTRAINT "compliance_questionnaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_questionnaires"
    ADD CONSTRAINT "compliance_questionnaires_type_branch_unique" UNIQUE ("compliance_type_id", "branch_id");



ALTER TABLE ONLY "public"."compliance_questions"
    ADD CONSTRAINT "compliance_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_records"
    ADD CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_responses"
    ADD CONSTRAINT "compliance_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_settings"
    ADD CONSTRAINT "compliance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_tasks"
    ADD CONSTRAINT "compliance_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_types"
    ADD CONSTRAINT "compliance_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_settings"
    ADD CONSTRAINT "document_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_tracker"
    ADD CONSTRAINT "document_tracker_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."document_tracker"
    ADD CONSTRAINT "document_tracker_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_types"
    ADD CONSTRAINT "document_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."document_types"
    ADD CONSTRAINT "document_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_code_unique" UNIQUE ("employee_code");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_application_settings"
    ADD CONSTRAINT "job_application_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_settings"
    ADD CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reference_requests"
    ADD CONSTRAINT "reference_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reference_requests"
    ADD CONSTRAINT "reference_requests_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."repeating_question_templates"
    ADD CONSTRAINT "repeating_question_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repeating_template_questions"
    ADD CONSTRAINT "repeating_template_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signed_documents"
    ADD CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signing_request_recipients"
    ADD CONSTRAINT "signing_request_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spot_check_records"
    ADD CONSTRAINT "spot_check_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."template_fields"
    ADD CONSTRAINT "template_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_user_id_branch_id_key" UNIQUE ("user_id", "branch_id");



ALTER TABLE ONLY "public"."user_branch_permissions"
    ADD CONSTRAINT "user_branch_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_permissions"
    ADD CONSTRAINT "user_branch_permissions_user_id_branch_id_key" UNIQUE ("user_id", "branch_id");



ALTER TABLE ONLY "public"."user_menu_permissions"
    ADD CONSTRAINT "user_menu_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_menu_permissions"
    ADD CONSTRAINT "user_menu_permissions_user_id_menu_path_key" UNIQUE ("user_id", "menu_path");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_permission_type_permission_key_key" UNIQUE ("user_id", "permission_type", "permission_key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "annual_appraisals_year_idx" ON "public"."annual_appraisals" USING "btree" ("year");



CREATE INDEX "idx_care_worker_statements_branch_id" ON "public"."care_worker_statements" USING "btree" ("branch_id");



CREATE INDEX "idx_compliance_data_retention_archive_dates" ON "public"."compliance_data_retention" USING "btree" ("archive_due_date", "download_available_date");



CREATE INDEX "idx_compliance_data_retention_due_date" ON "public"."compliance_data_retention" USING "btree" ("archive_due_date");



CREATE INDEX "idx_compliance_data_retention_status" ON "public"."compliance_data_retention" USING "btree" ("archival_status");



CREATE INDEX "idx_compliance_data_retention_type_year" ON "public"."compliance_data_retention" USING "btree" ("compliance_type_id", "year");



CREATE INDEX "idx_compliance_period_records_dates" ON "public"."compliance_period_records" USING "btree" ("completion_date", "next_due_date");



CREATE INDEX "idx_compliance_period_records_employee" ON "public"."compliance_period_records" USING "btree" ("employee_id");



CREATE INDEX "idx_compliance_period_records_type_period" ON "public"."compliance_period_records" USING "btree" ("compliance_type_id", "period_identifier");



CREATE INDEX "idx_compliance_questionnaires_branch" ON "public"."compliance_questionnaires" USING "btree" ("branch_id");



CREATE INDEX "idx_compliance_questions_template" ON "public"."compliance_questions" USING "btree" ("is_template", "template_group");



CREATE INDEX "idx_compliance_records_completed_by" ON "public"."compliance_records" USING "btree" ("completed_by");



CREATE INDEX "idx_compliance_responses_dynamic" ON "public"."compliance_responses" USING "btree" ("dynamic_question_key", "entity_reference");



CREATE INDEX "idx_compliance_responses_migrated" ON "public"."compliance_questionnaire_responses" USING "btree" ("compliance_record_id") WHERE ("compliance_record_id" IS NOT NULL);



CREATE INDEX "idx_document_tracker_branch_id" ON "public"."document_tracker" USING "btree" ("branch_id");



CREATE INDEX "idx_document_tracker_country" ON "public"."document_tracker" USING "btree" ("country");



CREATE INDEX "idx_document_tracker_documents_gin" ON "public"."document_tracker" USING "gin" ("documents");



CREATE INDEX "idx_document_tracker_employee_id" ON "public"."document_tracker" USING "btree" ("employee_id");



CREATE INDEX "idx_document_tracker_expiry_date" ON "public"."document_tracker" USING "btree" ("expiry_date");



CREATE INDEX "idx_document_tracker_status" ON "public"."document_tracker" USING "btree" ("status");



CREATE INDEX "idx_job_application_settings_category" ON "public"."job_application_settings" USING "btree" ("category");



CREATE INDEX "idx_job_application_settings_key" ON "public"."job_application_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_job_application_settings_type" ON "public"."job_application_settings" USING "btree" ("setting_type");



CREATE INDEX "idx_job_applications_created_at" ON "public"."job_applications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_job_applications_personal_info" ON "public"."job_applications" USING "gin" ("personal_info");



CREATE INDEX "idx_job_applications_position_id" ON "public"."job_applications" USING "btree" ("position_id");



CREATE INDEX "idx_job_applications_status" ON "public"."job_applications" USING "btree" ("status");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_reference_requests_application_id" ON "public"."reference_requests" USING "btree" ("application_id");



CREATE INDEX "idx_reference_requests_token" ON "public"."reference_requests" USING "btree" ("token");



CREATE INDEX "idx_repeating_template_questions_order" ON "public"."repeating_template_questions" USING "btree" ("template_id", "order_index");



CREATE INDEX "idx_repeating_template_questions_template_id" ON "public"."repeating_template_questions" USING "btree" ("template_id");



CREATE INDEX "idx_signed_documents_signing_request_id" ON "public"."signed_documents" USING "btree" ("signing_request_id");



CREATE INDEX "idx_signing_recipients_status_expired" ON "public"."signing_request_recipients" USING "btree" ("status", "expired_at");



CREATE INDEX "idx_signing_request_recipients_access_token" ON "public"."signing_request_recipients" USING "btree" ("access_token");



CREATE INDEX "idx_signing_request_recipients_signing_request_id" ON "public"."signing_request_recipients" USING "btree" ("signing_request_id");



CREATE INDEX "idx_signing_requests_signing_token" ON "public"."signing_requests" USING "btree" ("signing_token");



CREATE INDEX "idx_spot_check_records_check_date" ON "public"."spot_check_records" USING "btree" ("check_date");



CREATE INDEX "idx_spot_check_records_created_by" ON "public"."spot_check_records" USING "btree" ("created_by");



CREATE INDEX "idx_spot_check_records_employee" ON "public"."spot_check_records" USING "btree" ("employee_id");



CREATE INDEX "idx_spot_check_records_type_period" ON "public"."spot_check_records" USING "btree" ("compliance_type_id", "period_identifier");



CREATE INDEX "idx_template_fields_template_id" ON "public"."template_fields" USING "btree" ("template_id");



CREATE INDEX "idx_user_branch_permissions_branch_id" ON "public"."user_branch_permissions" USING "btree" ("branch_id");



CREATE INDEX "idx_user_branch_permissions_user_id" ON "public"."user_branch_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_user_menu_permissions_user_id" ON "public"."user_menu_permissions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "after_user_roles_delete" AFTER DELETE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_auth_user_on_role_delete"();



CREATE OR REPLACE TRIGGER "calculate_leave_days_trigger" BEFORE INSERT OR UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_leave_days"();



CREATE OR REPLACE TRIGGER "expire_signed_link_trigger" BEFORE UPDATE ON "public"."signing_request_recipients" FOR EACH ROW EXECUTE FUNCTION "public"."expire_signed_link_on_access"();



CREATE OR REPLACE TRIGGER "expire_signing_link_trigger" BEFORE UPDATE ON "public"."signing_request_recipients" FOR EACH ROW EXECUTE FUNCTION "public"."expire_signing_link_on_completion"();



CREATE OR REPLACE TRIGGER "on_compliance_overdue" AFTER UPDATE ON "public"."compliance_period_records" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_compliance_overdue"();



CREATE OR REPLACE TRIGGER "on_document_expiring" AFTER INSERT OR UPDATE ON "public"."document_tracker" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_document_expiring"();



CREATE OR REPLACE TRIGGER "on_employee_created" AFTER INSERT ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_new_employee"();



CREATE OR REPLACE TRIGGER "on_leave_request_created" AFTER INSERT ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_leave_request"();



CREATE OR REPLACE TRIGGER "on_leave_status_updated" AFTER UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_leave_status_change"();



CREATE OR REPLACE TRIGGER "signing_expiration_check" BEFORE UPDATE ON "public"."signing_request_recipients" FOR EACH ROW EXECUTE FUNCTION "public"."check_signing_expiration"();



CREATE OR REPLACE TRIGGER "trg_calculate_leave_days" BEFORE INSERT OR UPDATE OF "start_date", "end_date" ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_leave_days"();



CREATE OR REPLACE TRIGGER "trg_compliance_automation_settings_updated_at" BEFORE UPDATE ON "public"."compliance_automation_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_compliance_automation_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trg_expire_signed_link_on_access" BEFORE UPDATE OF "access_count" ON "public"."signing_request_recipients" FOR EACH ROW EXECUTE FUNCTION "public"."expire_signed_link_on_access"();



CREATE OR REPLACE TRIGGER "trg_update_document_status" BEFORE INSERT OR UPDATE OF "expiry_date" ON "public"."document_tracker" FOR EACH ROW EXECUTE FUNCTION "public"."update_document_status"();



CREATE OR REPLACE TRIGGER "update_care_worker_statements_updated_at" BEFORE UPDATE ON "public"."care_worker_statements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_compliance_period_records_updated_at" BEFORE UPDATE ON "public"."client_compliance_period_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_compliance_types_updated_at" BEFORE UPDATE ON "public"."client_compliance_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_spot_check_records_updated_at" BEFORE UPDATE ON "public"."client_spot_check_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_settings_updated_at" BEFORE UPDATE ON "public"."company_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_automation_settings_updated_at" BEFORE UPDATE ON "public"."compliance_automation_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_compliance_automation_settings_updated_at"();



CREATE OR REPLACE TRIGGER "update_compliance_questionnaire_responses_updated_at" BEFORE UPDATE ON "public"."compliance_questionnaire_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_questionnaires_updated_at" BEFORE UPDATE ON "public"."compliance_questionnaires" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_questions_updated_at" BEFORE UPDATE ON "public"."compliance_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_responses_updated_at" BEFORE UPDATE ON "public"."compliance_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_settings_updated_at" BEFORE UPDATE ON "public"."compliance_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_document_settings_updated_at" BEFORE UPDATE ON "public"."document_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_document_status_trigger" BEFORE INSERT OR UPDATE ON "public"."document_tracker" FOR EACH ROW EXECUTE FUNCTION "public"."update_document_status"();



CREATE OR REPLACE TRIGGER "update_document_templates_updated_at" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_job_application_settings_updated_at" BEFORE UPDATE ON "public"."job_application_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_job_applications_updated_at" BEFORE UPDATE ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leave_settings_updated_at" BEFORE UPDATE ON "public"."leave_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reference_requests_updated_at" BEFORE UPDATE ON "public"."reference_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_repeating_templates_updated_at" BEFORE UPDATE ON "public"."repeating_question_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_signing_requests_updated_at" BEFORE UPDATE ON "public"."signing_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_spot_check_records_updated_at" BEFORE UPDATE ON "public"."spot_check_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."care_worker_statements"
    ADD CONSTRAINT "care_worker_statements_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."care_worker_statements"
    ADD CONSTRAINT "care_worker_statements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."care_worker_statements"
    ADD CONSTRAINT "care_worker_statements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."client_compliance_period_records"
    ADD CONSTRAINT "client_compliance_period_records_client_compliance_type_id_fkey" FOREIGN KEY ("client_compliance_type_id") REFERENCES "public"."client_compliance_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_compliance_period_records"
    ADD CONSTRAINT "client_compliance_period_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_spot_check_records"
    ADD CONSTRAINT "client_spot_check_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."compliance_data_retention"
    ADD CONSTRAINT "compliance_data_retention_compliance_type_id_fkey" FOREIGN KEY ("compliance_type_id") REFERENCES "public"."compliance_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_period_records"
    ADD CONSTRAINT "compliance_period_records_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."compliance_period_records"
    ADD CONSTRAINT "compliance_period_records_compliance_type_id_fkey" FOREIGN KEY ("compliance_type_id") REFERENCES "public"."compliance_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_period_records"
    ADD CONSTRAINT "compliance_period_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_questionnaire_questions"
    ADD CONSTRAINT "compliance_questionnaire_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."compliance_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_questionnaire_questions"
    ADD CONSTRAINT "compliance_questionnaire_questions_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."compliance_questionnaires"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_questionnaire_responses"
    ADD CONSTRAINT "compliance_questionnaire_responses_compliance_record_id_fkey" FOREIGN KEY ("compliance_record_id") REFERENCES "public"."compliance_period_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_questionnaire_responses"
    ADD CONSTRAINT "compliance_questionnaire_responses_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."compliance_questionnaires"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_questionnaires"
    ADD CONSTRAINT "compliance_questionnaires_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."compliance_questionnaires"
    ADD CONSTRAINT "compliance_questionnaires_compliance_type_id_fkey" FOREIGN KEY ("compliance_type_id") REFERENCES "public"."compliance_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_records"
    ADD CONSTRAINT "compliance_records_compliance_task_id_fkey" FOREIGN KEY ("compliance_task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_records"
    ADD CONSTRAINT "compliance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_responses"
    ADD CONSTRAINT "compliance_responses_questionnaire_response_id_fkey" FOREIGN KEY ("questionnaire_response_id") REFERENCES "public"."compliance_questionnaire_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_types"
    ADD CONSTRAINT "compliance_types_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."compliance_questionnaires"("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."document_tracker"
    ADD CONSTRAINT "document_tracker_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_tracker"
    ADD CONSTRAINT "document_tracker_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id");



ALTER TABLE ONLY "public"."document_tracker"
    ADD CONSTRAINT "document_tracker_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."care_worker_statements"
    ADD CONSTRAINT "fk_care_worker_statements_assigned_employee" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."compliance_records"
    ADD CONSTRAINT "fk_compliance_records_completed_by" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signed_documents"
    ADD CONSTRAINT "signed_documents_signing_request_id_fkey" FOREIGN KEY ("signing_request_id") REFERENCES "public"."signing_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signing_request_recipients"
    ADD CONSTRAINT "signing_request_recipients_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."signing_request_recipients"
    ADD CONSTRAINT "signing_request_recipients_signing_request_id_fkey" FOREIGN KEY ("signing_request_id") REFERENCES "public"."signing_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_fields"
    ADD CONSTRAINT "template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_permissions"
    ADD CONSTRAINT "user_branch_permissions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_permissions"
    ADD CONSTRAINT "user_branch_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_menu_permissions"
    ADD CONSTRAINT "user_menu_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can do everything" ON "public"."compliance_records" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can do everything" ON "public"."compliance_tasks" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can do everything" ON "public"."leave_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage all branch access" ON "public"."user_branch_access" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all statements" ON "public"."care_worker_statements" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage all user permissions" ON "public"."user_permissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all user roles" ON "public"."user_roles" TO "authenticated" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage annual appraisals" ON "public"."annual_appraisals" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage application documents" ON "public"."application_documents" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage client compliance types" ON "public"."client_compliance_types" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage clients" ON "public"."clients" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage compliance automation settings" ON "public"."compliance_automation_settings" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage compliance data retention" ON "public"."compliance_data_retention" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage compliance questionnaires" ON "public"."compliance_questionnaires" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage compliance questions" ON "public"."compliance_questions" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage compliance_types" ON "public"."compliance_types" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage document templates" ON "public"."document_templates" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage job application settings" ON "public"."job_application_settings" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage job applications" ON "public"."job_applications" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage leave_types" ON "public"."leave_types" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage leaves" ON "public"."leaves" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage questionnaire questions" ON "public"."compliance_questionnaire_questions" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage reference requests" ON "public"."reference_requests" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage repeating templates" ON "public"."repeating_question_templates" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage signed documents" ON "public"."signed_documents" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage signing request recipients" ON "public"."signing_request_recipients" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage signing requests" ON "public"."signing_requests" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage spot_check_records" ON "public"."spot_check_records" TO "authenticated" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage system settings" ON "public"."system_settings" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage template fields" ON "public"."template_fields" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Admins can manage template questions" ON "public"."repeating_template_questions" USING ("public"."is_admin_user"()) WITH CHECK ("public"."is_admin_user"());



CREATE POLICY "Allow all authenticated users to view compliance data retention" ON "public"."compliance_data_retention" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow anonymous delete access to employees" ON "public"."employees" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow anonymous insert access to employees" ON "public"."employees" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow anonymous read access to employees" ON "public"."employees" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow anonymous update access to employees" ON "public"."employees" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public access to client compliance period records" ON "public"."client_compliance_period_records" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public access to client spot check records" ON "public"."client_spot_check_records" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public access to compliance settings" ON "public"."compliance_settings" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public access to document settings" ON "public"."document_settings" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public access to leave settings" ON "public"."leave_settings" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public delete access to branches" ON "public"."branches" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to company settings" ON "public"."company_settings" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public delete access to compliance period records" ON "public"."compliance_period_records" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public delete access to compliance responses" ON "public"."compliance_responses" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to document types" ON "public"."document_types" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public delete access to questionnaire responses" ON "public"."compliance_questionnaire_responses" FOR DELETE USING (true);



CREATE POLICY "Allow public insert access to application documents" ON "public"."application_documents" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to branches" ON "public"."branches" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to company settings" ON "public"."company_settings" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert access to compliance period records" ON "public"."compliance_period_records" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert access to compliance responses" ON "public"."compliance_responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to document types" ON "public"."document_types" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert access to job applications" ON "public"."job_applications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to questionnaire responses" ON "public"."compliance_questionnaire_responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access to branches" ON "public"."branches" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to client compliance types" ON "public"."client_compliance_types" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to company settings" ON "public"."company_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to compliance data retention" ON "public"."compliance_data_retention" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read access to compliance period records" ON "public"."compliance_period_records" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to compliance questionnaires" ON "public"."compliance_questionnaires" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to compliance questions" ON "public"."compliance_questions" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to compliance responses" ON "public"."compliance_responses" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to compliance_types" ON "public"."compliance_types" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to document types" ON "public"."document_types" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to leave_types" ON "public"."leave_types" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to leaves" ON "public"."leaves" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to questionnaire questions" ON "public"."compliance_questionnaire_questions" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to questionnaire responses" ON "public"."compliance_questionnaire_responses" FOR SELECT USING (true);



CREATE POLICY "Allow public update access to branches" ON "public"."branches" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update access to company settings" ON "public"."company_settings" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update access to compliance period records" ON "public"."compliance_period_records" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update access to compliance responses" ON "public"."compliance_responses" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update access to document types" ON "public"."document_types" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update access to questionnaire responses" ON "public"."compliance_questionnaire_responses" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow read access to document types" ON "public"."document_types" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create client compliance types" ON "public"."client_compliance_types" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can create compliance types" ON "public"."compliance_types" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can create leave requests" ON "public"."leave_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can create leave types" ON "public"."leave_types" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can create recipients" ON "public"."signing_request_recipients" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create signing requests" ON "public"."signing_requests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can delete compliance types" ON "public"."compliance_types" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete document_tracker" ON "public"."document_tracker" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete leave requests" ON "public"."leave_requests" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete leave types" ON "public"."leave_types" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert document_tracker" ON "public"."document_tracker" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert spot_check_records" ON "public"."spot_check_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update compliance types" ON "public"."compliance_types" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update document_tracker" ON "public"."document_tracker" FOR UPDATE USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update leave requests" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update leave types" ON "public"."leave_types" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view document templates" ON "public"."document_templates" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view document_tracker" ON "public"."document_tracker" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view signed documents" ON "public"."signed_documents" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view spot_check_records" ON "public"."spot_check_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view system settings" ON "public"."system_settings" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view template fields" ON "public"."template_fields" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Creators can update their own spot_check_records" ON "public"."spot_check_records" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."is_admin_user"())) WITH CHECK ((("created_by" = "auth"."uid"()) OR "public"."is_admin_user"()));



CREATE POLICY "Employees can update their own draft/rejected statements" ON "public"."care_worker_statements" FOR UPDATE USING ((("assigned_employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) AND ("status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"])))) WITH CHECK (("assigned_employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees can view their assigned statements via metadata" ON "public"."care_worker_statements" FOR SELECT TO "authenticated" USING ((("assigned_employee_id")::"text" = (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'employee_id'::"text")));



CREATE POLICY "Managers can update leave requests" ON "public"."leave_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'manager'::"text")))));



CREATE POLICY "Managers can update leaves from accessible branches" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user"() OR ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'manager'::"text")))) AND ("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches"))))))) WITH CHECK (("public"."is_admin_user"() OR ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'manager'::"text")))) AND ("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches")))))));



CREATE POLICY "Managers can view leaves from accessible branches" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING (("public"."is_admin_user"() OR ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'manager'::"text")))) AND ("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches")))))));



CREATE POLICY "Normal users can view statements from accessible branches" ON "public"."care_worker_statements" FOR SELECT USING (("public"."is_admin_user"() OR ("assigned_employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR (("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches")) AND "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'compliance:view'::"text"))));



CREATE POLICY "Public can access reference requests by token" ON "public"."reference_requests" USING (true) WITH CHECK (true);



CREATE POLICY "Public can create annual appraisals" ON "public"."annual_appraisals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can create signed documents" ON "public"."signed_documents" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can view active job application settings" ON "public"."job_application_settings" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view active repeating templates" ON "public"."repeating_question_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view document templates via signing requests" ON "public"."document_templates" FOR SELECT USING (("id" IN ( SELECT "signing_requests"."template_id"
   FROM "public"."signing_requests"
  WHERE ("signing_requests"."signing_token" IS NOT NULL))));



CREATE POLICY "Public can view signing requests by token" ON "public"."signing_requests" FOR SELECT USING (("signing_token" IS NOT NULL));



CREATE POLICY "Public can view template fields via signing requests" ON "public"."template_fields" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."signing_requests" "sr"
  WHERE (("sr"."template_id" = "template_fields"."template_id") AND ("sr"."signing_token" IS NOT NULL)))));



CREATE POLICY "Public can view template questions" ON "public"."repeating_template_questions" FOR SELECT USING (true);



CREATE POLICY "Public can view with valid access token" ON "public"."signing_request_recipients" FOR SELECT USING (true);



CREATE POLICY "Staff can view their own compliance records" ON "public"."compliance_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "compliance_records"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create clients" ON "public"."clients" FOR INSERT WITH CHECK (("public"."is_admin_user"() OR ("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches"))));



CREATE POLICY "Users can create leave requests in accessible branches" ON "public"."leave_requests" FOR INSERT WITH CHECK ((("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "leave_requests"."employee_id") AND ("e"."branch_id" IN ( SELECT "get_user_accessible_branches"."branch_id"
           FROM "public"."get_user_accessible_branches"("auth"."uid"()) "get_user_accessible_branches"("branch_id"))))))));



CREATE POLICY "Users can delete clients" ON "public"."clients" FOR DELETE USING (("public"."is_admin_user"() OR ("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches"))));



CREATE POLICY "Users can delete leave requests in accessible branches" ON "public"."leave_requests" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "leave_requests"."employee_id") AND ("e"."branch_id" IN ( SELECT "get_user_accessible_branches"."branch_id"
           FROM "public"."get_user_accessible_branches"("auth"."uid"()) "get_user_accessible_branches"("branch_id")))))));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update clients" ON "public"."clients" FOR UPDATE USING (("public"."is_admin_user"() OR ("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches")))) WITH CHECK (("public"."is_admin_user"() OR ("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches"))));



CREATE POLICY "Users can update leave requests in accessible branches" ON "public"."leave_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "leave_requests"."employee_id") AND ("e"."branch_id" IN ( SELECT "get_user_accessible_branches"."branch_id"
           FROM "public"."get_user_accessible_branches"("auth"."uid"()) "get_user_accessible_branches"("branch_id"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "leave_requests"."employee_id") AND ("e"."branch_id" IN ( SELECT "get_user_accessible_branches"."branch_id"
           FROM "public"."get_user_accessible_branches"("auth"."uid"()) "get_user_accessible_branches"("branch_id")))))));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view clients from accessible branches" ON "public"."clients" FOR SELECT USING (("public"."is_admin_user"() OR ("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches"))));



CREATE POLICY "Users can view leave requests in accessible branches" ON "public"."leave_requests" FOR SELECT USING ((("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "leave_requests"."employee_id") AND ("e"."branch_id" IN ( SELECT "get_user_accessible_branches"."branch_id"
           FROM "public"."get_user_accessible_branches"("auth"."uid"()) "get_user_accessible_branches"("branch_id"))))))));



CREATE POLICY "Users can view leaves from accessible branches" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING (("public"."is_admin_user"() OR ("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches"))))));



CREATE POLICY "Users can view their own branch access" ON "public"."user_branch_access" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own permissions" ON "public"."user_permissions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own signing requests" ON "public"."signing_requests" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users with permission can delete job applications" ON "public"."job_applications" FOR DELETE USING (("public"."is_admin_user"() OR "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'job-applications:delete'::"text")));



CREATE POLICY "Users with permission can update job applications" ON "public"."job_applications" FOR UPDATE USING (("public"."is_admin_user"() OR "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'job-applications:edit'::"text")));



CREATE POLICY "Users with permission can view job applications" ON "public"."job_applications" FOR SELECT USING (("public"."is_admin_user"() OR "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'job-applications:view'::"text")));



CREATE POLICY "Users with permissions can create statements" ON "public"."care_worker_statements" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user"() OR "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'care-worker-statements:create'::"text")));



CREATE POLICY "Users with permissions can delete statements from accessible br" ON "public"."care_worker_statements" FOR DELETE USING (("public"."is_admin_user"() OR (("branch_id" IN ( SELECT "public"."get_user_accessible_branches"("auth"."uid"()) AS "get_user_accessible_branches")) AND "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'compliance:delete'::"text"))));



CREATE POLICY "Users with permissions can update statements" ON "public"."care_worker_statements" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user"() OR "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'care-worker-statements:edit'::"text"))) WITH CHECK (("public"."is_admin_user"() OR "public"."user_has_permission"("auth"."uid"(), 'page_action'::"text", 'care-worker-statements:edit'::"text")));



ALTER TABLE "public"."annual_appraisals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."care_worker_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_compliance_period_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_compliance_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_spot_check_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_automation_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_data_retention" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_period_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_questionnaire_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_questionnaire_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_questionnaires" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_tracker" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_application_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leaves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reference_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repeating_question_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repeating_template_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signed_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signing_request_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signing_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spot_check_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_branch_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_branch_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_menu_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."adjust_employee_leave_balance"("p_employee_id" "uuid", "p_days" numeric, "p_operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_employee_leave_balance"("p_employee_id" "uuid", "p_days" numeric, "p_operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_employee_leave_balance"("p_employee_id" "uuid", "p_days" numeric, "p_operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_annual_appraisal_responses"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_annual_appraisal_responses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_annual_appraisal_responses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_compliance_notes_responses"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_compliance_notes_responses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_compliance_notes_responses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_archive_dates"("frequency" "text", "base_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_archive_dates"("frequency" "text", "base_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_archive_dates"("frequency" "text", "base_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_leave_days"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_leave_days"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_leave_days"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_client_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_client_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_client_archival_readiness"("p_compliance_type_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_signing_expiration"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_signing_expiration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_signing_expiration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_auth_user_on_role_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_auth_user_on_role_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_auth_user_on_role_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_branch_permissions_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_branch_permissions_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_branch_permissions_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_menu_permissions_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_menu_permissions_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_menu_permissions_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_with_role"("email_param" "text", "password_param" "text", "role_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_with_role"("email_param" "text", "password_param" "text", "role_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_with_role"("email_param" "text", "password_param" "text", "role_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_employee_document"("p_employee_id" "uuid", "p_document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_employee_document"("p_employee_id" "uuid", "p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_employee_document"("p_employee_id" "uuid", "p_document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_signed_link_on_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_signed_link_on_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_signed_link_on_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_signing_link_on_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_signing_link_on_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_signing_link_on_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_client_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_client_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_client_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_client_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_client_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_client_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_compliance_records_for_period"("p_compliance_type_id" "uuid", "p_period_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_compliance_statistics"("p_compliance_type_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_employee_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_employee_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_employee_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_compliance_automation_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_compliance_automation_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_compliance_automation_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_compliance_automation_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_compliance_automation_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_compliance_automation_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_email_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_email_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_email_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leave_automation_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_leave_automation_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leave_automation_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leave_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_leave_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leave_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leave_settings_internal"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_leave_settings_internal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leave_settings_internal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_end_date"("p_frequency" "text", "p_period_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_end_date"("p_frequency" "text", "p_period_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_end_date"("p_frequency" "text", "p_period_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_identifier"("frequency" "text", "target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_identifier"("frequency" "text", "target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_identifier"("frequency" "text", "target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_branches"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_branches"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_branches"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("input_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("input_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("input_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_password"("password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_password"("password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_password"("password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment"("row_id" "uuid", "increment_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."increment"("row_id" "uuid", "increment_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment"("row_id" "uuid", "increment_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_by_id"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_by_id"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_by_id"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_application_settings_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_application_settings_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_application_settings_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_documents_to_jsonb"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_documents_to_jsonb"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_documents_to_jsonb"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admins"("p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admins"("p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admins"("p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_compliance_overdue"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_compliance_overdue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_compliance_overdue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_document_expiring"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_document_expiring"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_document_expiring"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_leave_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_leave_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_leave_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_leave_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_leave_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_leave_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_new_employee"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_new_employee"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_new_employee"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_user"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_user"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_user"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_reference_id" "uuid", "p_reference_table" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_all_leave_balances"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_all_leave_balances"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_all_leave_balances"() TO "service_role";



GRANT ALL ON FUNCTION "public"."run_historical_data_backfill"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_historical_data_backfill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_historical_data_backfill"() TO "service_role";



GRANT ALL ON FUNCTION "public"."run_leave_annual_reset_if_needed"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_leave_annual_reset_if_needed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_leave_annual_reset_if_needed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_client_compliance_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_client_compliance_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_client_compliance_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_compliance_automation_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_compliance_automation_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_compliance_automation_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_compliance_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_compliance_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_compliance_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_document_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_document_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_document_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leave_status_with_balance"("p_leave_id" "uuid", "p_new_status" "text", "p_manager_notes" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_leave_status_with_balance"("p_leave_id" "uuid", "p_new_status" "text", "p_manager_notes" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leave_status_with_balance"("p_leave_id" "uuid", "p_new_status" "text", "p_manager_notes" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_employee_document"("p_employee_id" "uuid", "p_document" "jsonb", "p_country" "text", "p_nationality_status" "text", "p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_employee_document"("p_employee_id" "uuid", "p_document" "jsonb", "p_country" "text", "p_nationality_status" "text", "p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_employee_document"("p_employee_id" "uuid", "p_document" "jsonb", "p_country" "text", "p_nationality_status" "text", "p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "perm_type" "text", "perm_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "perm_type" "text", "perm_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "perm_type" "text", "perm_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_password"("password_input" "text", "password_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_password"("password_input" "text", "password_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_password"("password_input" "text", "password_hash" "text") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."annual_appraisals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."annual_appraisals" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."annual_appraisals" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."application_documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."application_documents" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."application_documents" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."care_worker_statements" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."care_worker_statements" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."care_worker_statements" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_compliance_period_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_compliance_period_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_compliance_period_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_compliance_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_compliance_types" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_compliance_types" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_spot_check_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_spot_check_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."client_spot_check_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clients" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clients" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clients" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."company_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."company_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."company_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_automation_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_automation_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_automation_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_data_retention" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_data_retention" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_data_retention" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_period_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_period_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_period_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaire_questions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaire_questions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaire_questions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaire_responses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaire_responses" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaire_responses" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaires" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaires" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questionnaires" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_questions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_responses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_responses" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_responses" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_tasks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_tasks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_types" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."compliance_types" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_templates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_tracker" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_tracker" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_tracker" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_types" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_types" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."employees" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."employees" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."employees" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."job_application_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."job_application_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."job_application_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."job_applications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."job_applications" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."job_applications" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_requests" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_types" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leave_types" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaves" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaves" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaves" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."reference_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."reference_requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."reference_requests" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."repeating_question_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."repeating_question_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."repeating_question_templates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."repeating_template_questions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."repeating_template_questions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."repeating_template_questions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signed_documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signed_documents" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signed_documents" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_request_recipients" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_request_recipients" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_request_recipients" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signing_requests" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."spot_check_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."spot_check_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."spot_check_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."template_fields" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."template_fields" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."template_fields" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_branch_access" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_branch_access" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_branch_access" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_branch_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_branch_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_branch_permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_menu_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_menu_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_menu_permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";







