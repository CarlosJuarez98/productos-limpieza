SET DEFINE OFF
UPDATE productos SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE personas SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE precios_historicos SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE ventas SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE entradas SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE producciones SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE traspasos SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE traspaso_lineas SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE traspaso_abonos SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE movimientos_caja SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE apartados SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE inversion_items SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE cortes_caja SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE caja_config SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE margen_config SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE ajustes_inventario SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE pedidos SET tenant_id='admin' WHERE tenant_id='mama';
UPDATE pedido_items SET tenant_id='admin' WHERE tenant_id='mama';
COMMIT;
SELECT 'productos' t, tenant_id, COUNT(*) c FROM productos GROUP BY tenant_id
UNION ALL SELECT 'ventas', tenant_id, COUNT(*) FROM ventas GROUP BY tenant_id
UNION ALL SELECT 'entradas', tenant_id, COUNT(*) FROM entradas GROUP BY tenant_id
ORDER BY 1,2;
EXIT
