-- V09 · BORRADOR NO EJECUTADO · 2026-11-12
-- Registrar cambios en Neon exige revisión de dependencias y autorización.
-- Todas las entidades nuevas quedan vacías. No se derivan brechas del estado V06.
-- Migración aditiva/idempotente; NO modifica tablas, colas ni propuestas existentes.

CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.v09_gap_register (
  gap_id text PRIMARY KEY,
  gap_kind text NOT NULL CHECK (gap_kind IN (
    'Brecha funcional o técnica sustentada', 'Obligación contractual pendiente',
    'Defecto de implementación', 'Insuficiencia de evidencia', 'Mejora fuera de SDO')),
  fingerprint text UNIQUE,
  expected_behavior text NOT NULL,
  observed_behavior text NOT NULL,
  impact text,
  cause text,
  severity text CHECK (severity IN ('Crítica','Alta','Media','Baja','Sin determinar')),
  owner_proposed text,
  corrective_action text,
  attention_status text NOT NULL DEFAULT 'Propuesta'
    CHECK (attention_status IN ('Propuesta','En revisión','Abierta',
      'Atendida pendiente de verificación','Cerrada con evidencia validada','Descartada')),
  institutional_status text NOT NULL DEFAULT 'Sin validación institucional',
  evidence_required text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (length(btrim(expected_behavior)) > 0 AND length(btrim(observed_behavior)) > 0)
);

CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.v09_gap_sdo_link (
  gap_id text NOT NULL REFERENCES ejenp_requerimientos_sdo.v09_gap_register(gap_id),
  sdo_code text NOT NULL REFERENCES ejenp_requerimientos_sdo.sdo_requirements(code),
  relation_type text NOT NULL DEFAULT 'Relacionado',
  PRIMARY KEY (gap_id, sdo_code)
);

CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.v09_gap_document_link (
  gap_id text NOT NULL REFERENCES ejenp_requerimientos_sdo.v09_gap_register(gap_id),
  document_id text NOT NULL REFERENCES ejenp_requerimientos_sdo.source_documents(id),
  evidence_role text NOT NULL CHECK (evidence_role IN ('Hallazgo','Subsanación','Validación')),
  document_locator text,
  PRIMARY KEY (gap_id, document_id, evidence_role)
);

CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.v09_gap_request_link (
  gap_id text NOT NULL REFERENCES ejenp_requerimientos_sdo.v09_gap_register(gap_id),
  request_id bigint NOT NULL REFERENCES ejenp_requerimientos_sdo.proposed_requirements(id),
  PRIMARY KEY (gap_id, request_id)
);

CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.v09_gap_audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gap_id text NOT NULL REFERENCES ejenp_requerimientos_sdo.v09_gap_register(gap_id),
  event_type text NOT NULL,
  previous_state text,
  next_state text,
  evidence_description text,
  source_record text,
  actor text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS v09_gap_register_state_idx
  ON ejenp_requerimientos_sdo.v09_gap_register(attention_status, severity);
CREATE INDEX IF NOT EXISTS v09_gap_register_kind_idx
  ON ejenp_requerimientos_sdo.v09_gap_register(gap_kind);

-- Invariantes para la posterior fase de implementación:
-- 1. Sin INSERT/UPDATE automático desde evaluaciones 'Cumplimiento parcial' de V06.
-- 2. fingerprint se obtiene de identificadores verificables, no similitud textual.
-- 3. 'Cerrada con evidencia validada' requiere vínculo de tipo 'Validación'
--    y acto institucional comprobable, reforzado mediante lógica transaccional.
-- 4. No sustituir ni actualizar conformidades oficiales de sdo_requirements.
-- 5. No exponer contenido de estas tablas en endpoints públicos.
-- 6. Reversión: abandonar el despliegue sin ejecutarlo; si se aplicara, revertir
--    tras verificar expresamente ausencia de datos y dependencias. Nunca DROP automático.
