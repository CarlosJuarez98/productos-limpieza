SET PAGESIZE 100
SET LINESIZE 200
SELECT tenant_id, COUNT(*) c FROM productos GROUP BY tenant_id ORDER BY 1;
SELECT tenant_id, COUNT(*) c FROM ventas GROUP BY tenant_id ORDER BY 1;
SELECT tenant_id, COUNT(*) c FROM entradas GROUP BY tenant_id ORDER BY 1;
SELECT tenant_id, COUNT(*) c FROM precios_historicos GROUP BY tenant_id ORDER BY 1;
EXIT
