-- ==========================================
-- Clean Seed Data for Chaos Garden
-- 10 Plants + 5 Herbivores
-- ==========================================

-- Clear existing entities for tick 0
DELETE FROM entities WHERE garden_state_id = 1;

-- Reset garden state counts
UPDATE garden_state SET 
  plants = 10,
  herbivores = 5,
  carnivores = 0,
  fungi = 0,
  total = 15,
  timestamp = datetime('now')
WHERE id = 1;

-- Insert 10 Plants
INSERT INTO entities (
  id, garden_state_id, type, species, position_x, position_y,
  energy, health, age,
  traits_reproduction_rate, traits_movement_speed,
  traits_metabolism_efficiency, traits_photosynthesis_rate,
  traits_perception_radius, lineage, created_at, updated_at
) VALUES
  ('plant-001', 1, 'plant', 'Green Sprout 1', 100.0, 100.0, 85.0, 95.0, 0, 0.06, 0.0, 1.0, 1.0, 30.0, 'origin', datetime('now'), datetime('now')),
  ('plant-002', 1, 'plant', 'Green Sprout 2', 200.0, 150.0, 90.0, 98.0, 0, 0.05, 0.0, 1.0, 1.2, 25.0, 'origin', datetime('now'), datetime('now')),
  ('plant-003', 1, 'plant', 'Green Sprout 3', 300.0, 200.0, 75.0, 92.0, 0, 0.07, 0.0, 1.0, 0.9, 35.0, 'origin', datetime('now'), datetime('now')),
  ('plant-004', 1, 'plant', 'Green Sprout 4', 400.0, 250.0, 95.0, 99.0, 0, 0.04, 0.0, 1.0, 1.1, 28.0, 'origin', datetime('now'), datetime('now')),
  ('plant-005', 1, 'plant', 'Green Sprout 5', 500.0, 300.0, 80.0, 96.0, 0, 0.06, 0.0, 1.0, 1.0, 32.0, 'origin', datetime('now'), datetime('now')),
  ('plant-006', 1, 'plant', 'Green Sprout 6', 150.0, 400.0, 88.0, 94.0, 0, 0.05, 0.0, 1.0, 1.0, 30.0, 'origin', datetime('now'), datetime('now')),
  ('plant-007', 1, 'plant', 'Green Sprout 7', 250.0, 450.0, 82.0, 97.0, 0, 0.06, 0.0, 1.0, 0.95, 33.0, 'origin', datetime('now'), datetime('now')),
  ('plant-008', 1, 'plant', 'Green Sprout 8', 350.0, 500.0, 91.0, 98.0, 0, 0.04, 0.0, 1.0, 1.15, 27.0, 'origin', datetime('now'), datetime('now')),
  ('plant-009', 1, 'plant', 'Green Sprout 9', 450.0, 550.0, 77.0, 93.0, 0, 0.07, 0.0, 1.0, 0.88, 36.0, 'origin', datetime('now'), datetime('now')),
  ('plant-010', 1, 'plant', 'Green Sprout 10', 550.0, 100.0, 86.0, 95.0, 0, 0.05, 0.0, 1.0, 1.05, 29.0, 'origin', datetime('now'), datetime('now'));

-- Insert 5 Herbivores
INSERT INTO entities (
  id, garden_state_id, type, species, position_x, position_y,
  energy, health, age,
  traits_reproduction_rate, traits_movement_speed,
  traits_metabolism_efficiency, traits_photosynthesis_rate,
  traits_perception_radius, lineage, created_at, updated_at
) VALUES
  ('herb-001', 1, 'herbivore', 'Forest Grazer 1', 120.0, 120.0, 75.0, 90.0, 0, 0.03, 2.5, 0.95, 0.0, 60.0, 'origin', datetime('now'), datetime('now')),
  ('herb-002', 1, 'herbivore', 'Forest Grazer 2', 320.0, 220.0, 80.0, 92.0, 0, 0.04, 3.0, 1.0, 0.0, 55.0, 'origin', datetime('now'), datetime('now')),
  ('herb-003', 1, 'herbivore', 'Forest Grazer 3', 520.0, 320.0, 72.0, 88.0, 0, 0.03, 2.8, 0.9, 0.0, 65.0, 'origin', datetime('now'), datetime('now')),
  ('herb-004', 1, 'herbivore', 'Forest Grazer 4', 220.0, 420.0, 78.0, 91.0, 0, 0.035, 2.2, 0.95, 0.0, 58.0, 'origin', datetime('now'), datetime('now')),
  ('herb-005', 1, 'herbivore', 'Forest Grazer 5', 420.0, 520.0, 74.0, 89.0, 0, 0.03, 2.7, 0.92, 0.0, 62.0, 'origin', datetime('now'), datetime('now'));

-- Add simulation events for seed data
INSERT INTO simulation_events (
  garden_state_id, tick, timestamp, event_type, description,
  entities_affected, severity, metadata
) VALUES
  (1, 0, datetime('now'), 'BIRTH', '10 plants sprouted from the fertile soil', '[]', 'LOW', '{"count": 10, "type": "plants"}'),
  (1, 0, datetime('now'), 'BIRTH', '5 herbivores wandered into the garden', '[]', 'LOW', '{"count": 5, "type": "herbivores"}');
