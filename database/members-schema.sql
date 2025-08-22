-- MDPVA Members Table Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  profession TEXT NOT NULL CHECK (profession IN ('photographer', 'videographer', 'both')),
  business_name TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
  city TEXT NOT NULL,
  area TEXT,
  state TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  profile_photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_member_id ON members(member_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_profession ON members(profession);
CREATE INDEX IF NOT EXISTS idx_members_pincode ON members(pincode);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
CREATE INDEX IF NOT EXISTS idx_members_active ON members(deleted_at) WHERE deleted_at IS NULL;

-- Safe migration: add area column if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'area'
    ) THEN
        ALTER TABLE members ADD COLUMN area TEXT;
    END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_members_updated_at 
    BEFORE UPDATE ON members 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read all members
CREATE POLICY "Allow authenticated users to read members" ON members
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy to allow authenticated users to insert members
CREATE POLICY "Allow authenticated users to insert members" ON members
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow authenticated users to update members
CREATE POLICY "Allow authenticated users to update members" ON members
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy to allow authenticated users to delete members
CREATE POLICY "Allow authenticated users to delete members" ON members
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create storage bucket for member photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for member photos
CREATE POLICY "Allow authenticated users to upload member photos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'member-photos' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Allow public access to member photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'member-photos');

CREATE POLICY "Allow authenticated users to update member photos" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'member-photos' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Allow authenticated users to delete member photos" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'member-photos' AND 
        auth.role() = 'authenticated'
    );
