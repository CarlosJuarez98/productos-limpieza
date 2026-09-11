SET PAGESIZE 80
SET LINESIZE 120
COLUMN t FORMAT A22
COLUMN tenant_id FORMAT A10
SELECT 'productos' t, tenant_id, COUNT(*) c FROM productos GROUP BY tenant_id
UNION ALL SELECT 'ventas', tenant_id, COUNT(*) FROM ventas GROUP BY tenant_id
UNION ALL SELECT 'entradas', tenant_id, COUNT(*) FROM entradas GROUP BY tenant_id
UNION ALL SELECT 'precios_historicos', tenant_id, COUNT(*) FROM precios_historicos GROUP BY tenant_id
UNION ALL SELECT 'apartados', tenant_id, COUNT(*) FROM apartados GROUP BY tenant_id
UNION ALL SELECT 'cortes_caja', tenant_id, COUNT(*) FROM cortes_caja GROUP BY tenant_id
UNION ALL SELECT 'caja_config', tenant_id, COUNT(*) FROM caja_config GROUP BY tenant_id
ORDER BY 1,2;
EXIT
