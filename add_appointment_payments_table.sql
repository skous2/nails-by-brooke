-- Run this in pgAdmin to add split-payment tracking for appointments.
-- Lets a single appointment be paid via more than one method (e.g. part cash,
-- part card), with each method's share of the service price and tip tracked
-- separately for tax reporting.

CREATE TABLE IF NOT EXISTS appointment_payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL,
  amount_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_tip NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_payments_appointment_id
  ON appointment_payments(appointment_id);

-- Backfill: give every existing appointment that already has a payment_type
-- a single payment row covering its full price + tip, so historical data
-- shows up in the new payment-method reports. Safe to re-run.
INSERT INTO appointment_payments (appointment_id, payment_type, amount_price, amount_tip)
SELECT id, payment_type, price, tip
FROM appointments
WHERE payment_type IS NOT NULL
  AND id NOT IN (SELECT DISTINCT appointment_id FROM appointment_payments);
