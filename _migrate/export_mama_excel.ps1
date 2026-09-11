# Exporta Excel Mama → JSON seed (DataImportRunner format)
$ErrorActionPreference = 'Stop'
$xlsx = 'A:\Descargas\Productos de limpieza Mama.xlsx'
$outDir = 'A:\Programas-java\Negocios\productos-limpieza\_migrate\mama_seed'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Parse-Money([string]$t) {
  if ([string]::IsNullOrWhiteSpace($t)) { return $null }
  $s = $t.Trim() -replace '[\$\s,]', '' -replace '−', '-' -replace '—', '' -replace '–', ''
  if ($s -eq '' -or $s -eq '-' -or $s -eq '.') { return $null }
  $d = 0
  if ([decimal]::TryParse($s, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$d)) {
    return [double]$d
  }
  return $null
}

function Parse-Date([string]$t) {
  if ([string]::IsNullOrWhiteSpace($t)) { return $null }
  $s = $t.Trim()
  $dt = [datetime]::MinValue
  $cultures = @(
    [Globalization.CultureInfo]::GetCultureInfo('es-MX'),
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.CultureInfo]::GetCultureInfo('en-US')
  )
  foreach ($c in $cultures) {
    if ([datetime]::TryParse($s, $c, [Globalization.DateTimeStyles]::None, [ref]$dt)) {
      return $dt.ToString('yyyy-MM-dd')
    }
  }
  # 29-Oct-25 / 10-sep-2026
  if ($s -match '^(\d{1,2})[-\/]([A-Za-zÁÉÍÓÚáéíóú]+)[-\/](\d{2,4})$') {
    $meses = @{ ene=1; feb=2; mar=3; abr=4; may=5; jun=6; jul=7; ago=8; sep=9; oct=10; nov=11; dic=12;
      jan=1; feb=2; mar=3; apr=4; may=5; jun=6; jul=7; aug=8; sep=9; oct=10; nov=11; dec=12 }
    $mName = $Matches[2].Substring(0,3).ToLower()
    $mName = [Text.Encoding]::ASCII.GetString([Text.Encoding]::GetEncoding('ISO-8859-8').GetBytes($mName))
    # strip accents manually
    $mName = $Matches[2].ToLower()
    $mName = $mName.Normalize([Text.NormalizationForm]::FormD) -replace '\p{M}', ''
    $mName = $mName.Substring(0, [Math]::Min(3, $mName.Length))
    $map = @{ ene=1; feb=2; mar=3; abr=4; may=5; jun=6; jul=7; ago=8; sep=9; oct=10; nov=11; dic=12 }
    if ($map.ContainsKey($mName)) {
      $y = [int]$Matches[3]
      if ($y -lt 100) { $y += 2000 }
      return ('{0:d4}-{1:d2}-{2:d2}' -f $y, $map[$mName], [int]$Matches[1])
    }
  }
  return $null
}

function Cell-Text($ws, $r, $c) {
  $v = $ws.Cells.Item($r, $c).Text
  if ($null -eq $v) { return '' }
  return [string]$v
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlsx)

# ---- Inventario ----
$invWs = $wb.Worksheets.Item('Inventario')
$invRows = $invWs.UsedRange.Rows.Count
$inventario = @()
$stockEsperado = @{}
for ($r = 2; $r -le $invRows; $r++) {
  $nombre = (Cell-Text $invWs $r 1).Trim()
  if ($nombre -eq '') { continue }
  $venta = Parse-Money (Cell-Text $invWs $r 2)
  $compra = Parse-Money (Cell-Text $invWs $r 3)
  $cantIni = Parse-Money (Cell-Text $invWs $r 6)
  $stock = Parse-Money (Cell-Text $invWs $r 7)
  $inventario += [ordered]@{
    nombre = $nombre
    precioCompra = $(if ($null -eq $compra) { 0 } else { $compra })
    cantidadInicial = $(if ($null -eq $cantIni) { 0 } else { $cantIni })
    precioVenta = $venta
  }
  $stockEsperado[$nombre.ToLower()] = $(if ($null -eq $stock) { 0 } else { $stock })
}

# ---- Historico Precios ----
$hpWs = $wb.Worksheets.Item('Historico Precios')
$hpRows = $hpWs.UsedRange.Rows.Count
$historico = @()
$latestVenta = @{}
for ($r = 2; $r -le $hpRows; $r++) {
  $nombre = (Cell-Text $hpWs $r 1).Trim()
  $fecha = Parse-Date (Cell-Text $hpWs $r 2)
  $precio = Parse-Money (Cell-Text $hpWs $r 3)
  if ($nombre -eq '' -or $null -eq $fecha -or $null -eq $precio) { continue }
  $historico += [ordered]@{ producto = $nombre; fechaVigencia = $fecha; precio = $precio }
  $key = $nombre.ToLower()
  if (-not $latestVenta.ContainsKey($key) -or $fecha -gt $latestVenta[$key].fecha) {
    $latestVenta[$key] = @{ fecha = $fecha; precio = $precio }
  }
}
# Asegurar menudeo vigente desde Inventario (10/09/2026)
foreach ($p in $inventario) {
  if ($null -eq $p.precioVenta) { continue }
  $historico += [ordered]@{
    producto = $p.nombre
    fechaVigencia = '2026-09-10'
    precio = $p.precioVenta
  }
}

# ---- Ventas ----
$vWs = $wb.Worksheets.Item('Ventas')
$vRows = $vWs.UsedRange.Rows.Count
$ventas = @()
for ($r = 2; $r -le $vRows; $r++) {
  $fecha = Parse-Date (Cell-Text $vWs $r 1)
  $prod = (Cell-Text $vWs $r 2).Trim()
  $tipo = (Cell-Text $vWs $r 3).Trim()
  $cant = Parse-Money (Cell-Text $vWs $r 4)
  $total = Parse-Money (Cell-Text $vWs $r 5)
  if ($null -eq $fecha -or $tipo -eq '') { continue }
  $row = [ordered]@{
    fecha = $fecha
    tipoVenta = $tipo
    cantidad = $(if ($null -eq $cant) { 0 } else { $cant })
    total = $(if ($null -eq $total) { 0 } else { $total })
  }
  if ($prod -ne '') { $row.producto = $prod }
  $ventas += $row
}

# ---- Entradas ----
$eWs = $wb.Worksheets.Item('Entradas')
$eRows = $eWs.UsedRange.Rows.Count
$entradas = @()
for ($r = 2; $r -le $eRows; $r++) {
  $fecha = Parse-Date (Cell-Text $eWs $r 1)
  $prod = (Cell-Text $eWs $r 2).Trim()
  $cant = Parse-Money (Cell-Text $eWs $r 3)
  $precio = Parse-Money (Cell-Text $eWs $r 4)
  if ($null -eq $fecha -or $prod -eq '' -or $null -eq $cant) { continue }
  $entradas += [ordered]@{
    fecha = $fecha
    producto = $prod
    cantidad = $cant
    precioProveedor = $(if ($null -eq $precio) { 0 } else { $precio })
  }
}

# ---- Caja ----
$cWs = $wb.Worksheets.Item('Caja')
$cajaConfig = [ordered]@{
  fechaInicio = Parse-Date (Cell-Text $cWs 3 2)
  fechaFin = Parse-Date (Cell-Text $cWs 4 2)
  fondoInicial = $(if ($null -eq (Parse-Money (Cell-Text $cWs 4 2))) { Parse-Money (Cell-Text $cWs 4 2) } else { Parse-Money (Cell-Text $cWs 4 2) })
}
# R3 Fecha Inicio col B, R4 Fecha Fin? Looking at earlier dump:
# R2: Fecha Inicio | 15/04/2026
# R3: Fecha Fin | 10/09/2026
# R4: Fondo Inicial | $0.00
$cajaConfig = [ordered]@{
  fechaInicio = Parse-Date (Cell-Text $cWs 2 2)
  fechaFin = Parse-Date (Cell-Text $cWs 3 2)
  fondoInicial = $( $f = Parse-Money (Cell-Text $cWs 4 2); if ($null -eq $f) { 0 } else { $f } )
}
$movs = @()
# Ingresos col H-I (8-9): fecha, total — from dump R2 headers Fecha | Total ingresado at cols 8,9
# Retiros col D-F: Fecha, Total, Motivo
# Apartados are separate sheet
$maxCaja = $cWs.UsedRange.Rows.Count
for ($r = 3; $r -le $maxCaja; $r++) {
  $fRet = Parse-Date (Cell-Text $cWs $r 4)
  $mRet = Parse-Money (Cell-Text $cWs $r 5)
  $motRet = (Cell-Text $cWs $r 6).Trim()
  if ($null -ne $fRet -and $null -ne $mRet -and $mRet -ne 0) {
    $movs += [ordered]@{ fecha = $fRet; tipo = 'RETIRO'; monto = $mRet; motivo = $(if ($motRet) { $motRet } else { 'Retiro' }) }
  }
  $fIng = Parse-Date (Cell-Text $cWs $r 8)
  $mIng = Parse-Money (Cell-Text $cWs $r 9)
  if ($null -ne $fIng -and $null -ne $mIng -and $mIng -ne 0) {
    $movs += [ordered]@{ fecha = $fIng; tipo = 'INGRESO'; monto = $mIng; motivo = 'Ingreso' }
  }
}

# ---- Apartados ----
$aWs = $wb.Worksheets.Item('Apartados')
$aRows = [Math]::Min(200, $aWs.UsedRange.Rows.Count)
$apartados = @()
# Ganancia productos: cols D-E (fecha, ingreso) from R3
# Ganancia Salarios: cols H-I
# Gastos productos: cols L-N (fecha, total, motivo)
for ($r = 3; $r -le $aRows; $r++) {
  $fP = Parse-Date (Cell-Text $aWs $r 4)
  $mP = Parse-Money (Cell-Text $aWs $r 5)
  if ($null -ne $fP -and $null -ne $mP -and $mP -ne 0) {
    $apartados += [ordered]@{ fecha = $fP; categoria = 'PRODUCTOS'; ingreso = $mP; tipo = 'INGRESO'; motivo = $null }
  }
  $fS = Parse-Date (Cell-Text $aWs $r 8)
  $mS = Parse-Money (Cell-Text $aWs $r 9)
  if ($null -ne $fS -and $null -ne $mS -and $mS -ne 0) {
    $apartados += [ordered]@{ fecha = $fS; categoria = 'SALARIOS'; ingreso = $mS; tipo = 'INGRESO'; motivo = $null }
  }
  $fG = Parse-Date (Cell-Text $aWs $r 12)
  $mG = Parse-Money (Cell-Text $aWs $r 13)
  $motG = (Cell-Text $aWs $r 14).Trim()
  if ($null -ne $fG -and $null -ne $mG -and $mG -ne 0) {
    $apartados += [ordered]@{ fecha = $fG; categoria = 'PRODUCTOS'; ingreso = $mG; tipo = 'GASTO'; motivo = $(if ($motG) { $motG } else { $null }) }
  }
}

# ---- Inversión ----
$iWs = $wb.Worksheets.Item($wb.Worksheets | Where-Object { $_.Name -like 'Inversi*' } | Select-Object -First 1)
# Find by index - sheet name was "Inversión"
$iWs = $null
foreach ($ws in $wb.Worksheets) {
  if ($ws.Name -like 'Inversi*') { $iWs = $ws; break }
}
$invProd = @()
$invInfra = @()
if ($iWs) {
  $iRows = $iWs.UsedRange.Rows.Count
  for ($r = 2; $r -le $iRows; $r++) {
    $nom = (Cell-Text $iWs $r 1).Trim()
    $cant = Parse-Money (Cell-Text $iWs $r 2)
    $pu = Parse-Money (Cell-Text $iWs $r 3)
    $tot = Parse-Money (Cell-Text $iWs $r 4)
    if ($nom -ne '' -and $null -ne $cant) {
      $invProd += [ordered]@{
        nombre = $nom
        cantidad = $cant
        precioUnidad = $(if ($null -eq $pu) { 0 } else { $pu })
        total = $(if ($null -eq $tot) { [Math]::Round($cant * $(if ($null -eq $pu) { 0 } else { $pu }), 2) } else { $tot })
      }
    }
    $fInfra = Parse-Date (Cell-Text $iWs $r 9)
    $motInfra = (Cell-Text $iWs $r 10).Trim()
    $costInfra = Parse-Money (Cell-Text $iWs $r 11)
    if ($motInfra -ne '' -and $null -ne $costInfra) {
      $invInfra += [ordered]@{ concepto = $motInfra; monto = $costInfra }
    }
  }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

# Strip precioVenta from inventario for DataImportRunner
$inventarioOut = @()
foreach ($p in $inventario) {
  $inventarioOut += [ordered]@{
    nombre = $p.nombre
    precioCompra = $p.precioCompra
    cantidadInicial = $p.cantidadInicial
  }
}

$inventarioOut | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'inventario.json')
$historico | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'historico-precios.json')
$ventas | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'ventas.json')
$entradas | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'entradas.json')
$cajaConfig | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'caja-config.json')
$movs | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'caja-movimientos.json')
$apartados | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'apartados.json')
([ordered]@{ productos = $invProd; infraestructura = $invInfra }) | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'inversion.json')
$stockEsperado.GetEnumerator() | ForEach-Object { [ordered]@{ producto = $_.Key; stock = $_.Value } } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'stock-esperado.json')

Write-Host "OK inventario=$($inventarioOut.Count) ventas=$($ventas.Count) entradas=$($entradas.Count) precios=$($historico.Count) movs=$($movs.Count) apartados=$($apartados.Count) invProd=$($invProd.Count) invInfra=$($invInfra.Count)"
Write-Host "caja" ($cajaConfig | ConvertTo-Json -Compress)
