-- Tablas aditivas y aisladas; no modifica dictámenes, estimaciones ni documentos históricos.
CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.sdo_document_catalog_83 (
 code text PRIMARY KEY,
 source_row integer NOT NULL UNIQUE,
 phase text NOT NULL,
 title text NOT NULL,
 agent text NOT NULL DEFAULT '',
 audit_state text NOT NULL DEFAULT '',
 inventory_state text NOT NULL DEFAULT '',
 source_note text NOT NULL DEFAULT '',
 original_reference text NOT NULL DEFAULT '',
 technical_opinion text NOT NULL DEFAULT '',
 external_validation text NOT NULL DEFAULT '',
 proposal_url text NOT NULL DEFAULT '',
 correction_qa text NOT NULL DEFAULT '',
 snapshot jsonb NOT NULL,
 content_hash text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.sdo_document_changes_83 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code text NOT NULL REFERENCES ejenp_requerimientos_sdo.sdo_document_catalog_83(code),
 version integer NOT NULL,
 old_snapshot jsonb,
 new_snapshot jsonb NOT NULL,
 changed_fields text[] NOT NULL DEFAULT '{}',
 changed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (code,version)
);
CREATE TABLE IF NOT EXISTS ejenp_requerimientos_sdo.sdo_document_sync_runs_83 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 executed_at timestamptz NOT NULL DEFAULT now(),
 success boolean NOT NULL,
 source_count integer,
 changed_count integer,
 error_message text
);
CREATE INDEX IF NOT EXISTS sdo_document_changes_83_by_code ON ejenp_requerimientos_sdo.sdo_document_changes_83(code,version DESC);
CREATE INDEX IF NOT EXISTS sdo_document_sync_runs_83_latest ON ejenp_requerimientos_sdo.sdo_document_sync_runs_83(executed_at DESC);
