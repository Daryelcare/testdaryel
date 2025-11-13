-- Fix existing employees with NULL last_login
-- This sets last_login to current time for employees who have auth accounts
UPDATE employees 
SET last_login = NOW()
WHERE user_id IS NOT NULL 
AND last_login IS NULL 
AND is_active = true;