# Empaqueta los archivos actuales, incluidos los cambios aun no confirmados.
# No modifica dependencias, compilaciones, credenciales ni el historial Git.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$raizEntrega = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$carpetaEntrega = Join-Path $raizEntrega 'entrega'
New-Item -ItemType Directory -Path $carpetaEntrega -Force | Out-Null
$rutaZipEntrega = Join-Path $carpetaEntrega ('SistemaContable-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')

$directoriosEntrega = @('app', 'components', 'lib', 'scripts', 'tests', 'examples', 'docs', 'supabase', 'public')
$archivosRaizEntrega = @('README.md', '.env.example', '.gitignore', 'package.json', 'package-lock.json',
  'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs', 'AGENTS.md', 'CLAUDE.md')
$archivosEntrega = @()
foreach ($directorioEntrega in $directoriosEntrega) {
  $rutaDirectorioEntrega = Join-Path $raizEntrega $directorioEntrega
  if (Test-Path -LiteralPath $rutaDirectorioEntrega) {
    $archivosEntrega += Get-ChildItem -LiteralPath $rutaDirectorioEntrega -Recurse -File -Force
  }
}
foreach ($nombreRaizEntrega in $archivosRaizEntrega) {
  $rutaArchivoEntrega = Join-Path $raizEntrega $nombreRaizEntrega
  if (Test-Path -LiteralPath $rutaArchivoEntrega) { $archivosEntrega += Get-Item -LiteralPath $rutaArchivoEntrega }
}
$seleccionEntrega = @()
foreach ($archivoFuenteEntrega in $archivosEntrega) {
  if (($archivoFuenteEntrega.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "No se empaquetan enlaces: $($archivoFuenteEntrega.Name)"
  }
  $relativaEntrega = $archivoFuenteEntrega.FullName.Substring($raizEntrega.Length + 1).Replace('\', '/')
  if ($relativaEntrega -match '(^|/)(node_modules|\.next|\.git|\.vercel|coverage|\.test-build)(/|$)' -or
      ($archivoFuenteEntrega.Name -like '.env*' -and $relativaEntrega -ne '.env.example') -or
      $archivoFuenteEntrega.Name -match '\.(zip|log|tsbuildinfo|pem|key)$') { continue }
  if ($archivoFuenteEntrega.Length -ge 100MB) { throw "Archivo demasiado grande: $relativaEntrega" }
  if ($archivoFuenteEntrega.Extension -match '^\.(ts|tsx|js|cjs|mjs|json|md|sql|txt|ps1|example)$') {
    $contenidoEntrega = [System.IO.File]::ReadAllText($archivoFuenteEntrega.FullName)
    if ($contenidoEntrega -match 'sb_secret_[A-Za-z0-9_-]{20,}') {
      throw "Posible clave secreta en $relativaEntrega. Retirala antes de empaquetar."
    }
  }
  $seleccionEntrega += [PSCustomObject]@{ Archivo = $archivoFuenteEntrega.FullName; Entrada = $relativaEntrega }
}
$historialEntrega = & git -C $raizEntrega log --date=short --format='%h %ad %s' --all 2>$null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo exportar el historial Git.' }
$estadoEntrega = & git -C $raizEntrega status --short 2>$null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el estado de Git.' }

$zipEntrega = [System.IO.Compression.ZipFile]::Open($rutaZipEntrega, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($fuenteEntrega in $seleccionEntrega) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipEntrega, $fuenteEntrega.Archivo,
      ('SistemaContable/' + $fuenteEntrega.Entrada), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
  $historialTextoEntrega = "Historial Git registrado`r`n`r`n" + ($historialEntrega -join "`r`n") +
    "`r`n`r`nEstado de trabajo al empaquetar`r`nEl ZIP incluye tambien estos cambios actuales; no crea commits nuevos.`r`n`r`n" +
    ($estadoEntrega -join "`r`n")
  $entradaHistorialEntrega = $zipEntrega.CreateEntry('SistemaContable/HISTORIAL-ENTREGA.txt')
  $escritorEntrega = [System.IO.StreamWriter]::new($entradaHistorialEntrega.Open(), [System.Text.UTF8Encoding]::new($false))
  try { $escritorEntrega.Write($historialTextoEntrega) } finally { $escritorEntrega.Dispose() }
} finally { $zipEntrega.Dispose() }

$verificacionEntrega = [System.IO.Compression.ZipFile]::OpenRead($rutaZipEntrega)
try {
  foreach ($obligatorioEntrega in @('README.md', 'package.json', 'package-lock.json', '.env.example', 'supabase/schema.sql', 'supabase/data.sql')) {
    if ($null -eq $verificacionEntrega.GetEntry('SistemaContable/' + $obligatorioEntrega)) {
      throw "Falta un archivo requerido: $obligatorioEntrega"
    }
  }
  $totalArchivosEntrega = $verificacionEntrega.Entries.Count
} finally { $verificacionEntrega.Dispose() }
$pesoZipEntrega = (Get-Item -LiteralPath $rutaZipEntrega).Length
if ($pesoZipEntrega -ge 100MB) { throw 'El ZIP supera el limite de Moodle. Revisa las capturas y otros recursos.' }
[PSCustomObject]@{ ZIP = $rutaZipEntrega; MB = [math]::Round($pesoZipEntrega / 1MB, 2); Archivos = $totalArchivosEntrega } | Format-List
