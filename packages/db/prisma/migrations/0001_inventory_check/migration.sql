ALTER TABLE pass_products DROP CONSTRAINT IF EXISTS pass_products_qty_check;
ALTER TABLE pass_products
  ADD CONSTRAINT pass_products_qty_check
  CHECK (quantity_sold >= 0 AND quantity_sold <= quantity_total);
