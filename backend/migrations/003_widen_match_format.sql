-- Widen match_format to accommodate longer league names like "Campeonato Brasileiro Série A"
ALTER TABLE rooms ALTER COLUMN match_format TYPE VARCHAR(100);
