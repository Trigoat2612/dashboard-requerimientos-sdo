-- V09 · BORRADOR NO EJECUTADO · 2026-11-12
-- Registrar cambios en Neon exige revisión de dependencias y autorización.
-- Todas las entidades nuevas quedan vacías. No se derivan brechas del estado V06.
-- Migración aditiva/idempotente; NO modifica tablas, colas ni propuestas existentes.

CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.v09_gap_register (
  gap_id text PRIMARY KEY,
  gap_kind text NOT NULL CHECK (gap_kind IN (
    'Brecha funcional o técnica sustentada', 'Obligación contractual pendiente',
    'Defecto de implementación', 'Insuficiencia de evidencia', 'Mejora fuera de SDO')),
  -- Huella derivada de identificadores de fuentes exactas, nunca similitud textual.
  fingerprint text NOT NULL UNIQUE,
  component text,
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
  institutional_status text NOT NULL DEFAULT 'Sin validación institucional'
    CHECK (institutional_status IN ('Sin validación institucional','En evaluación institucional','Validada','Rechazada')),
  validated_by text,
  validated_at timestamptz,
  validation_document_id text REFERENCES ejenp_requerimientos_sdo.source_documents(id),
  evidence_required text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (length(btrim(expected_behavior)) > 0 AND length(btrim(observed_behavior)) > 0),
  -- Un cierre verificable exige persona, fecha y documento exacto. Ningún algoritmo lo infiere.
  CONSTRAINT v09_gap_closure_requires_proof CHECK (
    attention_status <> 'Cerrada con evidencia validada'
    OR (institutional_status = 'Validada' AND validated_by IS NOT NULL
        AND validated_at IS NOT NULL AND validation_document_id IS NOT NULL)
  )
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

CREATE INDEX IF NOT EXISTS v09_gap_sdo_link_code_idx
  ON ejenp_requerimientos_sdo.v09_gap_sdo_link(sdo_code);
CREATE INDEX IF NOT EXISTS v09_gap_request_link_req_idx
  ON ejenp_requerimientos_sdo.v09_gap_request_link(request_id);
CREATE INDEX IF NOT EXISTS v09_gap_document_link_doc_idx
  ON ejenp_requerimientos_sdo.v09_gap_document_link(document_id);
CREATE INDEX IF NOT EXISTS v09_gap_register_state_idx
  ON ejenp_requerimientos_sdo.v09_gap_register(attention_status, severity);
CREATE INDEX IF NOT EXISTS v09_gap_register_kind_idx
  ON ejenp_requerimientos_sdo.v09_gap_register(gap_kind);

-- Vista interna de consulta, para roles institucionales explícitos.
-- No se publicará mediante un endpoint anónimo.
CREATE OR REPLACE VIEW ejenp_requerimientos_sdo.v09_gap_read_model AS
SELECT g.gap_id,g.gap_kind,g.component,g.expected_behavior,g.observed_behavior,
       g.impact,g.cause,g.severity,g.owner_proposed,g.corrective_action,
       g.attention_status,g.institutional_status,g.evidence_required,
       g.created_at,g.updated_at,g.validated_at,
       COALESCE((SELECT array_agg(DISTINCT l.sdo_code ORDER BY l.sdo_code)
                 FROM ejenp_requerimientos_sdo.v09_gap_sdo_link l
                 WHERE l.gap_id=g.gap_id),ARRAY[]::text[]) AS sdo_codes,
       COALESCE((SELECT array_agg(DISTINCT d.document_id ORDER BY d.document_id)
                 FROM ejenp_requerimientos_sdo.v09_gap_document_link d
                 WHERE d.gap_id=g.gap_id),ARRAY[]::text[]) AS document_ids,
       COALESCE((SELECT array_agg(DISTINCT r.request_id ORDER BY r.request_id)
                 FROM ejenp_requerimientos_sdo.v09_gap_request_link r
                 WHERE r.gap_id=g.gap_id),ARRAY[]::bigint[]) AS request_ids
FROM ejenp_requerimientos_sdo.v09_gap_register g;

-- Control defensivo: las nuevas tablas y vistas no deben otorgarse a PUBLIC.
REVOKE ALL ON ejenp_requerimientos_sdo.v09_gap_register,
  ejenp_requerimientos_sdo.v09_gap_sdo_link,
  ejenp_requerimientos_sdo.v09_gap_document_link,
  ejenp_requerimientos_sdo.v09_gap_request_link,
  ejenp_requerimientos_sdo.v09_gap_audit_events,
  ejenp_requerimientos_sdo.v09_gap_read_model FROM PUBLIC;

-- Invariantes para la posterior fase de implementación:
-- 1. Sin INSERT/UPDATE automático desde evaluaciones 'Cumplimiento parcial' de V06.
-- 2. fingerprint se obtiene de identificadores verificables, no similitud textual.
-- 3. 'Cerrada con evidencia validada' requiere vínculo de tipo 'Validación'
--    y acto institucional comprobable, reforzado mediante lógica transaccional.
-- 4. No sustituir ni actualizar conformidades oficiales de sdo_requirements.
-- 5. No exponer contenido de estas tablas en endpoints públicos.
-- 6. Este DRAFT solo se debe ejecutar después de autorización expresa de migración.
-- 7. Reversión: abandonar el despliegue sin ejecutarlo; si se aplicara, revertir
--    tras verificar expresamente ausencia de datos y dependencias. Nunca DROP automático.
