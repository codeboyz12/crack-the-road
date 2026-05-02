CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users (created first for FK references) ─────────────────────────────
CREATE TABLE users (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT,
    role            VARCHAR(20) DEFAULT 'reporter'
                    CHECK (role IN ('reporter', 'reviewer', 'admin')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reports ─────────────────────────────────────────────────────────────
CREATE TABLE reports (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    lat             DECIMAL(10, 7)  NOT NULL,
    lng             DECIMAL(10, 7)  NOT NULL,
    geom            GEOGRAPHY(POINT, 4326)
                    GENERATED ALWAYS AS (
                        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                    ) STORED,
    address         TEXT,
    province        VARCHAR(100),
    district        VARCHAR(100),
    road_name       VARCHAR(255),

    reported_by     UUID REFERENCES users(id),
    reported_at     TIMESTAMPTZ DEFAULT NOW(),
    source          VARCHAR(50) DEFAULT 'web',

    image_path      TEXT NOT NULL,
    image_hash      VARCHAR(64),

    status          VARCHAR(30) DEFAULT 'pending'
                    CHECK (status IN (
                        'pending',
                        'ai_processed',
                        'under_review',
                        'verified',
                        'rejected',
                        'resolved'
                    )),

    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_geom       ON reports USING GIST(geom);
CREATE INDEX idx_reports_status     ON reports(status);
CREATE INDEX idx_reports_province   ON reports(province);
CREATE INDEX idx_reports_reported_at ON reports(reported_at DESC);

-- ── AI Detection Results ─────────────────────────────────────────────────
CREATE TABLE ai_detections (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id       UUID REFERENCES reports(id) ON DELETE CASCADE,

    crack_type      VARCHAR(60)
                    CHECK (crack_type IN (
                        'alligator_crack',
                        'deep_foundation_consolidation',
                        'pot_hole',
                        'reflection_crack',
                        'none'
                    )),
    severity        VARCHAR(20)
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence      DECIMAL(5, 4)   NOT NULL,

    detections      JSONB,
    model_name      VARCHAR(100),
    model_version   VARCHAR(50),
    inference_ms    INTEGER,

    processed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_detections_report ON ai_detections(report_id);

-- ── Alert Zones ──────────────────────────────────────────────────────────
CREATE TABLE alert_zones (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    geom            GEOGRAPHY(POLYGON, 4326),
    threshold       INTEGER DEFAULT 5,
    window_hours    INTEGER DEFAULT 24,
    severity        VARCHAR(20) DEFAULT 'medium',
    notify_channels JSONB DEFAULT '["line"]',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Alert Events ─────────────────────────────────────────────────────────
CREATE TABLE alert_events (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    zone_id         UUID REFERENCES alert_zones(id),
    province        VARCHAR(100),
    report_count    INTEGER,
    triggered_at    TIMESTAMPTZ DEFAULT NOW(),
    notified        BOOLEAN DEFAULT FALSE
);

-- ── Materialized View: Province Stats ────────────────────────────────────
CREATE MATERIALIZED VIEW mv_province_stats AS
SELECT
    province,
    COUNT(*)                                    AS total_reports,
    COUNT(*) FILTER (WHERE status = 'verified') AS verified_reports,
    COUNT(*) FILTER (WHERE status = 'pending')  AS pending_reports,
    AVG(d.confidence)                           AS avg_ai_confidence,
    MAX(r.reported_at)                          AS last_reported_at,
    ST_Centroid(ST_Collect(r.geom::geometry))   AS centroid
FROM reports r
LEFT JOIN ai_detections d ON d.report_id = r.id
WHERE r.province IS NOT NULL
GROUP BY province;

CREATE UNIQUE INDEX ON mv_province_stats(province);

-- ── Seed: default admin user ─────────────────────────────────────────────
-- password: admin1234 (bcrypt hash — change in production)
INSERT INTO users (email, hashed_password, role) VALUES
(
    'admin@rcm.local',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'admin'
);
