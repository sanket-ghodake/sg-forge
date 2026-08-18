-- 2026 Security Standards: Database Role Segregation for Production & Sandbox
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_reference_expenses') THEN
    CREATE ROLE app_reference_expenses WITH LOGIN PASSWORD 'change_me_expenses_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_reference_go') THEN
    CREATE ROLE app_reference_go WITH LOGIN PASSWORD 'change_me_go_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_reference_python') THEN
    CREATE ROLE app_reference_python WITH LOGIN PASSWORD 'change_me_python_password';
  END IF;
END
$$;

GRANT CREATE ON DATABASE org_db TO app_reference_expenses;
GRANT CREATE ON DATABASE org_db TO app_reference_go;
GRANT CREATE ON DATABASE org_db TO app_reference_python;
