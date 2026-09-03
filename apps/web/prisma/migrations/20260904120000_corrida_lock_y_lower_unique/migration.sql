-- Lock lógico de generación de slots (NFR-R3 / EC-14): solo una corrida puede
-- tener finalizadaAt IS NULL a la vez. Una segunda corrida concurrente choca con
-- este índice y se registra como SALTADA.
CREATE UNIQUE INDEX "corrida_generacion_una_en_curso"
  ON "corrida_generacion" ((1))
  WHERE "finalizadaAt" IS NULL;

-- Refuerzo de unicidad case-insensitive de nombres (FR-24). La normalización
-- principal es en la capa de aplicación; estos índices son la última línea de
-- defensa ante una carrera (EC-4).
CREATE UNIQUE INDEX "especialidad_nombre_lower_key" ON "especialidad" (lower("nombre"));
CREATE UNIQUE INDEX "obra_social_nombre_lower_key" ON "obra_social" (lower("nombre"));
CREATE UNIQUE INDEX "sala_identificador_lower_key" ON "sala" (lower("identificador"));
CREATE UNIQUE INDEX "profesional_matricula_lower_key" ON "profesional" (lower("matricula"));
CREATE UNIQUE INDEX "categoria_problema_nombre_lower_key" ON "categoria_problema" (lower("nombre"));
CREATE UNIQUE INDEX "usuario_email_lower_key" ON "usuario" (lower("email"));
