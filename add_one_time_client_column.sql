-- Run this in pgAdmin to add a "one time client" flag to clients.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_one_time_client BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clients_is_one_time_client
  ON clients(is_one_time_client);
