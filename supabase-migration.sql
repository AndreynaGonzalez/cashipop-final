-- Cashipop: tablas de gastos e ingresos
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/ykjljfeihdopzntxxsul/sql

CREATE TABLE IF NOT EXISTS ingresos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  concepto text NOT NULL,
  monto numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  categoria text NOT NULL DEFAULT 'Ventas',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gastos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  concepto text NOT NULL,
  monto numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  categoria text NOT NULL DEFAULT 'Insumos',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: permitir lectura/escritura con la anon key
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on ingresos" ON ingresos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on gastos" ON gastos FOR ALL USING (true) WITH CHECK (true);
