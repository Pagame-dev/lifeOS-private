/*
# Life OS — Add onboarding_completed flag to profiles

## Overview
Adds an `onboarding_completed` boolean column to the `profiles` table so the app
can detect whether a new user has completed the setup wizard.

## Changes
1. Add `onboarding_completed` boolean DEFAULT false to `profiles`

## Security
- No security changes needed — the column is covered by existing RLS policies.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
