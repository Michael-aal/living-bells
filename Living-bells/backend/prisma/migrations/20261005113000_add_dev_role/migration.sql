-- Add the protected developer role without changing existing user roles.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEV';
